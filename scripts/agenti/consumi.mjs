#!/usr/bin/env node
// Misuratore dei consumi di Claude Code sull'ACCOUNT (tutti i progetti).
//
// A COSA SERVE: su abbonamento (MAX 5x) il problema non sono i soldi, e' restare
// dentro la finestra di consumo per non prendere blocchi a meta' lavoro. Questo
// script legge i registri locali che Claude Code scrive per ogni sessione e dice
// quanto si e' consumato: nella finestra di 5 ore in corso, nella sessione, e
// nello storico.
//
// PERCHE' TUTTO L'ACCOUNT (deciso il 31/7/2026 con Jacopo): i limiti che /usage
// riporta sono dell'abbonamento intero, non del singolo progetto. Misurare solo
// questa cartella mentre un altro progetto lavora in parallelo accoppierebbe un
// peso parziale a una percentuale totale, falsando la calibrazione. Quindi si
// scansiona ~/.claude/projects per intero.
//
// COSA NON FA: non manda niente da nessuna parte, non tocca il codice del
// progetto, e senza il flag --scrivi non crea alcun file. Legge e stampa.
//
// USO:
//   node scripts/agenti/consumi.mjs            → stampa il quadro
//   node scripts/agenti/consumi.mjs --json     → stessi dati in JSON
//   node scripts/agenti/consumi.mjs --scrivi   → aggiorna anche il registro condiviso
//
// Nota su "peso": i token non sono tutti uguali (scrivere costa piu' che leggere,
// rileggere la cache costa poco). Il peso li riporta a una scala unica usando i
// prezzi di listino come proporzione. NON e' una bolletta: con l'abbonamento non
// paghi quelle cifre. E' un indicatore di quanto stai consumando la finestra.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const FINESTRA_MS = 5 * 60 * 60 * 1000; // la finestra di consumo e' di 5 ore

