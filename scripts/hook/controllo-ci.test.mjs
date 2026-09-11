// Il banco del CONTROLLO IN CI: la domanda «questo push, fatto scavalcando l'hook
// locale, risulta rosso o verde?». Si risponde nel solo modo che conta — un
// repository usa-e-getta, due rami veri, `git commit --no-verify` vero, il modulo
// eseguito davvero e il suo codice di uscita.
//
// PERCHE' ESISTE (compito CRMA-159). Il controllo in CI e' l'ultimo anello: se lui
// rientra a vuoto non c'e' nessun altro dietro, e per giunta il suo esito lo guarda
// una spia verde su GitHub invece di un terminale davanti a una persona. La classe
// di guasti da coprire e' quindi la stessa dell'hook locale — modulo assente, vuoto,
// di soli spazi, troncato a meta' — piu' una che qui e' nuova: la BASE del confronto
// scelta male, che non fa rumore e riduce a zero le righe controllate.
//
// ⚠️ Il caso (1) e' il piu' importante di tutti, ed e' quello che si dimentica: un
// guasto nella sentinella non si manifesta come un segreto che passa, ma come OGNI
// PUSH ROSSO. Se salta quello, il controllo e' inservibile per tutti e la prima
// reazione sara' spegnerlo.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';

const RADICE = path.resolve(import.meta.dirname, '..', '..');
const WORKFLOW = '.github/workflows/controllo-segreti.yml';

// Un segreto che le regole riconoscono per certo: ne' l'utente ne' la password sono
// segnaposto, quindi `eSegnaposto` non lo salva. Composto a pezzi per non lasciare
// in giro una stringa che somigli a una credenziale vera (nota operativa #87).
const SEGRETO = 'postgresql://mario:' + 'Zq7' + 'rT4wPl9xNb2c' + '@db.interno:5432/crm';

let banco = '';
let repo = '';
let moduloCi = '';
let moduloSegreti = '';
let sorgenteCi = '';
let sorgenteSegreti = '';

const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();

/** Esegue il controllo in CI nel repository di prova. Torna codice di uscita, stdout e stderr. */
const eseguiControllo = (baseDichiarata = '') => {
  const r = spawnSync(process.execPath, ['scripts/hook/controllo-ci.mjs'], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, BASE_DICHIARATA: baseDichiarata },
  });
  return { codice: r.status, out: r.stdout ?? '', err: r.stderr ?? '' };
};

/** Riscrive un file del banco. Passare `null` per farlo sparire del tutto. */
const scrivi = (dove, contenuto) => {
  if (contenuto === null) fs.rmSync(dove, { force: true });
  else fs.writeFileSync(dove, contenuto);
};

const ripristina = () => {
  scrivi(moduloCi, sorgenteCi);
  scrivi(moduloSegreti, sorgenteSegreti);
};

/**
 * Riporta il banco al punto di partenza: `main` con un commit pulito, e il ramo
 * `lavoro` che ne discende. Ogni prova lo rifa', perche' il modulo SPOSTA HEAD (e'
 * il modo in cui ricostruisce lo stage) e lascerebbe il repository al punto in cui
 * l'ha lasciato la prova precedente.
 */
const preparaRami = () => {
  // `-f` e `--hard` non sono prudenza di troppo: il modulo in CI sposta HEAD e
  // lascia l'indice pieno (e' il modo in cui ricostruisce lo stage), e alcune prove
  // qui sotto rompono i file di proposito. Senza la mano pesante ogni prova
  // erediterebbe i resti della precedente.
  git('checkout', '-q', '-f', '--detach', 'radice');
  git('reset', '-q', '--hard', 'radice');
  git('branch', '-q', '-f', 'main', 'radice');
  git('branch', '-q', '-f', 'lavoro', 'radice');
  git('checkout', '-q', '-f', 'lavoro');
  ripristina();
};

/** Committa un file scavalcando l'hook, cioe' il caso che questo controllo deve intercettare. */
const committaScavalcando = (percorso, contenuto) => {
  const dove = path.join(repo, percorso);
  fs.mkdirSync(path.dirname(dove), { recursive: true });
  fs.writeFileSync(dove, contenuto);
  git('add', percorso);
  git('commit', '-q', '--no-verify', '-m', `aggiunge ${percorso}`);
};

