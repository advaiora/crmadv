// Il banco dell'HOOK INTERO: non le funzioni pure (quelle hanno il loro banco in
// `segnaposto.test.mjs`), non la sola cintura sui segreti (`controllo-segreti.test.mjs`),
// ma la domanda «con questo lanciatore e questo modulo sul disco, il commit passa o
// viene rifiutato?». Si risponde nel solo modo che conta: un repository usa-e-getta,
// l'hook eseguito davvero, il codice di uscita — e, negli ultimi due casi, un `git
// commit` vero.
//
// PERCHE' ESISTE (compito CRMA-152). Il file che fa da guardia non aveva nessuno che
// guardasse lui: `.githooks/pre-commit` era uno script `sh` di 133 righe, cioe' un file
// di testo soggetto a troncamento esattamente come i moduli che protegge. Misurato in
// CRMA-102, con un segreto vero in stage: **105 punti di troncamento su 135 lasciavano
// passare il commit**. Portata la logica in `pre-commit.mjs`, la sentinella la copre; il
// lanciatore che resta e' corto e chiuso in un blocco `{ }`, cosi' ogni troncamento al
// suo interno diventa un errore di sintassi invece che uno script piu' corto ma valido.
//
// ⚠️ Il caso (1) e' il piu' importante di tutti, ed e' quello che si dimentica: un guasto
// nella sentinella non si manifesta come un segreto che passa, ma come OGNI COMMIT
// RIFIUTATO. Se salta quello, l'hook e' inservibile per tutti.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';

const RADICE = path.resolve(import.meta.dirname, '..', '..');

// Un segreto che le regole riconoscono per certo: ne' l'utente ne' la password sono
// segnaposto, quindi `eSegnaposto` non lo salva. Composto a pezzi per non lasciare in
// giro una stringa che somigli a una credenziale vera (nota operativa #87).
const SEGRETO = 'postgresql://mario:' + 'Zq7' + 'rT4wPl9xNb2c' + '@db.interno:5432/crm';

let banco = '';
let repo = '';
let modulo = '';
let lanciatore = '';
let sorgenteModulo = '';
let sorgenteLanciatore = '';

/** Esegue l'hook nel repository di prova. Torna codice di uscita, stdout e stderr. */
const eseguiHook = (ambiente = undefined) => {
  // `/bin/sh` per percorso assoluto: uno dei casi qui sotto svuota il PATH, e con
  // il nome nudo non si troverebbe nemmeno la shell.
  const r = spawnSync('/bin/sh', ['.githooks/pre-commit'], {
    cwd: repo, encoding: 'utf8', env: ambiente ?? process.env,
  });
  return { codice: r.status, out: r.stdout ?? '', err: r.stderr ?? '' };
};

/** Riscrive un file del banco. Passare `null` per farlo sparire del tutto. */
const scrivi = (dove, contenuto) => {
  if (contenuto === null) fs.rmSync(dove, { force: true });
  else fs.writeFileSync(dove, contenuto);
};

const ripristina = () => {
  scrivi(modulo, sorgenteModulo);
  scrivi(lanciatore, sorgenteLanciatore);
};

const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });

before(() => {
  banco = fs.mkdtempSync(path.join(os.tmpdir(), 'pre-commit-'));
  repo = path.join(banco, 'repo');
  fs.mkdirSync(path.join(repo, '.githooks'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'scripts', 'hook'), { recursive: true });

  fs.copyFileSync(path.join(RADICE, '.githooks/pre-commit'), path.join(repo, '.githooks/pre-commit'));
  for (const f of fs.readdirSync(path.join(RADICE, 'scripts/hook'))) {
    fs.copyFileSync(path.join(RADICE, 'scripts/hook', f), path.join(repo, 'scripts/hook', f));
  }
  modulo = path.join(repo, 'scripts/hook/pre-commit.mjs');
  lanciatore = path.join(repo, '.githooks/pre-commit');
  sorgenteModulo = fs.readFileSync(modulo, 'utf8');
  sorgenteLanciatore = fs.readFileSync(lanciatore, 'utf8');

  execFileSync('git', ['init', '-q', repo], { encoding: 'utf8' });
  git('config', 'user.name', 'banco');
  git('config', 'user.email', 'banco@example.invalid');
  git('config', 'core.hooksPath', '.githooks');
  // Un commit di partenza, cosi' HEAD esiste come in un repository vero. Il file col
  // segreto NON deve essere in stage adesso, o se lo porterebbe dentro il commit e il
  // diff da controllare resterebbe vuoto.
  fs.writeFileSync(path.join(repo, 'README.md'), 'banco\n');
  git('add', 'README.md');
  git('-c', 'core.hooksPath=/dev/null', 'commit', '-q', '-m', 'partenza');
});

