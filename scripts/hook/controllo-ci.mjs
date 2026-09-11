// Il controllo sui segreti che gira SU CODICE GIA' SPINTO, non sulla macchina di chi
// committa. Lo chiama `.github/workflows/controllo-segreti.yml`. Esce 0 se e' tutto
// pulito, 1 se il controllo va rosso.
//
// ⚠️ PERCHE' ESISTE, quando un hook pre-commit c'e' gia' (compito CRMA-159).
// Un controllo locale non puo', per costruzione, difendersi dal proprio non essere
// invocato. Verificato dal Guardiano l'11/9/2026 sul codice vero, con `git commit`
// veri e un segreto vero: se `.githooks/pre-commit` non esiste, git non chiama
// nessun hook e **il segreto entra nel commit**. Non e' un lanciatore che fallisce
// permissivamente — e' un lanciatore che non viene mai chiamato, e nessuna forma di
// quel file puo' coprirlo. Lo stesso vale, identico, per chi non ha mai dato
// `git config core.hooksPath .githooks` su quel clone (non e' mai stato protetto),
// per un hook che ha perso il bit `+x` (git lo salta IN SILENZIO), e per la via
// d'uscita dichiarata `git commit --no-verify`.
//
// Questo controllo e' il SECONDO filtro, non il sostituto del primo: l'hook locale
// resta, ed e' quello che da' il riscontro immediato mentre si lavora, prima che il
// segreto lasci la macchina. Qui si intercetta cio' che quel filtro non ha visto.
//
// ⚠️ NON DUPLICA LE REGOLE. Il controllo vero e' sempre e solo
// `scripts/hook/controllo-segreti.mjs`: due elenchi di regole che devono restare
// allineati a mano si separano, e il giorno in cui si separano nessuno se ne
// accorge. Questo file ricostruisce le condizioni in cui quel modulo sa lavorare
// (un indice con dentro cio' che e' stato spinto) e lo esegue com'e'.

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';

// --- La dichiarazione di essere arrivato in fondo (CRMA-100, CRMA-152) ------
// La stessa cintura che l'hook locale porta a ogni anello, portata anche qui: chi
// invoca questo modulo — il passo del workflow — non puo' fidarsi del solo codice
// di uscita, perche' un file TRONCATO A META' o fatto di SOLI SPAZI resta
// JavaScript valido, gira, non controlla niente ed esce 0. Cioe' un controllo in CI
// VERDE senza che nessun controllo sia girato: lo stesso guasto di prima, un anello
// piu' in la', e per giunta in un posto dove nessuno lo guarda da vicino.
//
// ⚠️ La stessa stringa e' scritta a mano nel passo `shell` del workflow, che non
// puo' importarla. Se le due si separano il controllo va rosso SEMPRE: guasto
// rumoroso, non silenzioso, ed e' il verso giusto in cui sbagliare. Che siano
// identiche lo verifica `controllo-ci.test.mjs`.
const SENTINELLA = 'controllo-ci: arrivato in fondo';
const esci = (codice) => {
  console.log(SENTINELLA);
  process.exit(codice);
};

// ⚠️ Solo ASCII in tutto cio' che viene stampato (nota operativa #13): questi
// messaggi finiscono nel registro di GitHub Actions, e li rilegge anche chi lavora
// da Git Bash su Windows.
const dillo = (...righe) => { for (const riga of righe) console.error(riga); };

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();

/** Come `git`, ma torna `null` invece di sollevare: per le domande che possono non avere risposta. */
const gitForse = (...args) => {
  try { return git(...args); } catch { return null; }
};

const ALBERO_VUOTO = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const CONTROLLO_SEGRETI = 'scripts/hook/controllo-segreti.mjs';
const LANCIATORE_LOCALE = '.githooks/pre-commit';
const MODULI_ATTESI = [
  CONTROLLO_SEGRETI,
  'scripts/hook/pre-commit.mjs',
  'scripts/hook/segnaposto.mjs',
];

