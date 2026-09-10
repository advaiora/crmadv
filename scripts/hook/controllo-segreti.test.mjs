// Il banco della CINTURA INTERA: non le funzioni pure (quelle hanno il loro banco in
// `segnaposto.test.mjs`), ma la domanda «con questo modulo sul disco, l'hook accetta
// o rifiuta il commit?». Si risponde a quella domanda nel solo modo che conta: un
// repository usa-e-getta, `.githooks/pre-commit` eseguito davvero, il codice di uscita.
//
// PERCHE' ESISTE (compito CRMA-100). La guardia contro il «rientro a vuoto» — il commit
// che passa senza che nessun controllo sia girato — e' stata chiusa tre volte e tre volte
// e' rimasta aperta, ogni volta in una forma nuova: `cat` assente (CRMA-85), modulo di
// zero byte (CRMA-93), modulo TRONCATO A META' o di soli spazi (CRMA-100). Le prime due
// volte la prova era una misura fatta a mano, in un run che poi si e' chiuso portandosela
// via; la terza volta il buco e' stato ritrovato da zero. Questo file e' il posto dove la
// misura smette di andare persa.
//
// Il numero che ha aperto CRMA-100, misurato il 10/9/2026 sulla punta di CRMA-93:
// troncando il modulo a ognuna delle sue 187 righe, una alla volta, **104 troncamenti
// producevano un file che l'hook ACCETTAVA** (86 senza stampare nulla). Dopo la
// sentinella: 0 su 216. Il banco qui sotto ne ricontrolla un campione — non tutti e 216,
// che costerebbero una trentina di secondi a ogni `npm run test:scripts` — scegliendo i
// punti per POSIZIONE STRUTTURALE invece che per numero di riga, cosi' restano quelli
// giusti anche quando il modulo cambia lunghezza.
//
// ⚠️ Il caso 1 e' il piu' importante di tutti, ed e' quello che si dimentica: un guasto
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
let sorgenteModulo = '';

/** Esegue l'hook nel repository di prova. Torna codice di uscita, stdout e stderr. */
const eseguiHook = (ambiente = undefined) => {
  // `/bin/sh` per percorso assoluto: uno dei casi qui sotto svuota il PATH, e con
  // il nome nudo non si troverebbe nemmeno la shell.
  const r = spawnSync('/bin/sh', ['.githooks/pre-commit'], {
    cwd: repo, encoding: 'utf8', env: ambiente ?? process.env,
  });
  return { codice: r.status, out: r.stdout ?? '', err: r.stderr ?? '' };
};

/** Riscrive il modulo con `contenuto`. Passare `null` per farlo sparire del tutto. */
const scriviModulo = (contenuto) => {
  if (contenuto === null) fs.rmSync(modulo, { force: true });
  else fs.writeFileSync(modulo, contenuto);
};

const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });

before(() => {
  banco = fs.mkdtempSync(path.join(os.tmpdir(), 'controllo-segreti-'));
  repo = path.join(banco, 'repo');
  fs.mkdirSync(path.join(repo, '.githooks'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'scripts', 'hook'), { recursive: true });

  fs.copyFileSync(path.join(RADICE, '.githooks/pre-commit'), path.join(repo, '.githooks/pre-commit'));
  for (const f of fs.readdirSync(path.join(RADICE, 'scripts/hook'))) {
    fs.copyFileSync(path.join(RADICE, 'scripts/hook', f), path.join(repo, 'scripts/hook', f));
  }
  modulo = path.join(repo, 'scripts/hook/controllo-segreti.mjs');
  sorgenteModulo = fs.readFileSync(modulo, 'utf8');

  execFileSync('git', ['init', '-q', repo], { encoding: 'utf8' });
  git('config', 'user.name', 'banco');
  git('config', 'user.email', 'banco@example.invalid');
  git('config', 'core.hooksPath', '.githooks');
  // Un commit di partenza, cosi' HEAD esiste come in un repository vero. Il file col
  // segreto NON deve essere in stage adesso, o se lo porterebbe dentro il commit e il
  // diff da controllare resterebbe vuoto (sbagliato una volta il 10/9/2026).
  fs.writeFileSync(path.join(repo, 'README.md'), 'banco\n');
  git('add', 'README.md');
  git('-c', 'core.hooksPath=/dev/null', 'commit', '-q', '-m', 'partenza');
});

after(() => {
  if (banco) fs.rmSync(banco, { recursive: true, force: true });
});

// ⚠️ In stage va SOLO il file di prova. L'hook e il modulo li legge dall'albero di
// lavoro, non dall'indice: metterli in stage non serve a niente e fa litigare `git`
// con le riscritture del modulo che ogni caso qui sotto esegue.
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
// (1) Il modulo intatto: la cintura deve LASCIAR PASSARE il lavoro pulito.
//     Se salta questo, l'hook rifiuta ogni commit del progetto.
// ---------------------------------------------------------------------------
test('modulo intatto, niente di sospetto in stage: il commit passa', () => {
  scriviModulo(sorgenteModulo);
  stagePulito();
  const r = eseguiHook();
  assert.equal(r.codice, 0, 'l\'hook doveva accettare, ha stampato: ' + r.err);
});

// ---------------------------------------------------------------------------
// (2) Il modulo intatto: la cintura deve BLOCCARE il segreto e dire quale.
// ---------------------------------------------------------------------------
test('modulo intatto, un segreto in stage: il commit e\' rifiutato e il motivo e\' scritto', () => {
  scriviModulo(sorgenteModulo);
  stageConSegreto();
  const r = eseguiHook();
  assert.equal(r.codice, 1);
  assert.match(r.err, /COMMIT RIFIUTATO/);
  assert.match(r.err, /config\.txt:1/);
  assert.match(r.err, /stringa di connessione con credenziali/);
  assert.doesNotMatch(r.err, /Zq7/, 'il messaggio non deve ristampare la password');
});

