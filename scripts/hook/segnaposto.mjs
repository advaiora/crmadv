// Riconoscere un SEGNAPOSTO dentro una stringa di connessione: `postgres://root:XXX@host`.
// Serve alla cintura di sicurezza dell'hook pre-commit (scripts/hook/controllo-segreti.mjs)
// per non rifiutare `postgres://postgres:LA-TUA-PASSWORD@localhost/db` in un documento,
// e per rifiutare invece `admin:A1B2-C3D4@prod.host`, che ha la stessa forma ed e' una
// password vera generata da un gestore di password.
//
// ⚠️ Nota di scrittura, misurata su questo stesso file: l'esempio qui sopra e' scritto
// SENZA lo schema `postgres://` apposta. Con lo schema sarebbe una stringa di connessione
// valida con dentro una password non-segnaposto, e l'hook si bloccherebbe su un proprio
// commento — provato. Questo file non e' fra i percorsi esclusi, ed e' giusto cosi': gli
// esempi di password VERE si scrivono spezzati, non si esclude il file.
//
// PERCHE' STA IN UN FILE A SE' (compito CRMA-93). Fino al 10/9/2026 queste funzioni
// vivevano dentro un here-document `cat <<'JS'` in `.githooks/pre-commit`: uno script `sh`
// non e' importabile, quindi non erano coperte da nessun test. Il banco che le prova e'
// stato ricostruito a mano TRE volte — in CRMA-85, nella revisione di CRMA-91, e di nuovo
// chiudendo il rilievo di CRMA-91. Estrarle qui e' quello che rende la quarta inutile:
// il banco adesso e' `segnaposto.test.mjs`, accanto a questo file, e gira da solo con
// `npm run test:scripts`.
//
// ⚠️ Ogni voce delle due liste e' UN BUCO: una password vera che contenga quella parola
// passa il controllo. Si amplia con parsimonia, e chi lo fa aggiunge il caso al test.

// (1) PASSWORD che sono segnaposto per intero. Nella storia del progetto esistono gia':
//     `postgres:postgres` (utente uguale a password, in auth-login.smoke.ts),
//     `test-user:test-pass` (runtime-env.unit.test.ts), `user:pass` nel messaggio
//     d'errore di runtime-env.ts.
export const PASSWORD_SEGNAPOSTO = new Set([
  'password', 'pass', 'passwd', 'secret', 'test-pass', 'testpass',
  'changeme', 'change-me', 'example', 'esempio', 'placeholder',
  'mypassword', 'yourpassword', 'tuapassword',
]);

// (2) Le PAROLE che rendono segnaposto una password tutta maiuscola.
//     ⚠️ Perche' serve una lista e non basta la forma. Fino al 10/9/2026 la regola diceva
//     «tutta maiuscole con separatori => segnaposto», e la giustificava con
//     `postgres:LA-TUA-PASSWORD` di installazione-e-avvio.md. Ma la forma non guarda le
//     parole: `admin:A1B2-C3D4@prod.host` ha la stessa forma ed e' una password vera —
//     misurato come "passa" nella revisione di CRMA-83 (compito CRMA-85). Ora almeno UNO
//     dei pezzi separati da `-`/`_` deve essere una di queste parole — E nessun pezzo deve
//     sembrare casuale (vedi `sembraCasuale`). `LA-TUA-PASSWORD` passa; `A1B2-C3D4` no
//     perche' non ha parole; `A1B2-C3D4-QUI` no perche' ha un pezzo casuale.
//     ⚠️ Fuori di proposito gli articoli e i possessivi corti (`LA`, `IL`, `MY`): non
//     servono — `LA-TUA-PASSWORD` combacia gia' su `TUA` e su `PASSWORD` — e due lettere
//     sono anche la lunghezza di un pezzo casuale.
export const PAROLE_SEGNAPOSTO = new Set([
  'tua', 'tuo', 'tue', 'tuoi', 'mia', 'mio', 'your', 'yours',
  'change', 'changeme', 'example', 'esempio', 'sample', 'placeholder',
  'segnaposto', 'qui', 'here', 'todo', 'dummy', 'fake', 'inserisci',
  'password', 'pass', 'passwd', 'secret', 'segreto',
]);

