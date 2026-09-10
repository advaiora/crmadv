// Cintura di sicurezza: rifiuta un commit che porta in stage un segreto.
// Lo chiama `.githooks/pre-commit` (PARTE 2). Esce 0 se e' tutto pulito, 1 se blocca.
//
// Perche' esiste: il 10/2/2026 il file `.env` e' stato committato con dentro la password
// del superuser PostgreSQL e nessuno se n'e' accorto per sette mesi (compito CRMA-67).
// Il `.gitignore` da solo non basta: `git add -f` lo scavalca.
//
// Perche' e' scritto in Node e non in grep/awk: in questo contenitore `grep` e' ugrep
// (rifiuta le retro-referenze POSIX `\1`) e `awk` e' mawk, mentre su Git Bash per Windows
// sono altri programmi ancora. Node c'e' su entrambe le postazioni, e' gia' un requisito
// del progetto e le sue espressioni regolari si comportano allo stesso modo ovunque.
//
// Perche' e' un FILE e non un here-document dentro l'hook (compito CRMA-93): finche' stava
// in `cat <<'JS'` dentro uno script `sh` non era importabile, quindi non era testabile —
// ed e' cosi' che una funzione pura con tre liste e una soglia e' arrivata al secondo giro
// di revisione senza un test. Le parti pure stanno in `segnaposto.mjs`, col loro banco.
//
// VIA D'USCITA, dichiarata anche nel messaggio d'errore:  git commit --no-verify

import { execFileSync } from 'node:child_process';
import { eSegnaposto } from './segnaposto.mjs';

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// --- La dichiarazione di essere arrivato in fondo (compito CRMA-100) --------
// L'hook non puo' fidarsi del solo codice di uscita di `node`: un modulo TRONCATO
// A META' — o fatto di soli spazi — e' JavaScript valido, gira, non controlla
// niente e esce 0. Misurato al 10/9/2026 sulla punta di CRMA-93: su 187 punti di
// troncamento, 104 producevano un file che l'hook accettava, 86 dei quali senza
// stampare una riga. Le cause citate dall'hook (checkout interrotto, disco pieno,
// merge andato male) producono molto piu' spesso un file mozzo che un file di zero
// byte, quindi era il caso piu' probabile a non essere coperto.
//
// La chiusura e' che il modulo DICE di essere arrivato in fondo: `esci()` stampa
// questa riga su stdout come ultimo gesto, su TUTTE le uscite volute (0 e 1), e
// l'hook rifiuta il commit se non la legge. Un prefisso del file non puo' contenere
// la propria fine: qualunque troncamento perde la stampa, compresi i troncamenti
// che restano sintatticamente validi. E' l'unica forma che copre la classe intera.
//
// ⚠️ La stessa stringa e' scritta a mano in `.githooks/pre-commit`, che essendo uno
// script `sh` non puo' importarla. Se le due si separano l'hook blocca OGNI commit:
// un guasto rumoroso, non silenzioso — ed e' il verso giusto. Che siano identiche
// lo verifica `controllo-segreti.test.mjs`.
const SENTINELLA = 'controllo-segreti: arrivato in fondo';
const esci = (codice) => {
  console.log(SENTINELLA);
  process.exit(codice);
};

// --- Che cosa NON deve mai entrare in un commit --------------------------
// I nomi di file di ambiente. Qualunque profondita': conta solo il nome.
const AMBIENTE_AMMESSI = new Set([
  '.env.example', '.env.sample', '.env.template', '.env.dist',
]);
const eFileDiAmbiente = (nome) => nome === '.env' || nome.startsWith('.env.');