after(() => {
  if (banco) fs.rmSync(banco, { recursive: true, force: true });
});

// ⚠️ In stage va SOLO il file di prova. L'hook e i moduli li legge dall'albero di
// lavoro, non dall'indice: metterli in stage non serve a niente e fa litigare `git`
// con le riscritture che ogni caso qui sotto esegue.
/** Mette in stage un file pulito, senza niente che assomigli a un segreto. */
const stagePulito = () => {
  git('reset', '-q');
  fs.rmSync(path.join(repo, 'config.txt'), { force: true });
  fs.writeFileSync(path.join(repo, 'note.txt'), 'una riga innocua\n');
  git('add', 'note.txt');
};

/** Mette in stage un file che contiene un segreto vero. */
const stageConSegreto = () => {
  git('reset', '-q');
  fs.writeFileSync(path.join(repo, 'config.txt'), SEGRETO + '\n');
  git('add', 'config.txt');
};

// ---------------------------------------------------------------------------
// (1) Tutto intatto: l'hook deve LASCIAR PASSARE il lavoro pulito.
//     Se salta questo, l'hook rifiuta ogni commit del progetto.
// ---------------------------------------------------------------------------
test('tutto intatto, niente di sospetto in stage: il commit passa', () => {
  ripristina();
  stagePulito();
  const r = eseguiHook();
  assert.equal(r.codice, 0, "l'hook doveva accettare, ha stampato: " + r.err);
});

// ---------------------------------------------------------------------------
// (2) Tutto intatto: l'hook deve BLOCCARE il segreto e dire quale.
// ---------------------------------------------------------------------------
test("tutto intatto, un segreto in stage: il commit e' rifiutato e il motivo e' scritto", () => {
  ripristina();
  stageConSegreto();
  const r = eseguiHook();
  assert.equal(r.codice, 1);
  assert.match(r.err, /COMMIT RIFIUTATO/);
  assert.match(r.err, /config\.txt:1/);
  assert.match(r.err, /stringa di connessione con credenziali/);
  assert.doesNotMatch(r.err, /Zq7/, 'il messaggio non deve ristampare la password');
});

// ---------------------------------------------------------------------------
// (3) I modi in cui il MODULO puo' rientrare a vuoto. Ognuno e' un guasto reale
//     gia' visto o misurato, non un caso di fantasia; per ognuno l'hook deve
//     rifiutare, e deve dire perche'.
// ---------------------------------------------------------------------------
// Il punto si cerca con un'espressione, non con un numero di riga: cosi' il banco
// resta puntato sul posto giusto anche quando il modulo cambia lunghezza.
const posizione = (espressione) => {
  const righe = sorgenteModulo.split('\n');
  const i = righe.findIndex((r) => espressione.test(r));
  assert.notEqual(i, -1, 'punto non trovato nel modulo: ' + espressione);
  return i;
};

const tronca = (righeTenute) => sorgenteModulo.split('\n').slice(0, righeTenute).join('\n');