before(() => {
  banco = fs.mkdtempSync(path.join(os.tmpdir(), 'controllo-ci-'));
  repo = path.join(banco, 'repo');
  fs.mkdirSync(path.join(repo, '.githooks'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'scripts', 'hook'), { recursive: true });

  // Il codice VERO del repository, non una copia semplificata: e' l'unico modo per
  // cui questo banco si accorge di una modifica che rompe il controllo.
  fs.copyFileSync(path.join(RADICE, '.githooks/pre-commit'), path.join(repo, '.githooks/pre-commit'));
  fs.chmodSync(path.join(repo, '.githooks/pre-commit'), 0o755);
  for (const nome of ['controllo-ci.mjs', 'controllo-segreti.mjs', 'pre-commit.mjs', 'segnaposto.mjs']) {
    fs.copyFileSync(path.join(RADICE, 'scripts/hook', nome), path.join(repo, 'scripts/hook', nome));
  }
  moduloCi = path.join(repo, 'scripts/hook/controllo-ci.mjs');
  moduloSegreti = path.join(repo, 'scripts/hook/controllo-segreti.mjs');
  sorgenteCi = fs.readFileSync(moduloCi, 'utf8');
  sorgenteSegreti = fs.readFileSync(moduloSegreti, 'utf8');

  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'banco@esempio.test');
  git('config', 'user.name', 'Banco');
  git('add', '-A');
  git('commit', '-q', '-m', 'radice');
  // Il bit di esecuzione che conta e' quello REGISTRATO nel commit, non quello sul
  // disco: e' quello che il modulo guarda, ed e' quello che ogni clone si ritrova.
  // Il `chmod` fatto prima di `git add` basta a registrarlo — se un domani non
  // bastasse piu', questo banco lo direbbe subito invece di provare un caso finto.
  assert.match(
    git('ls-tree', 'HEAD', '--', '.githooks/pre-commit'),
    /^100755 /,
    'il banco non e\' partito da un lanciatore eseguibile: le prove sul bit +x non proverebbero niente',
  );
  git('branch', 'radice');
  git('branch', 'lavoro');
});

after(() => { if (banco) fs.rmSync(banco, { recursive: true, force: true }); });

// ---------------------------------------------------------------------------
// (1) IL CASO PIU' IMPORTANTE: su un ramo pulito il controllo e' VERDE.
//     Un controllo che sbaglia in questo verso non protegge nessuno — viene
//     spento entro la settimana, ed e' la fine piu' comune di una cintura di
//     sicurezza.
// ---------------------------------------------------------------------------
test('ramo pulito: verde', () => {
  preparaRami();
  committaScavalcando('server/servizio.ts', 'export const saluta = () => "ciao";\n');

  const r = eseguiControllo();
  assert.equal(r.codice, 0, `un ramo senza segreti deve essere verde.\nstdout:\n${r.out}\nstderr:\n${r.err}`);
  assert.ok(r.out.includes('controllo-ci: arrivato in fondo'), 'manca la sentinella sull\'uscita pulita');
});

// ---------------------------------------------------------------------------
// (2) LA MISURA DI PROVA DEL COMPITO: un segreto vero, committato scavalcando
//     l'hook locale con `--no-verify`, deve risultare ROSSO.
// ---------------------------------------------------------------------------
test('segreto committato con --no-verify: rosso', () => {
  preparaRami();
  committaScavalcando('server/configurazione.ts', `export const DB = "${SEGRETO}";\n`);

  const r = eseguiControllo();
  assert.equal(r.codice, 1, `un segreto spinto deve essere rosso.\nstdout:\n${r.out}\nstderr:\n${r.err}`);
  assert.ok(
    r.err.includes('server/configurazione.ts'),
    'il messaggio deve nominare il file dov\'e\' il riscontro',
  );
});

// ---------------------------------------------------------------------------
// (3) Il segreto NON viene ristampato nel registro. I registri di CI sono spesso
//     leggibili piu' largamente del repository: un controllo che ristampa il
//     valore lo pubblica una seconda volta, in un posto che nessuno pensa a
//     ripulire.
// ---------------------------------------------------------------------------
test('il valore del segreto non finisce nel registro', () => {
  preparaRami();
  committaScavalcando('server/configurazione.ts', `export const DB = "${SEGRETO}";\n`);

  const r = eseguiControllo();
  const tutto = r.out + r.err;
  assert.equal(r.codice, 1);
  assert.ok(!tutto.includes(SEGRETO), 'il segreto intero e\' finito nel registro del controllo');
  assert.ok(!tutto.includes('Zq7' + 'rT4wPl9xNb2c'), 'la password e\' finita nel registro del controllo');
});

