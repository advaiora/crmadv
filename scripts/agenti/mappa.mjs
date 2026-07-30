#!/usr/bin/env node
// Generatore della "mappa del progetto".
//
// A COSA SERVE: dare all'esploratore (e a chi legge) una fotografia STRUTTURALE
// del progetto — moduli backend, export, catena dei permessi, centralini da
// allineare, modelli Prisma, indice delle sezioni dei documenti grossi ed elenco
// dei file da NON aprire interi — cosi' non serve rileggere i file-mostro a ogni
// giro. E' l'idea utile di Graphify (mappare invece di rileggere), ma fatta in
// casa: deterministica, committata, e con le catene SPECIFICHE di questo progetto
// (permessi/rotte/Prisma) che un grafo AST generico non vede.
//
// COSA NON FA: non e' un analizzatore semantico. Gli export sono estratti con
// espressioni regolari (possono sfuggire re-export o export default), e le catene
// rotte/Prisma sono per ora PUNTATORI, non cross-riferimenti completi (vedi la
// sezione "Limiti" in fondo alla mappa). E' una guida per orientarsi, sempre da
// verificare sul codice.
//
// USO:
//   node scripts/agenti/mappa.mjs           -> scrive archivio-documenti/mappa/mappa-progetto.md
//   node scripts/agenti/mappa.mjs --stdout  -> stampa a video senza scrivere il file

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const RADICE = process.cwd();
const USCITA = path.join(RADICE, 'archivio-documenti', 'mappa', 'mappa-progetto.md');

const DIR_ESCLUSE = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.vite', '.next']);
const EST_CODICE = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SOGLIA_FILE_MOSTRO = 800; // righe oltre cui un file "non si apre intero"
const SOGLIA_DOC = 200; // righe oltre cui un documento entra nell'indice sezioni

// --- utilita' filesystem ---------------------------------------------------

function elencaFile(base) {
  const out = [];
  let voci;
  try {
    voci = fs.readdirSync(base, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const v of voci) {
    const p = path.join(base, v.name);
    if (v.isDirectory()) {
      if (DIR_ESCLUSE.has(v.name)) continue;
      out.push(...elencaFile(p));
    } else {
      out.push(p);
    }
  }
  return out;
}

function leggi(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}
const nRighe = (txt) => (txt ? txt.split('\n').length : 0);
const rel = (p) => path.relative(RADICE, p).split(path.sep).join('/');
const est = (f) => path.extname(f).toLowerCase();

// Commit corrente: serve da timbro di freschezza nell'intestazione della mappa,
// cosi' chi la legge (o l'esploratore) vede su quale stato del codice e' stata
// generata e capisce a colpo d'occhio se e' vecchia.
function gitHead() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: RADICE, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'n/d';
  }
}

// --- export (euristica a regex) --------------------------------------------

function estraiExport(txt) {
  const nomi = [];
  const regole = [
    /^\s*export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/gm,
    /^\s*export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/gm,
    /^\s*export\s+(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)/gm,
    /^\s*export\s+(?:interface|type|enum)\s+([A-Za-z0-9_$]+)/gm,
  ];
  let m;
  for (const re of regole) {
    while ((m = re.exec(txt))) nomi.push(m[1]);
  }
  const reBraces = /^\s*export\s*\{([^}]*)\}/gm;
  while ((m = reBraces.exec(txt))) {
    for (const pezzo of m[1].split(',')) {
      const nome = pezzo.trim().split(/\s+as\s+/).pop().trim();
      if (nome && /^[A-Za-z0-9_$]+$/.test(nome)) nomi.push(nome);
    }
  }
  if (/^\s*export\s+default\b/m.test(txt)) nomi.push('(default)');
  return [...new Set(nomi)];
}

// --- raccolta dati ----------------------------------------------------------

function inventario() {
  const perEst = {};
  let totRighe = 0;
  const mostri = [];
  for (const f of elencaFile(RADICE)) {
    const e = est(f);
    if (!EST_CODICE.has(e)) continue;
    perEst[e] = (perEst[e] || 0) + 1;
    const r = nRighe(leggi(f));
    totRighe += r;
    // La vendored @hk-gantt resta nei conteggi (esiste nel repo) ma NON tra i mostri:
    // non e' codice nostro, non va presa di mira da un riordino (allineato a eslint/vitest).
    if (r > SOGLIA_FILE_MOSTRO && !rel(f).startsWith('src/components/@hk-gantt/')) {
      mostri.push({ file: rel(f), righe: r });
    }
  }
  mostri.sort((a, b) => b.righe - a.righe);
  return { perEst, totRighe, mostri };
}