// I contenuti. Ogni regola dice come si chiama, cosi' il messaggio e' leggibile.
const REGOLE = [
  {
    nome: 'stringa di connessione con credenziali',
    re: /\b(postgresql|postgres|mysql|mariadb|mongodb\+srv|mongodb|rediss|redis|amqps|amqp):\/\/([^:/@\s"'`]+):([^@\s"'`]+)@/gi,
    credenziali: true,
  },
  { nome: 'chiave API Anthropic',        re: /\bsk-ant-[A-Za-z0-9_-]{16,}/g },
  { nome: 'chiave API OpenAI',           re: /\bsk-proj-[A-Za-z0-9_-]{16,}/g },
  { nome: 'chiave di accesso AWS',       re: /\bAKIA[0-9A-Z]{16}\b/g },
  { nome: 'token Slack',                 re: /\bxox[baprs]-[0-9A-Za-z-]{10,}/g },
  // I due prefissi che piu' spesso finiscono per sbaglio dentro un commit
  // (misurati come "passano" durante la revisione di CRMA-83, compito CRMA-85).
  // `gh[pousr]_` copre l'intera famiglia dei token GitHub, non solo `ghp_`:
  // sono la stessa cosa con una lettera diversa (personal, oauth, user, server,
  // refresh) e costano zero righe in piu'.
  { nome: 'token GitHub',                re: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g },
  // Le chiavi Google sono lunghe 39 caratteri: `AIza` + 35. Qui si chiedono
  // ALMENO 35 caratteri dopo il prefisso, non esattamente 35: non c'e' confine
  // di chiusura, quindi `AIza` + 45 combacia lo stesso. E' voluto — la soglia
  // serve a non segnalare le parole CORTE che iniziano per AIza, non le lunghe,
  // e sbagliare di piu' e' il verso giusto in cui sbagliare.
  { nome: 'chiave API Google',           re: /\bAIza[0-9A-Za-z_-]{35}/g },
  { nome: 'chiave service_role',         re: /service_role[^A-Za-z0-9]{0,12}ey[A-Za-z0-9_.-]{20,}/gi },
  { nome: 'chiave privata',              re: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g },
];

// --- Le esclusioni, scritte qui perche' il prossimo le trovi ---------------
// PERCORSI che per mestiere contengono segreti finti. Nella storia del progetto ci sono
// gia': `sk-ant-vecchia` e `sk-ant-nuova` nei test del frontend, `sk-ant-api03-${...}` in
// provider-api-key-env.test.ts.
//     ⚠️ Il prezzo di questa esclusione, misurato e accettato (CRMA-85): in questo
//     repository il posto piu' comodo dove nascondere un segreto vero e' un file che
//     finisce per `.test.ts`. Non si chiude qui — le fixture `sk-ant-vecchia` e
//     `test-user:test-pass` esistono davvero e bloccherebbero il lavoro ogni giorno. Si
//     chiude lato server, con GitHub Push Protection, che questa esclusione non ce l'ha.
//     E' l'argomento piu' forte a suo favore.
//     ⚠️ `.githooks/pre-commit` resta in lista anche dopo l'estrazione di CRMA-93, quando
//     ha smesso di contenere i pattern: toglierlo sarebbe una stretta, non un'estrazione,
//     e questo compito e' dichiarato neutro. E' annotato come rilievo.
//     ⚠️ Questo file NON e' escluso, ed e' voluto: misurato in CRMA-93, nessuna delle
//     regole qui sopra combacia col proprio sorgente (dopo ogni prefisso c'e' una `[` di
//     classe di caratteri, che nessuna delle classi ammette). Se un domani una regola
//     nuova si autobloccasse, la risposta giusta e' ancorarla meglio, non escludere il
//     file: escluderlo qui significa spegnere il controllo su se stesso.
const PERCORSI_ESCLUSI = [
  /(^|\/)__tests__\//,
  /(^|\/)__mocks__\//,
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /(^|\/)\.githooks\/pre-commit$/,
];

const escluso = (percorso) => PERCORSI_ESCLUSI.some((re) => re.test(percorso));

// --- Raccolta dei riscontri ------------------------------------------------
const riscontri = [];

// (a) I nomi dei file in stage.
const inStage = git('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z')
  .split('\0')
  .filter(Boolean);
for (const percorso of inStage) {
  const nome = percorso.split('/').pop();
  if (eFileDiAmbiente(nome) && !AMBIENTE_AMMESSI.has(nome)) {
    riscontri.push({ percorso, riga: null, motivo: 'file di ambiente (non va mai committato)', estratto: '' });
  }
}

// (b) Il contenuto del DIFF IN STAGE: conta cio' che si sta per committare,
//     non cio' che c'e' nell'albero. Solo le righe aggiunte (`+`).
const conStoria = (() => {
  try { git('rev-parse', '--verify', '--quiet', 'HEAD'); return true; } catch { return false; }
})();
const base = conStoria ? 'HEAD' : '4b825dc642cb6eb9a060e54bf8d69288fbee4904'; // albero vuoto

const diff = git(
  'diff', '--cached', '--unified=0', '--no-color', '--no-ext-diff',
  '--src-prefix=a/', '--dst-prefix=b/', base,
).split('\n');

let file = '';
let numeroRiga = 0;
let dentroHunk = false;

for (const linea of diff) {
  if (linea.startsWith('diff --git ')) { dentroHunk = false; file = ''; continue; }
  if (!dentroHunk && linea.startsWith('+++ ')) {
    let percorso = linea.slice(4);
    if (percorso === '/dev/null') { file = ''; continue; }
    if (percorso.startsWith('"')) { try { percorso = JSON.parse(percorso); } catch { /* percorso esotico: lo teniamo com'e' */ } }
    file = percorso.replace(/^b\//, '');
    continue;
  }
  if (linea.startsWith('@@')) {
    const m = /^@@ -\S+ \+(\d+)/.exec(linea);
    numeroRiga = m ? Number(m[1]) : 0;
    dentroHunk = true;
    continue;
  }
  if (!dentroHunk || !linea.startsWith('+') || !file) continue;

  const contenuto = linea.slice(1);
  const numero = numeroRiga;
  numeroRiga += 1;
  if (escluso(file)) continue;

  for (const regola of REGOLE) {
    regola.re.lastIndex = 0;
    let m;
    while ((m = regola.re.exec(contenuto)) !== null) {
      if (regola.credenziali) {
        const [, schema, utente, password] = m;
        if (eSegnaposto(utente, password)) continue;
        riscontri.push({ percorso: file, riga: numero, motivo: regola.nome, estratto: `${schema}://${utente}:***@` });
      } else {
        const trovato = m[0];
        const estratto = trovato.length > 14 ? `${trovato.slice(0, 10)}... (${trovato.length} caratteri)` : trovato;
        riscontri.push({ percorso: file, riga: numero, motivo: regola.nome, estratto });
      }
    }
  }
}

if (riscontri.length === 0) esci(0);

// --- Il messaggio: quale file, quale riga, cosa fare -----------------------
// ⚠️ Solo ASCII da qui in giu': questo testo lo legge anche il terminale di Git
// Bash su Windows, che sui caratteri accentati e sui simboli tipografici
// restituisce caratteri illeggibili (stessa famiglia della nota operativa #13).
const etichetta = (r) => (r.riga === null ? r.percorso : `${r.percorso}:${r.riga}`);
const larghezza = Math.min(56, Math.max(...riscontri.map((r) => etichetta(r).length)));

console.error('');
console.error('  [COMMIT RIFIUTATO] fra i file in stage c\'e\' un segreto.');
console.error('');
for (const r of riscontri.slice(0, 20)) {
  console.error(`    ${etichetta(r).padEnd(larghezza)}  ${r.motivo}${r.estratto ? `  [${r.estratto}]` : ''}`);
}
if (riscontri.length > 20) console.error(`    ... e altri ${riscontri.length - 20} riscontri.`);
console.error('');
console.error('  Cosa fare:');
console.error('    1. togli il file dallo stage:   git restore --staged <file>');
console.error('       (se e\' un file di ambiente: tienilo fuori da git, i valori');
console.error('        di esempio vanno in .env.example senza quelli veri)');
console.error('    2. se il valore vero e\' gia\' finito da qualche parte, consideralo');
console.error('       compromesso e ruotalo: toglierlo dal commit non basta.');
console.error('    3. se e\' un FALSO POSITIVO, il commit si forza cosi\':');
console.error('');
console.error('           git commit --no-verify');
console.error('');
console.error('       e poi segnalalo, cosi\' la regola viene corretta:');
console.error('       scripts/hook/controllo-segreti.mjs, elenco delle esclusioni.');
console.error('');
// Anche qui la sentinella, non solo sull'uscita pulita: cosi' l'hook la pretende
// SEMPRE, e un troncamento che rompe la sintassi (uscita 1 di `node`, che prima
// finiva nel ramo «ho trovato un segreto» e bloccava senza spiegare perche')
// prende il messaggio giusto invece del silenzio.
esci(1);