// ---------------------------------------------------------------------------
// PARTE 1 - L'integrita' dell'hook locale, letta dal commit che si sta controllando.
//
// Il primo filtro puo' sparire in due modi che NON si vedono: il lanciatore
// cancellato (git non chiama niente) e il lanciatore che perde il bit di esecuzione
// (git lo salta senza dire una parola). Entrambi arrivano qui dentro come una
// modifica committata, quindi sono l'unica cosa che questo controllo puo' vedere
// prima ancora di guardare i segreti. Un push che li porta va rosso.
//
// ⚠️ Si guarda l'ALBERO GIT, non il disco: `fs.statSync` sul runner leggerebbe i
// permessi che il checkout ha ricreato, cioe' una proprieta' della macchina. Il bit
// `+x` che conta e' quello REGISTRATO nel commit (`100755`), perche' e' quello che
// ogni clone si ritrova.
// ---------------------------------------------------------------------------
const integrita = (commit) => {
  const guasti = [];

  const riga = gitForse('ls-tree', '-z', commit, '--', LANCIATORE_LOCALE);
  if (!riga) {
    guasti.push(`${LANCIATORE_LOCALE} non esiste in questo commit: senza di lui git non`
      + ' invoca nessun hook, e ogni commit passa senza controlli.');
  } else {
    const modo = riga.split(' ')[0];
    if (modo !== '100755') {
      guasti.push(`${LANCIATORE_LOCALE} e' registrato ${modo} invece di 100755: senza il bit`
        + " di esecuzione git lo salta IN SILENZIO. Si rimette con  git update-index --chmod=+x "
        + LANCIATORE_LOCALE);
    }
  }

  for (const modulo of MODULI_ATTESI) {
    if (!gitForse('ls-tree', '-z', commit, '--', modulo)) {
      guasti.push(`${modulo} non esiste in questo commit: l'hook locale non puo' girare.`);
    }
  }

  return guasti;
};

// ---------------------------------------------------------------------------
// PARTE 2 - Ricostruire lo stage, per poter eseguire il modulo COM'E'.
//
// `controllo-segreti.mjs` guarda `git diff --cached`, cioe' lo stage: e' nato per un
// hook pre-commit e li' lo stage e' esattamente cio' che sta per essere committato.
// In CI non esiste nessuno stage — esistono due commit. La traduzione e' una riga:
//
//     git reset --soft <base>     ->  HEAD = base, indice = albero della punta
//
// e da quel momento `git diff --cached` E' il diff `base..punta`, cioe' tutto cio'
// che questo push aggiunge. Il modulo non se ne accorge e non va toccato: e' la
// ragione per cui il suo perimetro (CRMA-93/100/152) resta chiuso.
//
// ⚠️ Si scrive nell'albero di lavoro del runner, che e' usa-e-getta e nostro. Questo
// modulo non va MAI eseguito su un albero di lavoro vero: sposterebbe HEAD.
// ---------------------------------------------------------------------------

/** Vero se `forse` e' un antenato di `discendente` (o lo stesso commit). */
const eAntenato = (forse, discendente) =>
  spawnSync('git', ['merge-base', '--is-ancestor', forse, discendente]).status === 0;

/**
 * La base del confronto, cioe' «da dove in poi si guardano le righe aggiunte».
 * Torna uno sha, oppure l'albero vuoto quando non c'e' nessun appiglio: in quel
 * caso si controlla la storia intera, che e' il verso prudente.
 *
 * ⚠️ LE BASI POSSIBILI SONO DUE, E SI PRENDE LA PIU' VECCHIA. E' la riga che
 * decide se questo controllo serve a qualcosa: sbagliarla non da' nessun errore,
 * restringe soltanto il diff — e un diff vuoto e' un controllo VERDE per assenza
 * di righe da guardare invece che per assenza di segreti.
 *
 *   (a) quella che l'evento di GitHub dichiara — `before` per un push,
 *       `pull_request.base.sha` per una pull request;
 *   (b) il tronco comune con `main`.
 *
 * Su `main` vale la (a): la (b) sarebbe `main` stesso, cioe' la punta, e il diff
 * sarebbe vuoto. Su un ramo di lavoro vale quasi sempre la (b), che e' piu'
 * vecchia: rilegge TUTTI i commit del ramo, non solo quelli dell'ultimo push. La
 * differenza e' il caso concreto per cui questa funzione e' fatta cosi' — un
 * segreto entrato cinque commit fa e mai piu' toccato non compare nel diff
 * dell'ultimo push, e con la sola (a) tornerebbe verde dal secondo push in poi.
 * E' esattamente li' che un segreto si nasconde: nei commit che nessuno rilegge.
 */