function moduliBackend() {
  const dir = path.join(RADICE, 'server', 'modules');
  let nomi = [];
  try {
    nomi = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  } catch {
    return [];
  }
  return nomi.map((nome) => {
    const files = elencaFile(path.join(dir, nome))
      .filter((f) => ['.ts', '.tsx'].includes(est(f)))
      .map((f) => {
        const txt = leggi(f);
        return { file: rel(f), righe: nRighe(txt), test: /\.test\.ts$/.test(f), exp: estraiExport(txt) };
      })
      .sort((a, b) => b.righe - a.righe);
    return { nome, files };
  });
}

// Frontend .jsx raggruppato per "area" (views/<Area>, modules/<nome>, components, layout...).
// Stessa idea dei moduli backend: vedere la superficie senza aprire i file.
function areeFrontend() {
  const gruppi = new Map();
  for (const f of elencaFile(path.join(RADICE, 'src'))) {
    if (est(f) !== '.jsx') continue;
    if (/\.(test|spec)\.jsx$/.test(f)) continue; // i test non sono debito: fuori dai pesi per area
    const r = rel(f); // es. src/views/Agency/chat/AiChatWidget.jsx
    const parti = r.split('/');
    let chiave;
    if (parti[1] === 'views' && parti.length > 3) chiave = `views/${parti[2]}`;
    else if (parti[1] === 'modules' && parti.length > 3) chiave = `modules/${parti[2]}`;
    else if (parti[1] === 'components' && parti[2] === '@hk-gantt') continue; // libreria vendored, non nostra
    else chiave = parti.length > 2 ? parti[1] : '(radice src)';
    const txt = leggi(f);
    const voce = { file: r, righe: nRighe(txt), exp: estraiExport(txt) };
    if (!gruppi.has(chiave)) gruppi.set(chiave, []);
    gruppi.get(chiave).push(voce);
  }
  const out = [...gruppi.entries()].map(([nome, files]) => ({
    nome,
    files: files.sort((a, b) => b.righe - a.righe),
    totRighe: files.reduce((s, f) => s + f.righe, 0),
  }));
  out.sort((a, b) => b.totRighe - a.totRighe);
  return out;
}