// ---------------------------------------------------------------------------
// (4) Il segreto entrato QUALCHE COMMIT FA, e mai piu' toccato, resta rosso:
//     il confronto parte dal tronco comune con `main`, non dall'ultimo commit.
//     E' il caso che un confronto «solo l'ultimo push» perderebbe, ed e' anche
//     quello che si verifica davvero — il segreto lo si nota dopo.
// ---------------------------------------------------------------------------
test('segreto in un commit precedente del ramo: rosso lo stesso', () => {
  preparaRami();
  committaScavalcando('server/configurazione.ts', `export const DB = "${SEGRETO}";\n`);
  const dopoIlSegreto = git('rev-parse', 'HEAD');
  committaScavalcando('server/altro.ts', 'export const x = 1;\n');

  // Anche dichiarando come base il commit SUCCESSIVO al segreto — cioe' il caso
  // «questo push aggiunge solo l'ultimo commit» — il riscontro non deve sfuggire.
  const r = eseguiControllo(dopoIlSegreto);
  assert.equal(r.codice, 1, `il segreto piu' vecchio nel ramo deve restare rosso.\nstderr:\n${r.err}`);
});

// ---------------------------------------------------------------------------
// (4-bis) Il push su `main`, dove la base va cercata al contrario. Sul ramo
//     principale il tronco comune con `main` E' la punta, quindi un confronto
//     basato solo su quello darebbe un diff vuoto — cioe' VERDE per assenza di
//     righe da guardare, su tutto cio' che arriva su `main`. E' il guasto piu'
//     silenzioso che questo modulo possa avere, e non si vedrebbe mai.
// ---------------------------------------------------------------------------
test('segreto spinto direttamente su main: rosso', () => {
  preparaRami();
  git('checkout', '-q', '-f', 'main');
  const prima = git('rev-parse', 'HEAD');
  committaScavalcando('server/configurazione.ts', `export const DB = "${SEGRETO}";\n`);

  const r = eseguiControllo(prima);
  assert.equal(r.codice, 1, `un segreto spinto su main deve essere rosso.\nstdout:\n${r.out}\nstderr:\n${r.err}`);
  assert.ok(r.err.includes('server/configurazione.ts'), 'il messaggio deve nominare il file');
});

// ---------------------------------------------------------------------------
// (5) La sentinella pretesa dal modulo: se il controllo sui segreti e' assente,
//     vuoto, di soli spazi o TRONCATO A META', il controllo va rosso e non
//     verde. E' l'intera ragione per cui la sentinella esiste (CRMA-100): un
//     file troncato resta JavaScript valido, gira, non controlla niente ed esce 0.
// ---------------------------------------------------------------------------
const troncaAlla = (sorgente, ago) => {
  const dove = sorgente.indexOf(ago);
  assert.notEqual(dove, -1, `il banco cerca un punto che nel modulo non c'e' piu': ${ago}`);
  return sorgente.slice(0, dove);
};

const MODULO_ROTTO = [
  ['assente', () => null],
  ['vuoto', () => ''],
  ['di soli spazi', () => '   \n\n\t\n'],
  // Troncato DOPO la raccolta dei riscontri ma PRIMA della stampa e dell'uscita:
  // e' il troncamento cattivo, quello che resta sintatticamente valido e che esce
  // 0 senza dire niente. Scelto per posizione strutturale e non per numero di
  // riga, cosi' resta il punto giusto anche quando il modulo cambia lunghezza.
  ['troncato prima di concludere', (s) => troncaAlla(s, 'if (riscontri.length === 0)')],
  // Troncato a meta' di una stringa: rompe la sintassi, `node` esce 1. Senza la
  // sentinella finirebbe nel ramo «ho trovato un segreto», cioe' rosso ma con il
  // messaggio sbagliato, che manda a cercare il guasto nel file sbagliato.
  ['troncato dentro una stringa', (s) => `${troncaAlla(s, 'const SENTINELLA =')}const SENTINELLA = 'controllo`],
];