const trovaBase = (punta) => {
  const candidate = [];

  const dichiarata = (process.env.BASE_DICHIARATA ?? '').trim();
  if (dichiarata && !/^0+$/.test(dichiarata)) {
    // Si accetta solo se il commit esiste davvero qui e se e' un ANTENATO della
    // punta. Non lo e' dopo un push forzato, e in quel caso un `diff base..punta`
    // mostrerebbe come "aggiunte" le righe rimosse dall'altro lato: rumore.
    if (gitForse('cat-file', '-e', `${dichiarata}^{commit}`) === null) {
      console.log(`[nota] la base dichiarata ${dichiarata.slice(0, 7)} non e' presente nel clone: si ignora.`);
    } else if (!eAntenato(dichiarata, punta)) {
      console.log(`[nota] la base dichiarata ${dichiarata.slice(0, 7)} non e' antenata della punta`
        + ' (push forzato?): si ignora.');
    } else {
      candidate.push(dichiarata);
    }
  }

  for (const principale of ['origin/main', 'main']) {
    const tronco = gitForse('merge-base', principale, punta);
    if (tronco) { candidate.push(tronco); break; }
  }

  if (candidate.length === 0) {
    console.log('[nota] nessuna base utilizzabile: si controlla la storia intera.');
    return ALBERO_VUOTO;
  }

  // La piu' vecchia, cioe' quella che e' antenata dell'altra. Se nessuna delle due
  // lo e' (storie separate) si tiene la piu' larga possibile: l'albero vuoto.
  return candidate.reduce((piuVecchia, altra) => {
    if (eAntenato(altra, piuVecchia)) return altra;
    if (eAntenato(piuVecchia, altra)) return piuVecchia;
    return ALBERO_VUOTO;
  });
};

const punta = git('rev-parse', 'HEAD');
const base = trovaBase(punta);

console.log(`Controllo dei segreti su cio' che questo push aggiunge fra ${base.slice(0, 7)} e ${punta.slice(0, 7)}.`);

// L'integrita' si legge sulla PUNTA: e' lo stato in cui il repository resterebbe se
// questo codice venisse unito.
const guasti = integrita(punta);
if (guasti.length > 0) {
  dillo('', '  [ROSSO] il primo filtro (l\'hook pre-commit locale) e\' rotto in questo commit.', '');
  for (const guasto of guasti) dillo(`    - ${guasto}`);
  dillo(
    '',
    '  Non e\' un dettaglio di forma: senza quel filtro ogni commit di ogni clone',
    '  arriva qui senza essere mai stato controllato, e questo controllo resta',
    '  l\'unico. Ripristina il file e rifai il push.',
    '',
  );
  esci(1);
}

// `--mixed` no: rifarebbe l'indice dalla base e il diff tornerebbe vuoto (verde
// silenzioso, il guasto peggiore). Serve `--soft`, che l'indice lo lascia dov'e'.
try {
  git('reset', '--soft', base === ALBERO_VUOTO ? ALBERO_VUOTO : base);
} catch (errore) {
  // Con l'albero vuoto `reset --soft` non ha un commit a cui puntare: si svuota
  // HEAD, e il modulo se ne accorge da solo (il suo ramo «nessuna storia»).
  if (base === ALBERO_VUOTO) {
    try {
      git('update-ref', '-d', 'HEAD');
    } catch {
      dillo('[ROSSO] non sono riuscito a preparare il confronto con l\'albero vuoto.');
      esci(1);
    }
  } else {
    dillo(`[ROSSO] non sono riuscito a preparare il confronto (${errore.message.split('\n')[0]}).`);
    esci(1);
  }
}

