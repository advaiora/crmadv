// La LOGICA dell'hook pre-commit del progetto. Git ne esegue uno solo, e quello
// e' `.githooks/pre-commit`: da CRMA-152 quel file e' soltanto un lanciatore, e
// tutto quello che segue gira qui dentro. Esce 0 se il commit puo' passare, 1 se
// va rifiutato.
//
// Qui dentro stanno due controlli con severita' OPPOSTE, ed e' voluto:
//
//   PARTE 1 - rigenerazione della mappa: NON blocca mai (solo un avviso).
//   PARTE 2 - cintura di sicurezza sui segreti: BLOCCA il commit (uscita 1).
//
// Tenerle separate serve a non farle scivolare l'una nell'altra: una mappa non
// rigenerata e' un fastidio, una password committata e' un incidente.
// Attivazione (una volta per clone):  git config core.hooksPath .githooks
//
// ⚠️ PERCHE' QUESTO FILE ESISTE (compito CRMA-152). Fino al 10/9/2026 tutto questo
// stava dentro `.githooks/pre-commit`, cioe' dentro uno script `sh` di 133 righe —
// ed era esso stesso un file di testo soggetto a troncamento, esattamente come i
// moduli che protegge. Misurato in CRMA-102: troncando l'hook a ognuna delle sue
// righe, con un segreto vero in stage, **105 punti su 135 lasciavano passare il
// commit**. La guardia non aveva nessuno che guardasse lei. Portata la logica in un
// `.mjs`, e' coperta dalla stessa sentinella che copre gli altri moduli, e il
// lanciatore che resta e' abbastanza corto da avere pochissimi punti dove rompersi
// in silenzio (il conto aggiornato sta nel commento in cima al lanciatore).
//
// VIA D'USCITA, dichiarata anche nei messaggi d'errore:  git commit --no-verify

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

// --- La dichiarazione di essere arrivato in fondo (CRMA-100, estesa da CRMA-152) ---
// Chi invoca questo modulo non puo' fidarsi del solo codice di uscita: un file
// TRONCATO A META' — o fatto di soli spazi — resta JavaScript valido, gira, non
// controlla niente ed esce 0. Percio' il modulo DICE di essere arrivato in fondo:
// `esci()` stampa questa riga su stdout come ultimo gesto, su TUTTE le uscite
// volute (0 e 1), e il lanciatore rifiuta il commit se non la legge. Un prefisso
// del file non puo' contenere la propria fine: qualunque troncamento la perde,
// compresi quelli che restano sintatticamente validi.
//
// ⚠️ La stessa stringa e' scritta a mano in `.githooks/pre-commit`, che essendo uno
// script `sh` non puo' importarla. Se le due si separano l'hook blocca OGNI commit:
// guasto rumoroso, non silenzioso — ed e' il verso giusto in cui sbagliare per una
// cintura di sicurezza. Che siano identiche lo verifica `pre-commit.test.mjs`.
const SENTINELLA = 'pre-commit: arrivato in fondo';
const esci = (codice) => {
  console.log(SENTINELLA);
  process.exit(codice);
};

// ⚠️ Solo ASCII in tutto cio' che viene stampato: questi messaggi li legge anche il
// terminale di Git Bash su Windows, che sugli accentati restituisce caratteri
// illeggibili (nota operativa #13).
const dillo = (...righe) => { for (const riga of righe) console.error(riga); };

// `process.execPath` e non il nome nudo `node`: siamo gia' dentro node, quindi
// l'interprete esiste per certo ed e' lo stesso che ha avviato questo modulo. Un
// PATH strano o un `node` diverso da quello in uso non possono piu' cambiare
// l'esito. Il caso «node non c'e' affatto» resta in carico al lanciatore, che e'
// l'unico punto della catena dove puo' ancora presentarsi.
const nodeConDentro = (script, opzioni) => spawnSync(process.execPath, [script], opzioni);

// ---------------------------------------------------------------------------
// PARTE 1 - Mappa progetto (archivio-documenti/mappa/, generata, non committata).
// Forma leggera decisa il 4/8/2026 (registro in archivio-documenti/team-agenti.md):
// sub-secondo, NON blocca mai il commit — tiene la mappa fresca anche se una
// sessione dimentica `npm run mappa`.
// ---------------------------------------------------------------------------
const mappa = nodeConDentro('scripts/agenti/mappa.mjs', { stdio: 'ignore' });
if (mappa.status !== 0) {
  dillo('[avviso] mappa non rigenerata (node scripts/agenti/mappa.mjs fallito): rigenerala a mano');
}

// ---------------------------------------------------------------------------
// PARTE 2 - Cintura di sicurezza: segreti in stage. QUESTA BLOCCA (uscita 1).
//
// Perche' esiste, perche' e' in Node e non in grep/awk, quali regole applica e
// quali esclusioni ammette: sta tutto scritto in cima al modulo, che e' il posto
// dove chi cerca quelle risposte va a guardare.
//
// ⚠️ Perche' e' un FILE e non un here-document `cat <<'JS'` (compito CRMA-93):
// dentro uno script `sh` il controllo non era importabile, quindi non era
// testabile — ed e' cosi' che `eSegnapostoMaiuscolo`, una funzione pura con due
// liste e una soglia, e' arrivata al SECONDO giro di revisione senza un test. Il
// banco adesso e' in `scripts/hook/segnaposto.test.mjs` (`npm run test:scripts`).
// ---------------------------------------------------------------------------
const CONTROLLO_SEGRETI = 'scripts/hook/controllo-segreti.mjs';