for (const [come, rompi] of MODULO_ROTTO) {
  test(`controllo-segreti.mjs ${come}: rosso, non verde`, () => {
    preparaRami();
    committaScavalcando('server/servizio.ts', 'export const saluta = () => "ciao";\n');
    scrivi(moduloSegreti, rompi(sorgenteSegreti));

    const r = eseguiControllo();
    assert.equal(
      r.codice, 1,
      `con il modulo dei segreti ${come} il controllo e' passato VERDE: e' un rientro a vuoto.`
        + `\nstdout:\n${r.out}\nstderr:\n${r.err}`,
    );
    assert.ok(r.out.includes('controllo-ci: arrivato in fondo'), 'manca la sentinella del controllo in CI');
    ripristina();
  });
}

// ---------------------------------------------------------------------------
// (6) L'integrita' del primo filtro, letta dal commit: un push che cancella il
//     lanciatore locale, o che gli toglie il bit di esecuzione, va rosso. Il
//     secondo caso e' quello che conta di piu', perche' git salta un hook non
//     eseguibile IN SILENZIO: nessun messaggio, nessun errore, commit accettato.
// ---------------------------------------------------------------------------
test('il lanciatore locale cancellato: rosso', () => {
  preparaRami();
  git('rm', '-q', '.githooks/pre-commit');
  git('commit', '-q', '--no-verify', '-m', 'toglie il lanciatore');

  const r = eseguiControllo();
  assert.equal(r.codice, 1, 'senza lanciatore locale il controllo deve essere rosso');
  assert.ok(r.err.includes('.githooks/pre-commit'), 'il messaggio deve nominare il file mancante');
});

test('il lanciatore locale senza bit di esecuzione: rosso', () => {
  preparaRami();
  git('update-index', '--chmod=-x', '.githooks/pre-commit');
  git('commit', '-q', '--no-verify', '-m', 'toglie il bit di esecuzione');

  const r = eseguiControllo();
  assert.equal(r.codice, 1, 'un hook non eseguibile viene saltato in silenzio: deve essere rosso');
  assert.ok(r.err.includes('100755'), 'il messaggio deve dire quale modo ci si aspetta');
});

test('un modulo dell\'hook cancellato: rosso', () => {
  preparaRami();
  git('rm', '-q', 'scripts/hook/segnaposto.mjs');
  git('commit', '-q', '--no-verify', '-m', 'toglie un modulo');

  const r = eseguiControllo();
  assert.equal(r.codice, 1, 'senza i moduli l\'hook locale non puo\' girare: deve essere rosso');
  assert.ok(r.err.includes('segnaposto.mjs'), 'il messaggio deve nominare il modulo mancante');
});

// ---------------------------------------------------------------------------
// (7) Una base dichiarata inutilizzabile non deve azzerare il controllo in
//     silenzio. E' il guasto specifico di questo anello: con la base sbagliata
//     il diff e' vuoto, non c'e' nessun errore, e il controllo e' VERDE per
//     assenza di righe da guardare invece che per assenza di segreti.
// ---------------------------------------------------------------------------
test('base dichiarata che non esiste nel clone: ripiega e resta rosso', () => {
  preparaRami();
  committaScavalcando('server/configurazione.ts', `export const DB = "${SEGRETO}";\n`);

  const r = eseguiControllo('0'.repeat(40));
  assert.equal(r.codice, 1, 'con una base di soli zeri (ramo nuovo) il segreto deve restare rosso');
});

test('base dichiarata che non e\' antenata della punta: ripiega e resta rosso', () => {
  preparaRami();
  committaScavalcando('server/configurazione.ts', `export const DB = "${SEGRETO}";\n`);
  // Un commit su un altro ramo: esiste, ma non e' antenato della punta. E' cio' che
  // si vede dopo un push forzato.
  git('checkout', '-q', '-b', 'altrove', 'radice');
  committaScavalcando('server/estraneo.ts', 'export const y = 2;\n');
  const estraneo = git('rev-parse', 'HEAD');
  git('checkout', '-q', 'lavoro');

  const r = eseguiControllo(estraneo);
  assert.equal(r.codice, 1, 'con una base non antenata il segreto deve restare rosso');
  git('branch', '-q', '-D', 'altrove');
});