// ---------------------------------------------------------------------------
// PARTE 3 - Il modulo dei segreti, preteso con la sua sentinella.
//
// Gli stessi quattro controlli del lanciatore locale, nello stesso ordine e per lo
// stesso motivo: ognuno da' il messaggio giusto a un guasto diverso, e nessuno di
// loro puo' concludere «verde» senza aver letto la prova che il modulo e' arrivato
// in fondo. Un controllo in CI che rientra a vuoto ripete il guasto di CRMA-100 in
// un posto dove si vede ancora meno.
//
// ⚠️ Il modulo eseguito e' quello DEL RAMO SPINTO, non quello di `main`: se un push
// lo cancella, lo svuota o lo tronca, il controllo deve andare rosso invece di
// passare — ed e' esattamente cio' che i quattro rami qui sotto fanno.
// ---------------------------------------------------------------------------
const dimensione = (() => {
  try { return fs.statSync(CONTROLLO_SEGRETI).size; } catch { return 0; }
})();
if (dimensione === 0) {
  dillo(
    `[ROSSO] ${CONTROLLO_SEGRETI} manca o e' vuoto: il controllo sui segreti non c'e'.`,
    '        Nessun controllo e\' girato, quindi questo push non e\' stato verificato.',
  );
  esci(1);
}

// Copia scritta a mano della costante che sta in `controllo-segreti.mjs`, come gia'
// in `pre-commit.mjs`: i due file non si importano a vicenda. Che combacino lo
// verifica `controllo-ci.test.mjs`.
const SENTINELLA_SEGRETI = 'controllo-segreti: arrivato in fondo';

// stdout catturato (e' il canale della sentinella); stderr NO, passa diretto al
// registro di Actions — l'elenco dei riscontri va letto li'.
//
// ⚠️ Il modulo nomina il file e la riga, MAI il valore trovato (lo tronca a dieci
// caratteri e maschera le password nelle stringhe di connessione). E' cio' che
// rende sicuro lasciarlo stampare qui: i registri di CI sono spesso leggibili piu'
// largamente del repository, e un controllo che ristampa il segreto lo pubblica una
// seconda volta, in un posto che nessuno pensa a ripulire.
const segreti = spawnSync(process.execPath, [CONTROLLO_SEGRETI], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
});

// (a) Esito che non viene dal modulo: processo ucciso, permessi, interprete che non
//     parte. Va detto cosi', prima di guardare la sentinella: un processo mai
//     partito non ne stampa nessuna, e accusarlo di essere troncato manderebbe a
//     cercare il guasto nel file sbagliato.
if (segreti.status !== 0 && segreti.status !== 1) {
  const causa = segreti.status === null
    ? `interrotto (${segreti.signal ?? segreti.error?.code ?? 'causa ignota'})`
    : `uscita ${segreti.status}`;
  dillo(
    `[ROSSO] il controllo sui segreti non ha potuto girare (${causa}).`,
    `        Controlla che ${CONTROLLO_SEGRETI} sia a posto e leggibile.`,
  );
  esci(1);
}

// (b) La sentinella: il modulo c'e' e ha girato, ma non e' arrivato in fondo.
if (!(segreti.stdout ?? '').includes(SENTINELLA_SEGRETI)) {
  dillo(
    `[ROSSO] ${CONTROLLO_SEGRETI} non e' arrivato in fondo: e' troncato, di soli`,
    '        spazi, o si e\' interrotto a meta\'. Il controllo sui segreti NON ha',
    '        girato, quindi questo push non e\' stato verificato.',
  );
  esci(1);
}

// (c) Ha trovato un segreto: l'elenco e' gia' passato da stderr.
if (segreti.status === 1) {
  dillo(
    '  Questo push porta un segreto. L\'hook locale non l\'ha fermato: o non era',
    '  installato su quel clone, o e\' stato scavalcato con  git commit --no-verify.',
    '',
    '  ATTENZIONE: toglierlo dal prossimo commit NON basta. Il valore e\' gia\' stato',
    '  spinto, quindi e\' da considerare compromesso e va RUOTATO. Poi si ripulisce',
    '  la storia del ramo.',
    '',
  );
  esci(1);
}

console.log('Nessun segreto in cio\' che questo push aggiunge.');
esci(0);