const A_VUOTO = () => {
  const totale = sorgenteModulo.split('\n').length;
  return [
    ['file ASSENTE (clone parziale, cartella rinominata)', null],
    ['file di ZERO BYTE (checkout interrotto)', ''],
    ['file di SOLI SPAZI', '   \n\t\n  \n'],
    ['modulo sostituito da JavaScript valido e inerte', 'const x = 1;\n'],
    ['troncato al 25% del file', tronca(Math.floor(totale * 0.25))],
    ['troncato al 50% del file', tronca(Math.floor(totale * 0.5))],
    ['troncato al 75% del file', tronca(Math.floor(totale * 0.75))],
    ['troncato al 90% del file', tronca(Math.floor(totale * 0.9))],
    // Il punto STRUTTURALE piu' insidioso: subito DOPO la guardia sulla dimensione.
    // Il modulo ha fatto il controllo piu' debole — quello che dice solo «il file
    // non e' lungo zero» — e cade fuori dal file prima di lanciare la cintura.
    ['troncato subito dopo la guardia sulla dimensione', tronca(posizione(/dimensione === 0/) + 1)],
  ];
};

for (const [nome, contenuto] of A_VUOTO()) {
  test(`rientro a vuoto nel modulo: ${nome} -> commit rifiutato`, () => {
    ripristina();
    scrivi(modulo, contenuto);
    stageConSegreto();
    const r = eseguiHook();
    assert.equal(r.codice, 1, "l'hook ha ACCETTATO un commit senza controllo (" + nome + ')');
    assert.match(r.err, /\[BLOCCO\]/, 'ha rifiutato ma senza spiegare perche\'');
    assert.match(r.err, /--no-verify/, "ha rifiutato senza indicare la via d'uscita");
  });
}