// Prezzi di listino per milione di token, verificati il 23/7/2026.
// Servono solo come PROPORZIONE fra i tipi di token. Se cambiano, si aggiorna qui.
const PREZZI = {
  'claude-opus-5': { in: 5, out: 25 }, // assunto pari a Opus 4.x finche' non verificato a listino
  'claude-opus-4-8': { in: 5, out: 25 },
  'claude-opus-4-7': { in: 5, out: 25 },
  'claude-opus-4-6': { in: 5, out: 25 },
  'claude-fable-5': { in: 10, out: 50 },
  'claude-sonnet-5': { in: 3, out: 15 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5': { in: 1, out: 5 },
};
const PREZZO_IGNOTO = { in: 5, out: 25 }; // se esce un modello nuovo, si assume Opus
const MOLT_SCRITTURA_CACHE = 2; // cache tenuta 1 ora: costa il doppio dell'ingresso
const MOLT_LETTURA_CACHE = 0.1; // rileggere la cache costa un decimo

const RADICE = process.cwd();
const FILE_CALIBRAZIONE = path.join(RADICE, 'archivio-documenti', 'consumi', 'calibrazione.json');
const FILE_REGISTRO = path.join(RADICE, 'archivio-documenti', 'consumi', 'registro.md');

// --- individua le cartelle dei registri --------------------------------------

// Radice di TUTTI i progetti: e' quella che si misura, perche' il limite
// dell'abbonamento e' unico per l'account (vedi nota in testa al file).
function cartellaTuttiProgetti() {
  const base = path.join(os.homedir(), '.claude', 'projects');
  return fs.existsSync(base) ? base : null;
}

// Cartella del SOLO progetto corrente: serve a etichettare le chiamate
// (quanto di questa finestra e' nostro e quanto degli altri progetti).
function cartellaRegistri() {
  const base = path.join(os.homedir(), '.claude', 'projects');
  if (!fs.existsSync(base)) return null;

  const atteso = path.join(base, RADICE.replace(/[\\/:]/g, '-'));
  if (fs.existsSync(atteso)) return atteso;

  // Ripiego: la regola di conversione del nome puo' cambiare, ma dentro i
  // registri c'e' scritta la cartella di lavoro. Si cerca quella.
  for (const nome of fs.readdirSync(base)) {
    const dir = path.join(base, nome);
    if (!fs.statSync(dir).isDirectory()) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
    if (files.length === 0) continue;
    try {
      const righe = fs.readFileSync(path.join(dir, files[0]), 'utf8').split('\n');
      for (const riga of righe) {
        if (!riga.trim()) continue;
        const j = JSON.parse(riga);
        if (typeof j.cwd === 'string' && j.cwd.toLowerCase() === RADICE.toLowerCase()) return dir;
        break;
      }
    } catch {
      /* registro illeggibile: si passa oltre */
    }
  }
  return null;
}

// --- lettura e normalizzazione ----------------------------------------------

function peso(uso, modello) {
  const p = PREZZI[modello] ?? PREZZO_IGNOTO;
  const inTok = uso.input_tokens || 0;
  const outTok = uso.output_tokens || 0;
  const scrittura = uso.cache_creation_input_tokens || 0;
  const lettura = uso.cache_read_input_tokens || 0;
  return (
    (inTok * p.in +
      outTok * p.out +
      scrittura * p.in * MOLT_SCRITTURA_CACHE +
      lettura * p.in * MOLT_LETTURA_CACHE) /
    1e6
  );
}

// Elenca ricorsivamente tutti i .jsonl sotto una cartella. Serve perche' Claude
// Code usa un layout a cartelle-per-sessione: il transcript principale sta in
// <progetto>/<sessione>.jsonl, ma le chiamate dei subagent finiscono in
// <progetto>/<sessione>/subagents/*.jsonl. Leggendo solo il primo livello si
// perdevano TUTTI i subagent: quota subagent falsata a 0 e totale sottostimato.
function elencaJsonl(base) {
  const out = [];
  let voci;
  try {
    voci = fs.readdirSync(base);
  } catch {
    return out;
  }
  for (const nome of voci) {
    const p = path.join(base, nome);
    let st;
    try {
      st = fs.statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) out.push(...elencaJsonl(p));
    else if (nome.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

function leggiChiamate(base, dirProgettoCorrente = null) {
  const chiamate = [];
  const viste = new Set(); // stessa chiamata annotata piu' volte: si conta una volta sola
  for (const file of elencaJsonl(base)) {
    // A quale progetto appartiene questa chiamata: la prima parte del percorso
    // relativo alla radice dei progetti e' la cartella-progetto.
    const progetto = path.relative(base, file).split(path.sep)[0] || '(radice)';
    const nostro = dirProgettoCorrente ? file.startsWith(dirProgettoCorrente + path.sep) : true;
    let contenuto;
    try {
      contenuto = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    // Se il file sta in .../<sessione>/subagents/..., il consumo va attribuito
    // alla sessione che ha lanciato il subagent (la cartella nonna), e la riga
    // va marcata come subagent anche se il flag isSidechain non fosse presente.
    const parti = path.relative(base, file).split(path.sep);
    const iSub = parti.indexOf('subagents');
    const sessioneMadre = iSub > 0 ? parti[iSub - 1] : null;
    const nomeBase = path.basename(file).replace('.jsonl', '');
    for (const riga of contenuto.split('\n')) {
      if (!riga.trim()) continue;
      let j;
      try {
        j = JSON.parse(riga);
      } catch {
        continue;
      }
      const m = j.message;
      if (!m || !m.usage || !j.timestamp) continue;
      const chiave = j.requestId || j.uuid;
      if (!chiave || viste.has(chiave)) continue;
      viste.add(chiave);
      const u = m.usage;
      chiamate.push({
        t: Date.parse(j.timestamp),
        sessione: sessioneMadre || j.sessionId || nomeBase,
        progetto,
        nostro,
        modello: m.model || 'sconosciuto',
        subagent: Boolean(j.isSidechain) || iSub > 0,
        entrata: u.input_tokens || 0,
        uscita: u.output_tokens || 0,
        cacheScritta: u.cache_creation_input_tokens || 0,
        cacheLetta: u.cache_read_input_tokens || 0,
        peso: peso(u, m.model),
      });
    }
  }
  chiamate.sort((a, b) => a.t - b.t);
  return chiamate;
}

// --- aggregazioni ------------------------------------------------------------

function sommaVuota() {
  return { peso: 0, entrata: 0, uscita: 0, cacheScritta: 0, cacheLetta: 0, chiamate: 0 };
}
function accumula(acc, c) {
  acc.peso += c.peso;
  acc.entrata += c.entrata;
  acc.uscita += c.uscita;
  acc.cacheScritta += c.cacheScritta;
  acc.cacheLetta += c.cacheLetta;
  acc.chiamate += 1;
  return acc;
}

function piccoFinestra(chiamate) {
  let migliore = 0;
  let quando = 0;
  let somma = 0;
  let coda = 0;
  for (let i = 0; i < chiamate.length; i += 1) {
    somma += chiamate[i].peso;
    while (chiamate[coda].t < chiamate[i].t - FINESTRA_MS) {
      somma -= chiamate[coda].peso;
      coda += 1;
    }
    if (somma > migliore) {
      migliore = somma;
      quando = chiamate[i].t;
    }
  }
  return { peso: migliore, quando };
}

function perSessione(chiamate) {
  const mappa = new Map();
  for (const c of chiamate) {
    if (!mappa.has(c.sessione)) {
      mappa.set(c.sessione, { id: c.sessione, inizio: c.t, fine: c.t, ...sommaVuota(), subagent: 0 });
    }
    const s = mappa.get(c.sessione);
    accumula(s, c);
    s.fine = Math.max(s.fine, c.t);
    s.inizio = Math.min(s.inizio, c.t);
    if (c.subagent) s.subagent += c.peso;
  }
  return [...mappa.values()].sort((a, b) => a.fine - b.fine);
}

function mediana(valori) {
  if (valori.length === 0) return 0;
  const v = [...valori].sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
}

// --- calibrazione ------------------------------------------------------------
// Il rapporto fra "peso" e percentuale reale del limite non e' pubblicato e non
// e' leggibile da nessuna parte in locale. Si impara dai campioni che l'utente
// fornisce leggendo /usage nell'app.

function leggiCalibrazione() {
  try {
    const j = JSON.parse(fs.readFileSync(FILE_CALIBRAZIONE, 'utf8'));
    // I campioni marcati "escluso" restano nel file come memoria storica ma
    // non entrano nella stima (di solito: presi con un metro non confrontabile).
    return Array.isArray(j.campioni) ? j.campioni.filter((c) => c.peso > 0 && c.percentuale > 0 && !c.escluso) : [];
  } catch {
    return [];
  }
}

function stimaPercentuale(campioni, pesoAttuale) {
  if (campioni.length < 2) return null;
  // Retta per l'origine: percentuale = k * peso. k = media dei rapporti.
  const k = campioni.reduce((s, c) => s + c.percentuale / c.peso, 0) / campioni.length;
  const scarti = campioni.map((c) => Math.abs(c.percentuale - k * c.peso));
  return {
    percentuale: k * pesoAttuale,
    campioni: campioni.length,
    scartoMedio: scarti.reduce((s, x) => s + x, 0) / scarti.length,
  };
}

// --- uscita ------------------------------------------------------------------

const n1 = (x) => x.toFixed(1);
const mln = (x) => `${(x / 1e6).toFixed(2)}M`;
const quando = (t) => new Date(t).toISOString().slice(0, 16).replace('T', ' ');

function main() {
  const args = process.argv.slice(2);
  const base = cartellaTuttiProgetti();
  if (!base) {
    console.error('Registri di Claude Code non trovati.');
    console.error(`Cercati in: ${path.join(os.homedir(), '.claude', 'projects')}`);
    process.exitCode = 1;
    return;
  }
  const dirNostra = cartellaRegistri(); // puo' essere null: si misura comunque l'account

  const chiamate = leggiChiamate(base, dirNostra);
  if (chiamate.length === 0) {
    console.error('Nessuna chiamata registrata: non c\'e\' ancora niente da misurare.');
    process.exitCode = 1;
    return;
  }

  const adesso = Date.now();
  const inFinestra = chiamate.filter((c) => c.t >= adesso - FINESTRA_MS);
  const finestra = inFinestra.reduce(accumula, sommaVuota());
  // Ripartizione della finestra per progetto: serve a capire quanto del limite
  // se lo sta mangiando un altro progetto aperto in parallelo.
  const finestraPerProgetto = [...inFinestra.reduce((mappa, c) => {
    const voce = mappa.get(c.progetto) || { progetto: c.progetto, peso: 0, nostro: c.nostro };
    voce.peso += c.peso;
    mappa.set(c.progetto, voce);
    return mappa;
  }, new Map()).values()].sort((a, b) => b.peso - a.peso);
  const totale = chiamate.reduce(accumula, sommaVuota());
  const picco = piccoFinestra(chiamate);
  const sessioni = perSessione(chiamate);
  const ultima = sessioni[sessioni.length - 1];
  const medianaSessione = mediana(sessioni.map((s) => s.peso));
  const pesoSubagent = chiamate.filter((c) => c.subagent).reduce((s, c) => s + c.peso, 0);
  const campioni = leggiCalibrazione();
  const stima = stimaPercentuale(campioni, finestra.peso);

  const dati = {
    generatoIl: new Date(adesso).toISOString(),
    finestraCorrente: { ...finestra, stimaPercentuale: stima },
    piccoStorico: picco,
    medianaSessione,
    ultimaSessione: ultima,
    totale,
    sessioni: sessioni.length,
    quotaSubagent: totale.peso > 0 ? pesoSubagent / totale.peso : 0,
    calibrazione: campioni.length,
    finestraPerProgetto,
  };

  if (args.includes('--json')) {
    console.log(JSON.stringify(dati, null, 2));
    return;
  }

  const perc = finestra.peso / (picco.peso || 1);
  const barra = '#'.repeat(Math.min(40, Math.round(perc * 40))).padEnd(40, '.');

  console.log('');
  console.log('CONSUMI — Claude Code, TUTTI i progetti (il limite e\' dell\'account)');
  console.log(`(${sessioni.length} sessioni, ${chiamate.length} chiamate, dal ${quando(chiamate[0].t)})`);
  console.log('');
  console.log('FINESTRA IN CORSO (ultime 5 ore)');
  console.log(`  peso ${n1(finestra.peso)} unita'   [${barra}] ${(perc * 100).toFixed(0)}% del tuo picco storico`);
  console.log(`  chiamate ${finestra.chiamate} · uscita ${mln(finestra.uscita)} · cache riletta ${mln(finestra.cacheLetta)}`);
  if (finestraPerProgetto.length > 1) {
    const righe = finestraPerProgetto
      .slice(0, 4)
      .map((p) => `${p.nostro ? 'questo progetto' : p.progetto} ${n1(p.peso)}`)
      .join(' · ');
    console.log(`  ripartizione: ${righe}`);
  }
  if (stima) {
    console.log(
      `  ≈ ${stima.percentuale.toFixed(0)}% del limite  (stima da ${stima.campioni} letture di /usage, scarto medio ${stima.scartoMedio.toFixed(1)} punti)`,
    );
  } else {
    console.log(
      `  percentuale del limite: NON disponibile (servono almeno 2 letture di /usage — vedi in fondo)`,
    );
  }
  console.log('');
  console.log('TERMINI DI PARAGONE');
  console.log(`  picco storico in 5 ore : ${n1(picco.peso)} unita'  (il ${quando(picco.quando)})`);
  console.log(`  sessione mediana       : ${n1(medianaSessione)} unita'`);
  console.log(
    `  ultima sessione        : ${n1(ultima.peso)} unita'  (${ultima.chiamate} chiamate, chiusa ${quando(ultima.fine)})`,
  );
  console.log('');
  console.log('DOVE VA IL CONSUMO (storico)');
  const voci = [
    ['rilettura cache', totale.cacheLetta * MOLT_LETTURA_CACHE],
    ['scrittura cache', totale.cacheScritta * MOLT_SCRITTURA_CACHE],
    ['token scritti dall\'AI', totale.uscita * 5],
    ['ingresso non in cache', totale.entrata],
  ];
  const sommaVoci = voci.reduce((s, [, v]) => s + v, 0) || 1;
  for (const [nome, valore] of voci) {
    const q = (valore / sommaVoci) * 100;
    console.log(`  ${nome.padEnd(24)} ${'█'.repeat(Math.round(q / 2.5)).padEnd(40, ' ')} ${q.toFixed(0)}%`);
  }
  console.log('');
  console.log('SUBAGENT');
  console.log(
    `  quota del consumo totale finita nei subagent: ${(dati.quotaSubagent * 100).toFixed(1)}%` +
      (dati.quotaSubagent === 0 ? '  (nessun subagent usato finora)' : ''),
  );
  console.log('');
  if (!stima) {
    console.log('PER PASSARE ALLE PERCENTUALI');
    console.log('  Il limite dell\'abbonamento non e\' leggibile da qui: nessun comando e nessun');
    console.log('  file locale lo espone. Va letto a mano e registrato, cosi lo script impara la');
    console.log('  conversione. Come fare, quando la finestra e\' gia\' carica:');
    console.log('    1. scrivi  /usage  nella casella dell\'app');
    console.log('    2. passa all\'assistente la percentuale che riporta');
    console.log(`    3. finisce in ${path.relative(RADICE, FILE_CALIBRAZIONE)}`);
    console.log('  Bastano 3-5 letture prese in momenti di carico diverso.');
    console.log('');
  }

  if (args.includes('--scrivi')) {
    fs.mkdirSync(path.dirname(FILE_REGISTRO), { recursive: true });
    const riga =
      `| ${quando(adesso)} | ${n1(ultima.peso)} | ${ultima.chiamate} | ${(dati.quotaSubagent * 100).toFixed(1)}% | ${n1(picco.peso)} | ${campioni.length} |\n`;
    if (!fs.existsSync(FILE_REGISTRO)) {
      fs.writeFileSync(
        FILE_REGISTRO,
        '# Registro consumi\n\n' +
          '> Aggiornato da `node scripts/agenti/consumi.mjs --scrivi`. Una riga per rilevazione.\n' +
          '> Il "peso" e\' un indicatore di consumo, non una spesa: con l\'abbonamento non si paga a token.\n\n' +
          '| quando | peso ultima sessione | chiamate | quota subagent | picco storico 5h | campioni calibrazione |\n' +
          '|---|---:|---:|---:|---:|---:|\n',
      );
    }
    fs.appendFileSync(FILE_REGISTRO, riga);
    console.log(`Registro aggiornato: ${path.relative(RADICE, FILE_REGISTRO)}`);
    console.log('');
  }
}

main();