// ⚠️ Tolte il 10/9/2026, su misura della revisione: `xxx` e `test`. Erano il buco del
//    punto 1 con tre lettere davanti — `root:XXX-K9QW2MZZ41PLM3G7` e `root:A1B2-C3D4-TEST`
//    passavano entrambe. Nessuna delle due serviva: le password tutte-X cadono gia' in
//    /^[*x.]+$/i piu' sotto, i file di test sono gia' esclusi per percorso, e i segnaposto
//    veri che le contengono (`TEST-PASSWORD`, `XXX-PASSWORD`) combaciano su `PASSWORD`.

// ⚠️ Qui c'e' stata per mezza giornata una distinzione fra parole FORTI (`tua`,
//    `inserisci`: bastavano da sole) e DEBOLI (`password`, `secret`: valevano solo senza
//    pezzi casuali). Ritirata il 10/9/2026 su misura della revisione CRMA-91: le forti
//    facevano `return true` PRIMA del controllo di casualita', quindi `root:A1B2-C3D4-QUI`,
//    `root:K9QW2MZZ41PLM3G7-HERE`, `root:A1B2-C3D4-TODO` e `root:A1B2-C3D4-FAKE` passavano
//    — lo stesso buco che togliere `xxx` e `test` aveva chiuso per due parole sole, non per
//    la classe. Sottoporre anche le forti al controllo rende i due livelli identici nel
//    comportamento: una lista sola e' la stessa cosa, scritta onestamente.
//    Costo dichiarato: un segnaposto con un suffisso che sembra casuale
//    (`TUA-PASSWORD-PROD1`) ora viene rifiutato. Nel repository non esiste — verificato
//    mettendo in stage l'intero albero — e la via d'uscita `--no-verify` e' scritta nel
//    messaggio d'errore.

// Un pezzo "sembra casuale" se e' lungo almeno 4 e mescola lettere e cifre:
// `A1B2`, `C3D4`, `K9QW2MZZ41PLM3G7`. La lunghezza minima non e' un dettaglio: evita di
// bocciare i suffissi di versione dei segnaposto (`MY-DB-PASS-V2`).
export const sembraCasuale = (pezzo) =>
  pezzo.length >= 4 && /[A-Za-z]/.test(pezzo) && /[0-9]/.test(pezzo);

// Un tetto di lunghezza in piu', per il caso che resta: una password vera, lunga e casuale,
// che per sfortuna contenga un pezzo tipo `SECRET`. 64 e' largo abbastanza da non dare
// fastidio ai segnaposto lunghi della documentazione
// (`INSERISCI-QUI-LA-TUA-PASSWORD-DEL-DATABASE` sono 42).
// ⚠️ Da solo e' quasi inerte (rilevato in revisione): morde unicamente sopra i 64
//    caratteri, mentre le password generate stanno fra 16 e 32. Chiude la coda lunga, non
//    e' la protezione — quella sono la lista e `sembraCasuale`.
export const LUNGHEZZA_MASSIMA_SEGNAPOSTO = 64;

// ⚠️ L'ordine dei due controlli e' la sostanza della regola, non uno stile: un pezzo che
//    sembra casuale RIFIUTA subito, e nessuna parola della lista puo' piu' salvarlo. Chi
//    aggiunge un `return true` sopra questa riga riapre il buco di CRMA-91 — un'uscita
//    anticipata e' un'esenzione, e se la eredita in silenzio ogni voce della lista.
//    Il test accanto lo prova su tutto il corpus, non solo sui quattro casi del rilievo.
export function eSegnapostoMaiuscolo(password) {
  if (!/^[A-Z0-9]+([-_][A-Z0-9]+)+$/.test(password)) return false;
  if (password.length > LUNGHEZZA_MASSIMA_SEGNAPOSTO) return false;
  const pezzi = password.toLowerCase().split(/[-_]/);
  if (pezzi.some(sembraCasuale)) return false;
  return pezzi.some((p) => PAROLE_SEGNAPOSTO.has(p));
}

export function eSegnaposto(utente, password) {
  if (utente.toLowerCase() === password.toLowerCase()) return true;   // postgres:postgres
  if (PASSWORD_SEGNAPOSTO.has(password.toLowerCase())) return true;   // user:pass
  if (eSegnapostoMaiuscolo(password)) return true;                    // LA-TUA-PASSWORD
  if (/^[$<{]/.test(password) || /[}>]$/.test(password)) return true; // ${DB_PASS}, <password>
  if (/^[*x.]+$/i.test(password)) return true;                        // ****, xxxx
  return false;
}