// ---------------------------------------------------------------------------
// (3) I modi di rientrare a vuoto. Ognuno e' un guasto REALE gia' visto o
//     misurato, non un caso di fantasia; per ognuno l'hook deve rifiutare.
// ---------------------------------------------------------------------------
// Il punto si cerca con un'espressione, non con una stringa esatta: cosi' il banco
// resta puntato sul posto giusto se un domani `esci()` cambia nome, e — cosa che
// serve subito — si puo' lanciare anche contro la forma PRECEDENTE del modulo, che
// usciva con `process.exit(1)`. Un banco che non gira sul codice rotto non dimostra
// di aver chiuso niente.
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
    ['file di ZERO BYTE (checkout interrotto) — CRMA-93', ''],
    ['file di SOLI SPAZI — CRMA-100', '   \n\t\n  \n'],
    ['modulo sostituito da JavaScript valido e inerte', 'const x = 1;\n'],
    ['troncato al 10% del file', tronca(Math.floor(totale * 0.1))],
    ['troncato al 25% del file', tronca(Math.floor(totale * 0.25))],
    ['troncato al 50% del file', tronca(Math.floor(totale * 0.5))],
    ['troncato al 75% del file', tronca(Math.floor(totale * 0.75))],
    ['troncato al 90% del file', tronca(Math.floor(totale * 0.9))],
    // I due punti STRUTTURALI, i piu' insidiosi dei 104 misurati in CRMA-100:
    //  - subito DOPO l'uscita pulita: il modulo raccoglie i riscontri, non li
    //    stampa, cade fuori dal file e uscirebbe 0 col segreto in stage;
    //  - subito PRIMA dell'uscita che blocca: ha perfino cominciato a stampare
    //    l'elenco dei riscontri, e poi uscirebbe 0 lo stesso.
    ['troncato subito dopo l\'uscita pulita', tronca(posizione(/riscontri\.length === 0/) + 1)],
    ['troncato subito prima dell\'uscita che blocca', tronca(posizione(/^\s*(esci|process\.exit)\(1\)/))],
  ];
};

for (const [nome, contenuto] of A_VUOTO()) {
  test(`rientro a vuoto: ${nome} -> commit rifiutato`, () => {
    scriviModulo(contenuto);
    stageConSegreto();
    const r = eseguiHook();
    assert.equal(r.codice, 1, 'l\'hook ha ACCETTATO un commit senza controllo (' + nome + ')');
    assert.match(r.err, /\[BLOCCO\]/, 'ha rifiutato ma senza spiegare perche\'');
    assert.match(r.err, /--no-verify/, 'ha rifiutato senza indicare la via d\'uscita');
  });
}

// ---------------------------------------------------------------------------
// (3-bis) `node` che non c'e' non e' un modulo troncato, e il messaggio deve
//     saperlo dire: e' l'unica ragione per cui l'hook guarda il codice di uscita
//     PRIMA della sentinella. Un `node` assente non stampa nessuna sentinella, e
//     accusare il modulo di essere troncato manderebbe a cercare il guasto nel
//     file sbagliato.
// ---------------------------------------------------------------------------
test('node assente: il commit e\' rifiutato, e il motivo non incolpa il modulo', () => {
  scriviModulo(sorgenteModulo);
  stageConSegreto();
  const r = eseguiHook({ ...process.env, PATH: '/nessun-percorso-utile' });
  assert.equal(r.codice, 1);
  assert.match(r.err, /non ha potuto girare/);
  assert.doesNotMatch(r.err, /non e' arrivato in fondo/);
});

// ---------------------------------------------------------------------------
// (4) Le due copie della sentinella devono essere la stessa stringa.
//     La si ricava DALLA BOCCA DEL MODULO — cioe' da cio' che stampa davvero,
//     non da una costante riletta — e la si cerca nell'hook. Se qualcuno cambia
//     una delle due e non l'altra, l'hook comincerebbe a rifiutare ogni commit:
//     questo e' il test che lo dice prima, con il motivo scritto.
// ---------------------------------------------------------------------------
test('la sentinella che il modulo stampa e\' la stessa che l\'hook pretende', () => {
  scriviModulo(sorgenteModulo);
  stagePulito();
  const r = spawnSync('node', ['scripts/hook/controllo-segreti.mjs'], { cwd: repo, encoding: 'utf8' });
  assert.equal(r.status, 0);

  const righe = r.stdout.split('\n').filter((l) => l.trim() !== '');
  assert.equal(righe.length, 1, 'su stdout deve esserci SOLO la sentinella, l\'hook lo cattura');
  const sentinella = righe[0];

  const hook = fs.readFileSync(path.join(RADICE, '.githooks/pre-commit'), 'utf8');
  assert.ok(
    hook.includes('SENTINELLA_ATTESA="' + sentinella + '"'),
    'l\'hook non pretende la sentinella che il modulo stampa (' + JSON.stringify(sentinella) +
      '): le due copie si sono separate, e l\'hook sta rifiutando ogni commit.',
  );
});

// ---------------------------------------------------------------------------
// (5) La sentinella si stampa su TUTTE le uscite volute, non solo su quella
//     pulita: e' quello che permette all'hook di pretenderla sempre e di dare
//     il messaggio giusto anche a un troncamento che rompe la sintassi.
// ---------------------------------------------------------------------------
test('la sentinella c\'e\' anche sull\'uscita che blocca', () => {
  scriviModulo(sorgenteModulo);
  stageConSegreto();
  const r = spawnSync('node', ['scripts/hook/controllo-segreti.mjs'], { cwd: repo, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /arrivato in fondo/);
});