// ---------------------------------------------------------------------------
// (8) Le copie scritte a mano delle sentinelle. Sono tre file che non si
//     importano a vicenda — un modulo `.mjs`, un altro modulo `.mjs` e un
//     passo `shell` dentro uno YAML — e se le stringhe si separano il
//     controllo va rosso SEMPRE. Guasto rumoroso, non silenzioso: il verso
//     giusto. Questo banco e' il posto dove ci si accorge della separazione
//     prima che succeda in CI.
// ---------------------------------------------------------------------------
test('il modulo in CI pretende la sentinella che il controllo sui segreti stampa', () => {
  const sentinella = /const SENTINELLA = '([^']+)'/.exec(sorgenteSegreti)?.[1];
  assert.ok(sentinella, 'non trovo la sentinella dichiarata in controllo-segreti.mjs');
  assert.ok(
    sorgenteCi.includes(`SENTINELLA_SEGRETI = '${sentinella}'`),
    `scripts/hook/controllo-ci.mjs non pretende la sentinella che il modulo stampa (${JSON.stringify(sentinella)}):`
      + ' le due copie si sono separate, e il controllo sta dando rosso a ogni push.',
  );
});

test('il workflow pretende la sentinella che il modulo in CI stampa', () => {
  const sentinella = /const SENTINELLA = '([^']+)'/.exec(sorgenteCi)?.[1];
  assert.ok(sentinella, 'non trovo la sentinella dichiarata in controllo-ci.mjs');
  const workflow = fs.readFileSync(path.join(RADICE, WORKFLOW), 'utf8');
  assert.ok(
    workflow.includes(`*"${sentinella}"*`),
    `${WORKFLOW} non pretende la sentinella che il modulo stampa (${JSON.stringify(sentinella)}):`
      + ' le due copie si sono separate.',
  );
});

// ---------------------------------------------------------------------------
// (9) La sentinella si stampa su TUTTE le uscite volute, non solo su quella
//     pulita: e' quello che permette al workflow di pretenderla sempre e di dare
//     il messaggio giusto anche a un troncamento che rompe la sintassi.
// ---------------------------------------------------------------------------
test('la sentinella c\'e\' anche sull\'uscita che va rossa', () => {
  preparaRami();
  committaScavalcando('server/configurazione.ts', `export const DB = "${SEGRETO}";\n`);

  const r = eseguiControllo();
  assert.equal(r.codice, 1);
  assert.ok(
    r.out.includes('controllo-ci: arrivato in fondo'),
    'senza la sentinella sull\'uscita rossa il workflow non distingue «ho trovato un segreto»'
      + ' da «il modulo si e\' rotto a meta\'»',
  );
});

// ---------------------------------------------------------------------------
// (10) `cancel-in-progress` non deve annullare i giri su `main`. E' un guasto
//      che nessuna prova sul modulo puo' vedere — sta nello YAML, non nel
//      codice — e la prova (9) del banco lo dimostra all'incontrario: su `main`
//      la base e' quella dichiarata dall'evento, quindi il giro sul push B
//      guarda SOLO A..B. Se il giro su A viene annullato, il contenuto di A non
//      lo guarda nessuno, e un giro annullato non e' nemmeno rosso: e'
//      `cancelled`. Bastano due unioni a pochi secondi di distanza.
//
//      Queste righe esistono perche' la condizione non torni la costante `true`
//      «per semplificare»: la semplificazione e' invisibile e riapre il buco per
//      cui questo intero compito esiste.
// ---------------------------------------------------------------------------
test('il workflow non annulla i giri in corso su main', () => {
  const workflow = fs.readFileSync(path.join(RADICE, WORKFLOW), 'utf8');
  const righe = workflow
    .split('\n')
    .filter((riga) => /^\s*cancel-in-progress\s*:/.test(riga));

  // Nessuna riga e' un esito legittimo: il valore di serie e' `false`, cioe' i
  // giri non si annullano mai e su `main` non si perde niente.
  if (righe.length === 0) return;

  assert.equal(righe.length, 1, `mi aspetto una sola riga cancel-in-progress in ${WORKFLOW}`);
  const valore = righe[0].split(':').slice(1).join(':').trim();

  assert.notEqual(
    valore,
    'true',
    `${WORKFLOW}: cancel-in-progress e' tornato la costante \`true\`. Su \`main\` il giro`
      + ' annullato e\' l\'unico che avrebbe guardato quel commit, perche\' li\' la base e\''
      + ' quella dichiarata dall\'evento: due unioni a pochi secondi di distanza fanno'
      + ' sparire il contenuto della prima.',
  );

  assert.ok(
    valore.includes('refs/heads/main'),
    `${WORKFLOW}: cancel-in-progress deve escludere \`main\` nominandolo`
      + ` (atteso qualcosa come \${{ github.ref != 'refs/heads/main' }}), trovato invece`
      + ` ${JSON.stringify(valore)}.`,
  );
});