// RIENTRO A VUOTO: il commit passa SENZA che nessun controllo sia girato. E' il
// guasto peggiore di questo hook, perche' non si vede. Storia in tre tappe,
// tenute qui perche' ognuna spiega una riga di codice qui sotto.
//
//   1. CRMA-85 — il controllo era una variabile riempita da `cat`; se `cat`
//      mancava la variabile restava vuota, `node -e ""` usciva 0, passava tutto.
//   2. CRMA-93 — estratto in un file, i modi di rientrare a vuoto diventano DUE:
//        - file ASSENTE (clone parziale, `git checkout` di un commit che non ce
//          l'ha, cartella rinominata): `node` uscirebbe 1 e il commit sarebbe
//          rifiutato lo stesso, ma senza dire perche'. Qui la guardia sulla
//          dimensione serve al MESSAGGIO;
//        - file PRESENTE ma di ZERO BYTE (checkout interrotto): `node vuoto.mjs`
//          esce 0. Qui la guardia serve alla SICUREZZA.
//   3. CRMA-100 — ⚠️ la dimensione NON basta: un modulo TRONCATO A META' o di
//      SOLI SPAZI e' piu' lungo di zero, `node` lo esegue, esce 0, e il commit
//      passa. Misurato al 10/9/2026: 104 punti di troncamento su 187 accettati,
//      86 in silenzio. Percio' la guardia sulla dimensione resta, ma solo come
//      primo filtro col suo messaggio; la chiusura vera e' la sentinella.
const dimensione = (() => {
  try { return fs.statSync(CONTROLLO_SEGRETI).size; } catch { return 0; }
})();
if (dimensione === 0) {
  dillo(
    `[BLOCCO] ${CONTROLLO_SEGRETI} manca o e' vuoto: il controllo sui segreti non c'e'.`,
    '         Commit rifiutato per prudenza: ripristina il file,',
    '         oppure, se sei sicuro, usa  git commit --no-verify',
  );
  esci(1);
}

// La sentinella del modulo dei segreti, pretesa qui come la nostra e' pretesa dal
// lanciatore. Anche questa e' una copia scritta a mano di una costante che sta in
// `controllo-segreti.mjs`: che le due combacino lo verifica
// `controllo-segreti.test.mjs`, e se si separassero l'hook rifiuterebbe ogni commit.
const SENTINELLA_SEGRETI = 'controllo-segreti: arrivato in fondo';

// stdout viene catturato (e' il canale della sentinella, e non contiene altro);
// stderr NO, passa diretto al terminale — l'elenco dei riscontri va stampato.
const segreti = nodeConDentro(CONTROLLO_SEGRETI, {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
});

// ⚠️ L'ORDINE DEI TRE CONTROLLI QUI SOTTO NON E' INDIFFERENTE, e ognuno esiste per
// dare il messaggio giusto a un guasto diverso. Il modulo esce 0 (pulito) o 1 (ha
// trovato qualcosa); qualunque altro esito non viene da lui.
//   a) esito DIVERSO da 0 e da 1 -> non e' stato lui: processo ucciso, permessi,
//      interprete che non parte. Va detto cosi', prima di guardare la sentinella:
//      un processo che non e' mai partito non stampa nessuna sentinella, e
//      accusarlo di essere troncato manderebbe a cercare il guasto nel file
//      sbagliato;
//   b) sentinella ASSENTE -> il modulo c'e' e ha girato, ma non e' arrivato in
//      fondo. Qui cade anche il troncamento che rompe la sintassi, che esce 1 e
//      che prima finiva nel ramo (c) — bloccava, ma facendo credere di aver
//      trovato un segreto;
//   c) uscita 1 con la sentinella -> ha trovato davvero qualcosa e l'ha gia'
//      stampato su stderr.

// (a) Esito inatteso: si rifiuta lo stesso. Un controllo di sicurezza che si
// arrende in silenzio e' peggio che non averlo.
if (segreti.status !== 0 && segreti.status !== 1) {
  const causa = segreti.status === null
    ? `interrotto (${segreti.signal ?? segreti.error?.code ?? 'causa ignota'})`
    : `uscita ${segreti.status}`;
  dillo(
    `[BLOCCO] il controllo sui segreti non ha potuto girare (${causa}).`,
    `         Commit rifiutato per prudenza: controlla che ${CONTROLLO_SEGRETI}`,
    '         sia a posto e leggibile,',
    '         oppure, se sei sicuro, usa  git commit --no-verify',
  );
  esci(1);
}

// (b) La sentinella.
if (!(segreti.stdout ?? '').includes(SENTINELLA_SEGRETI)) {
  dillo(
    `[BLOCCO] ${CONTROLLO_SEGRETI} non e' arrivato in fondo: e' troncato, di soli`,
    "         spazi, o si e' interrotto a meta'. Il controllo sui segreti NON ha",
    "         girato, quindi il commit non e' stato verificato.",
    '         Commit rifiutato per prudenza: ripristina il file con',
    `           git checkout -- ${CONTROLLO_SEGRETI}`,
    '         oppure, se sei sicuro, usa  git commit --no-verify',
  );
  esci(1);
}

// (c) Ha trovato un segreto: l'elenco e' gia' passato da stderr.
if (segreti.status === 1) esci(1);

esci(0);