// ---------------------------------------------------------------------------
// (3-bis) Il troncamento subito PRIMA della dichiarazione finale, con lo stage
//     PULITO. E' l'unico caso in cui la sentinella e' l'unica cosa che regge, e
//     va provato proprio cosi': col segreto in stage il modulo blocca comunque
//     (esce 1 dal ramo «ho trovato qualcosa», che viene prima), quindi quella
//     prova non direbbe niente sulla sentinella. Senza segreto, invece, il modulo
//     troncato cade fuori dal file, `node` esce 0 — e senza la sentinella il
//     commit passerebbe con la cintura girata a meta'.
// ---------------------------------------------------------------------------
test("troncato prima della dichiarazione finale, stage pulito: il commit e' rifiutato lo stesso", () => {
  ripristina();
  const righe = sorgenteModulo.split('\n');
  const i = righe.findIndex((r) => /^esci\(0\)/.test(r));
  assert.notEqual(i, -1, 'uscita pulita finale non trovata nel modulo');
  scrivi(modulo, righe.slice(0, i).join('\n'));
  stagePulito();
  const r = eseguiHook();
  assert.equal(r.codice, 1, "l'hook ha ACCETTATO un commit da un modulo che non ha dichiarato niente");
  assert.match(r.err, /\[BLOCCO\]/);
  assert.match(r.err, /non e' arrivato in fondo/);
  assert.match(r.err, /--no-verify/);
  ripristina();
});

// ---------------------------------------------------------------------------
// (4) Il LANCIATORE troncato. E' la domanda che ha aperto CRMA-102: il file che
//     fa da guardia e' anche lui troncabile. Qui si ripete la misura di allora,
//     riga per riga, in piccolo: ogni troncamento dentro il blocco `{ }` deve
//     produrre un rifiuto (errore di sintassi di `sh`, che esce diverso da zero).
//     Restano fuori solo i due punti che nessuna forma puo' coprire — file vuoto
//     e sola riga di shebang — dichiarati qui invece che lasciati impliciti.
// ---------------------------------------------------------------------------
test('lanciatore troncato: accettano solo il file vuoto e la sola riga di shebang', () => {
  ripristina();
  const righe = sorgenteLanciatore.split('\n');
  const accettati = [];
  for (let n = 0; n <= righe.length; n += 1) {
    scrivi(lanciatore, righe.slice(0, n).join('\n'));
    stageConSegreto();
    if (eseguiHook().codice === 0) accettati.push(n);
  }
  ripristina();
  assert.deepEqual(
    accettati, [0, 1],
    'i punti di troncamento che accettano un commit col segreto devono essere solo\n' +
      '  il file vuoto (0 righe) e la sola riga di shebang (1 riga). Trovati: ' +
      JSON.stringify(accettati) + '.\n' +
      "  Se ce ne sono altri, il blocco `{ }` del lanciatore e' stato aperto: rimettilo.",
  );
});

// ---------------------------------------------------------------------------
// (5) `node` che non c'e' non e' un modulo troncato, e il messaggio deve saperlo
//     dire: e' l'unica ragione per cui il lanciatore guarda anche il codice di
//     uscita. Un `node` assente non stampa nessuna sentinella, e accusare il
//     modulo di essere troncato manderebbe a cercare il guasto nel file sbagliato.
// ---------------------------------------------------------------------------
test("node assente: il commit e' rifiutato, e il motivo non incolpa il modulo", () => {
  ripristina();
  stageConSegreto();
  const r = eseguiHook({ ...process.env, PATH: '/nessun-percorso-utile' });
  assert.equal(r.codice, 1);
  assert.match(r.err, /non ha potuto girare/);
  assert.doesNotMatch(r.err, /non e' arrivato in fondo/);
  assert.match(r.err, /--no-verify/);
});

// ---------------------------------------------------------------------------
// (6) Le due copie della sentinella devono essere la stessa stringa. La si ricava
//     DALLA BOCCA DEL MODULO — cioe' da cio' che stampa davvero, non da una
//     costante riletta — e la si cerca nel lanciatore. Se qualcuno cambia una
//     delle due e non l'altra, l'hook comincerebbe a rifiutare ogni commit:
//     questo e' il test che lo dice prima, con il motivo scritto.
// ---------------------------------------------------------------------------
test("la sentinella che il modulo stampa e' la stessa che il lanciatore pretende", () => {
  ripristina();
  stagePulito();
  const r = spawnSync(process.execPath, ['scripts/hook/pre-commit.mjs'], { cwd: repo, encoding: 'utf8' });
  assert.equal(r.status, 0);

  const righe = r.stdout.split('\n').filter((l) => l.trim() !== '');
  assert.equal(righe.length, 1, "su stdout deve esserci SOLO la sentinella, il lanciatore lo cattura");
  const sentinella = righe[0];

  const hook = fs.readFileSync(path.join(RADICE, '.githooks/pre-commit'), 'utf8');
  assert.ok(
    hook.includes('*"' + sentinella + '"*'),
    'il lanciatore non pretende la sentinella che il modulo stampa (' + JSON.stringify(sentinella) +
      '): le due copie si sono separate, e l\'hook sta rifiutando ogni commit.',
  );
});

// ---------------------------------------------------------------------------
// (7) La sentinella si stampa su TUTTE le uscite volute, non solo su quella
//     pulita: e' quello che permette al lanciatore di pretenderla sempre e di
//     dare il messaggio giusto anche a un troncamento che rompe la sintassi.
// ---------------------------------------------------------------------------
test("la sentinella c'e' anche sull'uscita che blocca", () => {
  ripristina();
  stageConSegreto();
  const r = spawnSync(process.execPath, ['scripts/hook/pre-commit.mjs'], { cwd: repo, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /pre-commit: arrivato in fondo/);
});

// ---------------------------------------------------------------------------
// (8) Un commit VERO, non l'hook lanciato a mano: e' l'unica prova che git
//     esegue davvero questo file e che l'esito arriva fino in fondo alla catena.
// ---------------------------------------------------------------------------
test("un commit vero con un segreto in stage viene rifiutato, uno pulito passa", () => {
  ripristina();

  stageConSegreto();
  const conSegreto = spawnSync('git', ['commit', '-m', 'prova col segreto'], {
    cwd: repo, encoding: 'utf8',
  });
  assert.notEqual(conSegreto.status, 0, 'git ha ACCETTATO un commit con un segreto in stage');
  assert.match(conSegreto.stderr, /COMMIT RIFIUTATO/);
  assert.equal(
    git('log', '--oneline').trim().split('\n').length, 1,
    "il commit col segreto non deve essere finito nella storia",
  );

  stagePulito();
  const pulito = spawnSync('git', ['commit', '-m', 'prova pulita'], { cwd: repo, encoding: 'utf8' });
  assert.equal(pulito.status, 0, 'git ha RIFIUTATO un commit pulito: ' + pulito.stderr);
});