function catenaPermessi() {
  const catalogo = leggi(path.join(RADICE, 'server', 'auth', 'rbac-catalog.ts'));
  const set = new Set();
  const re = /['"]([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)['"]/g;
  let m;
  while ((m = re.exec(catalogo))) set.add(m[1]);
  const permessi = [...set].sort();

  // Confronto contro TUTTO il frontend (src/), non solo constants.js/sidebar/nav:
  // un permesso puo' essere usato anche in una vista o in un componente. Cosi' si
  // riducono i falsi positivi ("segnalato assente" solo perche' stava in un file
  // con un altro nome). Chi resta in lista o e' solo-backend o e' un buco vero.
  const fileFrontend = elencaFile(path.join(RADICE, 'src')).filter((f) =>
    ['.js', '.jsx', '.ts', '.tsx'].includes(est(f)),
  );
  const blob = fileFrontend.map(leggi).join('\n');
  const senzaFrontend = permessi.filter((p) => !blob.includes(p));
  return { totale: permessi.length, righeCatalogo: nRighe(catalogo), senzaFrontend, nFileFrontend: fileFrontend.length };
}

function centralini() {
  const lista = [
    ['server/app.ts', 'registrazione rotte backend'],
    ['server/auth/rbac-catalog.ts', 'catalogo permessi + ruoli'],
    ['src/routes/RouteList.jsx', 'rotte frontend'],
    ['src/layout/Sidebar/SidebarMenu.jsx', 'voci sidebar'],
    ['src/layout/Mobile/MobileBottomNav.jsx', 'voci nav mobile'],
  ];
  return lista.map(([p, cosa]) => {
    const abs = path.join(RADICE, p.split('/').join(path.sep));
    return { file: p, cosa, righe: nRighe(leggi(abs)), esiste: fs.existsSync(abs) };
  });
}

function modelliPrisma() {
  const txt = leggi(path.join(RADICE, 'prisma', 'schema.prisma'));
  if (!txt) return { righe: 0, modelli: [] };
  const ln = txt.split('\n');
  const modelli = [];
  for (let i = 0; i < ln.length; i++) {
    const m = ln[i].match(/^\s*model\s+([A-Za-z0-9_]+)\s*\{/);
    if (!m) continue;
    let campi = 0;
    let j = i + 1;
    for (; j < ln.length; j++) {
      if (/^\s*\}/.test(ln[j])) break;
      if (/^\s*[A-Za-z0-9_]+\s+\S/.test(ln[j]) && !/^\s*(\/\/|@@)/.test(ln[j])) campi++;
    }
    modelli.push({ nome: m[1], riga: i + 1, campi });
  }
  return { righe: ln.length, modelli };
}

function indiceDocumenti() {
  const dir = path.join(RADICE, 'archivio-documenti');
  const files = elencaFile(dir).filter(
    (f) =>
      est(f) === '.md' &&
      !rel(f).includes('/handoff/') &&
      !rel(f).includes('/esempi-excel-clienti/') &&
      !rel(f).includes('/mappa/') &&
      !/README\.md$/i.test(f),
  );
  const doc = [];
  for (const f of files) {
    const txt = leggi(f);
    if (nRighe(txt) < SOGLIA_DOC) continue;
    const ln = txt.split('\n');
    const sezioni = [];
    for (let i = 0; i < ln.length; i++) {
      const m = ln[i].match(/^(#{1,3})\s+(.*\S)/);
      if (m) sezioni.push({ livello: m[1].length, titolo: m[2].trim(), riga: i + 1 });
    }
    if (sezioni.length) doc.push({ file: rel(f), righe: ln.length, sezioni });
  }
  doc.sort((a, b) => b.righe - a.righe);
  return doc;
}

// --- composizione markdown --------------------------------------------------

function componi() {
  const quando = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const commit = gitHead();
  const inv = inventario();
  const moduli = moduliBackend();
  const aree = areeFrontend();
  const perm = catenaPermessi();
  const centr = centralini();
  const prisma = modelliPrisma();
  const doc = indiceDocumenti();

  const totFile = Object.values(inv.perEst).reduce((s, n) => s + n, 0);
  const R = [];
  R.push(`# Mappa del progetto (generata) — ${quando} · commit ${commit}`);
  R.push('');
  R.push('> Generata da `node scripts/agenti/mappa.mjs` (o `npm run mappa`). E\' una **fotografia** del');
  R.push(`> commit \`${commit}\`: se \`git log\` e' piu' avanti, la mappa e' vecchia — rigenerala o vai al codice.`);
  R.push('> E\' una guida per orientarsi, NON una verita\' assoluta: i riferimenti `file:riga` vanno');
  R.push('> verificati sul codice, e gli export sono estratti a regex.');
  R.push('');
  R.push('## 0. In breve');
  R.push('');
  R.push(
    `- **${totFile}** file di codice, **${inv.totRighe.toLocaleString('it-IT')}** righe. ` +
      `**${moduli.length}** moduli backend. **${perm.totale}** permessi nel catalogo. ` +
      `**${prisma.modelli.length}** modelli Prisma.`,
  );
  R.push(
    '- Estensioni: ' +
      Object.entries(inv.perEst)
        .sort((a, b) => b[1] - a[1])
        .map(([e, n]) => `${e} ${n}`)
        .join(' · '),
  );
  R.push('');

  R.push(`## 1. File da NON aprire interi (oltre ${SOGLIA_FILE_MOSTRO} righe)`);
  R.push('');
  R.push('Cerca per nome e leggi solo l\'intorno che serve. (Esclusa la libreria vendored');
  R.push('@hk-gantt: non e\' codice nostro e non va presa di mira da un riordino.)');
  R.push('');
  R.push('| righe | file |');
  R.push('|---:|---|');
  for (const f of inv.mostri) R.push(`| ${f.righe} | \`${f.file}\` |`);
  R.push('');

  R.push('## 2. Moduli backend (`server/modules/<nome>/`)');
  R.push('');
  R.push('Export principali per file, cosi\' vedi la superficie di un modulo senza aprirlo.');
  R.push('');
  for (const mod of moduli) {
    R.push(`### ${mod.nome}`);
    const mostrati = mod.files.slice(0, 8);
    for (const f of mostrati) {
      const nomeCorto = f.file.replace(`server/modules/${mod.nome}/`, '');
      const tag = f.test ? ' _(test)_' : '';
      const exp = f.exp.length
        ? f.exp.slice(0, 15).join(', ') + (f.exp.length > 15 ? ` (+${f.exp.length - 15})` : '')
        : '—';
      R.push(`- \`${nomeCorto}\` (${f.righe} righe)${tag} — export: ${exp}`);
    }
    if (mod.files.length > mostrati.length) R.push(`- _(+${mod.files.length - mostrati.length} altri file)_`);
    R.push('');
  }

  R.push('## 2b. Frontend `.jsx` per area');
  R.push('');
  R.push('Aree ordinate per peso (righe totali). Per area: i file piu\' grossi con gli export,');
  R.push('cosi\' scegli il punto d\'ingresso senza aprire i file. (Esclusi i file di test');
  R.push('`*.test.jsx`/`*.spec.jsx` — non sono debito — e la libreria vendored @hk-gantt.)');
  R.push('');
  const totJsx = aree.reduce((s, a) => s + a.files.length, 0);
  const totRigheJsx = aree.reduce((s, a) => s + a.totRighe, 0);
  R.push(`Totale: **${totJsx}** file \`.jsx\`, **${totRigheJsx.toLocaleString('it-IT')}** righe.`);
  R.push('');
  for (const area of aree) {
    R.push(`### ${area.nome} (${area.files.length} file, ${area.totRighe.toLocaleString('it-IT')} righe)`);
    const mostrati = area.files.slice(0, 6);
    for (const f of mostrati) {
      const nomeCorto = f.file.replace(/^src\//, '');
      const exp = f.exp.length
        ? f.exp.slice(0, 10).join(', ') + (f.exp.length > 10 ? ` (+${f.exp.length - 10})` : '')
        : '—';
      R.push(`- \`${nomeCorto}\` (${f.righe} righe) — export: ${exp}`);
    }
    if (area.files.length > mostrati.length) R.push(`- _(+${area.files.length - mostrati.length} altri file)_`);
    R.push('');
  }

  R.push('## 3. Catena permessi (RBAC)');
  R.push('');
  R.push(
    `Catalogo: \`server/auth/rbac-catalog.ts\` (${perm.righeCatalogo} righe), **${perm.totale}** permessi. ` +
      `Confrontati con ${perm.nFileFrontend} sorgenti frontend (tutti i file in \`src/\`).`,
  );
  R.push('');
  if (perm.senzaFrontend.length) {
    R.push(
      '⚠️ **Permessi nel catalogo backend senza riscontro nel frontend** ' +
        '(da verificare: alcuni sono solo-backend e va bene, altri potrebbero essere un collegamento dimenticato):',
    );
    R.push('');
    for (const p of perm.senzaFrontend) R.push(`- \`${p}\``);
  } else {
    R.push('Tutti i permessi del catalogo compaiono anche lato frontend.');
  }
  R.push('');

  R.push('## 4. Centralini da allineare (puntatori)');
  R.push('');
  R.push('Quasi ogni funzione nuova tocca questi. Verificane l\'allineamento fino in fondo.');
  R.push('');
  R.push('| file | righe | cosa contiene |');
  R.push('|---|---:|---|');
  for (const c of centr) R.push(`| \`${c.file}\` | ${c.esiste ? c.righe : 'N/D'} | ${c.cosa} |`);
  R.push('');
  R.push('Nota: le stringhe-permesso sono **copiate a mano** in `src/modules/<nome>/ui/constants.js` — vedi §3.');
  R.push('');

  R.push('## 5. Prisma (`prisma/schema.prisma`)');
  R.push('');
  R.push(`${prisma.righe} righe, **${prisma.modelli.length}** modelli.`);
  R.push('');
  R.push('| modello | riga | campi |');
  R.push('|---|---:|---:|');
  for (const m of prisma.modelli) R.push(`| ${m.nome} | ${m.riga} | ${m.campi} |`);
  R.push('');

  R.push('## 6. Indice sezioni dei documenti grossi');
  R.push('');
  R.push(`Documenti oltre ${SOGLIA_DOC} righe: salta alla sezione giusta invece di leggere il file intero.`);
  R.push('');
  for (const d of doc) {
    R.push(`### \`${d.file}\` (${d.righe} righe)`);
    for (const s of d.sezioni.slice(0, 40)) {
      const rientro = '  '.repeat(Math.max(0, s.livello - 1));
      R.push(`${rientro}- ${s.titolo} — riga ${s.riga}`);
    }
    if (d.sezioni.length > 40) R.push(`- _(+${d.sezioni.length - 40} sezioni)_`);
    R.push('');
  }

  R.push('## 7. Limiti di questa mappa (v2)');
  R.push('');
  R.push('- **Export**: estratti a regex — possono sfuggire re-export, export default rinominati, barrel file. Vale anche per la sezione frontend (§2b).');
  R.push('- **Catene rotte/Prisma**: qui sono *puntatori*, non ancora cross-riferite riga per riga.');
  R.push('- **Frontend**: la §2b elenca i `.jsx` (non i `.js` di utilita\' ne\' i `.ts`); per area mostra solo i file piu\' grossi.');
  R.push('- E\' una fotografia: se il codice e\' cambiato dopo la data in cima, rigenera o vai al codice.');
  R.push('');

  return R.join('\n');
}

function main() {
  const md = componi();
  if (process.argv.includes('--stdout')) {
    process.stdout.write(md);
    return;
  }
  fs.mkdirSync(path.dirname(USCITA), { recursive: true });
  fs.writeFileSync(USCITA, md, 'utf8');
  const kb = (Buffer.byteLength(md, 'utf8') / 1024).toFixed(1);
  console.log(`Mappa generata: ${path.relative(RADICE, USCITA).split(path.sep).join('/')} (${kb} KB, ${nRighe(md)} righe)`);
}

main();
