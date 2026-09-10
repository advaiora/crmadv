// Il banco di `segnaposto.mjs` — cioe' della domanda «questa password e' un segnaposto
// o un segreto vero?» che decide se l'hook pre-commit blocca il commit.
//
// PERCHE' ESISTE (compito CRMA-93). I casi qui sotto sono stati misurati a mano TRE volte
// su tre run diversi — da chi ha svolto CRMA-85, dal Revisore in CRMA-91, e da chi ha
// chiuso il rilievo di CRMA-91 — perche' la funzione viveva dentro un here-document `cat`
// in `.githooks/pre-commit` e non era importabile da nessun test. Ogni volta il banco e'
// stato ricostruito da zero e ogni volta e' andato perso. Questo file e' il posto dove
// smette di andare perso: chi tocca le liste o la soglia lancia `npm run test:scripts`.
//
// COME E' FATTO, in due parti che provano due cose diverse:
//   (1) I CASI NOMINATI — le password vere e i segnaposto veri incontrati nella storia del
//       progetto, ognuno con il compito che l'ha prodotto. Sono la memoria.
//   (2) LE PROPRIETA' SUL CORPUS — le quattro regole che, messe insieme, DEFINISCONO
//       `eSegnapostoMaiuscolo`, verificate su tutte le combinazioni fino a tre pezzi delle
//       parole e dei mattoni casuali. Sono la rete: prendono le riscritture che i casi
//       nominati lascerebbero passare. In particolare la proprieta' (P3) e' il rilievo di
//       CRMA-91 espresso una volta per tutte — «un pezzo che sembra casuale rifiuta, e
//       nessuna parola della lista puo' salvarlo» — invece che sui suoi quattro esempi.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LUNGHEZZA_MASSIMA_SEGNAPOSTO,
  PAROLE_SEGNAPOSTO,
  PASSWORD_SEGNAPOSTO,
  SEGNAPOSTI_DELIMITATI,
  eSegnaposto,
  eSegnapostoDelimitato,
  eSegnapostoMaiuscolo,
  sembraCasuale,
} from './segnaposto.mjs';

// ---------------------------------------------------------------------------
// (1) I casi nominati: `utente`, `password`, esito atteso, da dove viene.
//     esito `false` = NON e' un segnaposto = l'hook BLOCCA il commit.
// ---------------------------------------------------------------------------
const CASI = [
  // --- I quattro del rilievo di CRMA-91: parola-segnaposto + pezzo casuale.
  //     Passavano tutti, perche' le parole "forti" uscivano prima del controllo.
  ['root', 'A1B2-C3D4-QUI', false, 'rilievo CRMA-91'],
  ['root', 'K9QW2MZZ41PLM3G7-HERE', false, 'rilievo CRMA-91'],
  ['root', 'A1B2-C3D4-TODO', false, 'rilievo CRMA-91'],
  ['root', 'A1B2-C3D4-FAKE', false, 'rilievo CRMA-91'],

  // --- I quattro chiusi da 1646980 (CRMA-85): non devono riaprirsi.
  ['root', 'XXX-K9QW2MZZ41PLM3G7', false, 'CRMA-85, tolta la parola `xxx`'],
  ['root', 'A1B2-C3D4-TEST', false, 'CRMA-85, tolta la parola `test`'],
  ['root', 'A1B2-C3D4-SECRET', false, 'CRMA-85'],
  ['root', 'PROD-PASSWORD-9F3A', false, 'CRMA-85'],

  // --- Il punto 1 di CRMA-85: la password vera senza nessuna parola.
  //     E' il caso che ha fatto nascere la lista: `admin:A1B2-C3D4@prod.host` ha la
  //     stessa FORMA di `LA-TUA-PASSWORD`, e i gestori di password generano cosi'.
  ['admin', 'A1B2-C3D4', false, 'CRMA-85 punto 1'],

  // --- I segnaposto veri, che devono restare accettati o il lavoro si ferma ogni giorno.
  ['postgres', 'LA-TUA-PASSWORD', true, 'installazione-e-avvio.md'],
  ['postgres', 'INSERISCI-QUI-LA-TUA-PASSWORD-DEL-DATABASE', true, 'documentazione'],
  ['root', 'MY-DB-PASS-V2', true, 'suffisso di versione, non un pezzo casuale'],
  ['root', 'CHANGE-ME-PASSWORD', true, 'documentazione'],
  ['root', 'YOUR-SECRET-HERE', true, 'documentazione'],
  ['root', '${DB_PASS}', true, 'variabile d\'ambiente non espansa'],
  ['root', '<password>', true, 'segnaposto fra parentesi angolari'],
  ['postgres', 'postgres', true, 'auth-login.smoke.ts: utente uguale a password'],
  ['test-user', 'test-pass', true, 'runtime-env.unit.test.ts'],
  ['user', 'pass', true, 'messaggio d\'errore di runtime-env.ts'],
  ['root', '****', true, 'password oscurata'],
  ['root', 'xxxx', true, 'password oscurata'],

  // --- I quattro misurati in CRMA-108, con l'hook di `origin/main` (34daabf) installato
  //     in un clone usa-e-getta. I primi tre PASSAVANO: la vecchia regola guardava solo il
  //     primo carattere (o solo l'ultimo) e non chiedeva mai che il segnaposto fosse
  //     chiuso. Il quarto e' il controllo — la stessa password senza il metacarattere era
  //     gia' rifiutata prima, ed e' la prova che era il carattere in piu' a disattivare la
  //     cintura, non la password a sembrare finta.
  ['admin', '$uperSegreta2026', false, 'CRMA-108: apre e non chiude'],
  ['admin', '{Xk7Qw2Zz41Plm', false, 'CRMA-108: apre e non chiude'],
  ['admin', 'Xk7Qw2Zz41Plm>', false, 'CRMA-108: chiude e non apre'],
  ['admin', 'Xk7Qw2Zz41Plm', false, 'CRMA-108: il controllo, gia\' rifiutata prima'],

  // --- Il costo dichiarato della stretta di CRMA-91: un segnaposto con un suffisso che
  //     sembra casuale adesso viene RIFIUTATO. Nel repository non esiste (verificato
  //     mettendo in stage l'intero albero) e la via d'uscita e' `git commit --no-verify`.
  //     Sta qui come costo messo per iscritto, non come difetto da correggere.
  ['root', 'TUA-PASSWORD-PROD1', false, 'costo dichiarato di CRMA-91'],

  // --- Residuo noto e NON chiuso: `2026` e' di sole cifre, quindi non "sembra casuale"
  //     (che chiede lettere E cifre nello stesso pezzo), e `SECRET` lo salva.
  //     Dichiarato in CRMA-85, ancora aperto: se un giorno si chiude, questa riga diventa
  //     `false` ed e' il posto giusto dove accorgersene.
  ['root', 'PROD-SECRET-2026', true, 'residuo noto, dichiarato in CRMA-85'],

  // --- Il tetto di lunghezza, ai due lati esatti della soglia.
  [`root`, `${'A'.repeat(60)}-TUA`, true, 'esattamente 64 caratteri: passa'],
  [`root`, `${'A'.repeat(70)}-TUA`, false, 'oltre il tetto: rifiutata'],
];

test('i casi misurati a mano in CRMA-85 e CRMA-91', () => {
  for (const [utente, password, atteso, origine] of CASI) {
    assert.equal(
      eSegnaposto(utente, password),
      atteso,
      `${utente}:${password} doveva essere ${atteso ? 'un segnaposto' : 'un segreto'} (${origine})`,
    );
  }
});

test('la soglia di lunghezza e\' quella dichiarata nei commenti', () => {
  assert.equal(LUNGHEZZA_MASSIMA_SEGNAPOSTO, 64);
  // 42 caratteri: il segnaposto piu' lungo della documentazione deve starci sotto.
  assert.ok('INSERISCI-QUI-LA-TUA-PASSWORD-DEL-DATABASE'.length < LUNGHEZZA_MASSIMA_SEGNAPOSTO);
});

test('sembraCasuale chiede lettere E cifre nello stesso pezzo, da 4 caratteri in su', () => {
  for (const pezzo of ['a1b2', 'c3d4', 'k9qw2mzz41plm3g7', 'prod1', 'v2026', '9f3a']) {
    assert.equal(sembraCasuale(pezzo), true, `${pezzo} doveva sembrare casuale`);
  }
  for (const pezzo of ['tua', 'password', '2026', 'prod', 'v2', 'x', '']) {
    assert.equal(sembraCasuale(pezzo), false, `${pezzo} non doveva sembrare casuale`);
  }
});

test('le due liste non contengono le parole ritirate in CRMA-85', () => {
  // `xxx` e `test` erano il buco del punto 1 con tre lettere davanti. Non tornano:
  // le password tutte-X cadono gia' in /^[*x.]+$/i, i file di test sono esclusi per
  // percorso, e i segnaposto veri che le contengono combaciano su `PASSWORD`.
  for (const parola of ['xxx', 'test']) {
    assert.equal(PAROLE_SEGNAPOSTO.has(parola), false, `\`${parola}\` e' rientrata nella lista`);
  }
  // Le voci sono minuscole: `eSegnapostoMaiuscolo` confronta dopo `toLowerCase()`, e una
  // voce maiuscola sarebbe silenziosamente inerte.
  for (const insieme of [PAROLE_SEGNAPOSTO, PASSWORD_SEGNAPOSTO]) {
    for (const voce of insieme) {
      assert.equal(voce, voce.toLowerCase(), `\`${voce}\` non e' minuscola: non combacerebbe mai`);
    }
  }
});

// ⚠️ La proprieta' che chiude CRMA-108, scritta sulla CLASSE e non sui tre esempi
//    misurati — stessa ragione per cui (P3) piu' sotto e' scritta sul corpus e non sui
//    quattro casi del rilievo di CRMA-91. Un segnaposto delimitato deve APRIRE e CHIUDERE,
//    e deve essere TUTTO il valore: un metacarattere in testa o in coda a una password
//    vera non la trasforma in un segnaposto.
const NOMI = ['DB_PASS', 'PASSWORD', 'password', 'metti-qui', 'DATABASE_URL_PASSWORD'];
const SEGRETI_VERI = ['Xk7Qw2Zz41Plm', 'uperSegreta2026', 'hunter2XYZ9'];

test('(P5) i segnaposto delimitati aprono, chiudono, e sono tutto il valore (CRMA-108)', () => {
  for (const nome of NOMI) {
    // Le tre forme chiuse: sono segnaposto, e devono restare accettate.
    for (const chiuso of [`\${${nome}}`, `{{${nome}}}`, `<${nome}>`]) {
      assert.equal(eSegnapostoDelimitato(chiuso), true, `${chiuso} e' un segnaposto chiuso`);
      assert.equal(eSegnaposto('root', chiuso), true, `${chiuso} doveva passare`);
    }

    // Le stesse forme MONCHE: aperte e mai chiuse, o chiuse e mai aperte. Sono il difetto.
    for (const monco of [
      `\${${nome}`, `{{${nome}`, `<${nome}`, `$${nome}`, `{${nome}`,
      `${nome}}`, `${nome}}}`, `${nome}>`, `\${${nome}}}`, `x\${${nome}}`, `\${${nome}}x`,
      // La graffa singola chiusa: forma non ammessa, dichiarata nel commento di
      // `SEGNAPOSTI_DELIMITATI`. Le due vive sono `${…}` e `{{…}}`.
      `{${nome}}`,
    ]) {
      assert.equal(eSegnapostoDelimitato(monco), false, `${monco} non e' chiuso per intero`);
    }
  }

  // Il cuore della misura di CRMA-108: una password vera resta un segreto anche con un
  // metacarattere appiccicato in testa o in coda. Prima ne bastava uno per disattivare
  // l'intera cintura.
  for (const segreto of SEGRETI_VERI) {
    assert.equal(eSegnaposto('admin', segreto), false, `${segreto} e' un segreto`);
    for (const apre of ['$', '<', '{', '${', '{{']) {
      assert.equal(
        eSegnaposto('admin', apre + segreto), false,
        `${apre}${segreto}: un'apertura senza chiusura non e' un segnaposto`,
      );
    }
    for (const chiude of ['}', '>', '}}']) {
      assert.equal(
        eSegnaposto('admin', segreto + chiude), false,
        `${segreto}${chiude}: una chiusura senza apertura non e' un segnaposto`,
      );
    }
  }
});

test('le forme delimitate sono ancorate ai due capi: nessuna puo\' combaciare a meta\'', () => {
  // Un `^…$` mancante rimetterebbe in piedi il difetto in silenzio, perche' i casi
  // nominati continuerebbero a passare. Qui si guarda la forma, non il suo effetto.
  for (const forma of SEGNAPOSTI_DELIMITATI) {
    assert.ok(forma.source.startsWith('^'), `${forma} non e' ancorata all'inizio`);
    assert.ok(forma.source.endsWith('$'), `${forma} non e' ancorata alla fine`);
  }
});

// ---------------------------------------------------------------------------
// (2) Le proprieta' sul corpus.
//
// Il corpus: ogni parola delle liste, i pezzi casuali incontrati nei rilievi, il rumore
// tipico dei segnaposto, e tutte le combinazioni fino a tre pezzi con entrambi i
// separatori. Sono ~8.000 password, generate invece che elencate.
// ---------------------------------------------------------------------------
const MATTONI = [
  ...PAROLE_SEGNAPOSTO,
  'a1b2', 'c3d4', 'k9qw2mzz41plm3g7', 'prod1', 'v2', 'v2026', '2026', 'sha256',
  'base64', 'prod', 'staging', 'db', 'my', 'la', 'il', '9f3a', 'x', 'xxx', 'test',
];

const CORPUS = new Set();
for (const a of MATTONI) {
  CORPUS.add(a.toUpperCase());
  for (const b of MATTONI) {
    for (const sep of ['-', '_']) {
      CORPUS.add([a, b].join(sep).toUpperCase());
      CORPUS.add([a, sep === '-' ? b : a, b].join(sep).toUpperCase());
    }
  }
}
// Qualche caso fuori forma, per coprire anche i due `return false` anticipati.
for (const extra of [
  '', 'PASSWORD', 'la-tua-password', 'LA TUA PASSWORD', '${DB_PASS}', '****',
  'INSERISCI-QUI-LA-TUA-PASSWORD-DEL-DATABASE', `${'A'.repeat(60)}-TUA`,
  `${'A'.repeat(70)}-TUA`, 'PROD-SECRET-2026', 'TUA-PASSWORD-PROD1',
]) CORPUS.add(extra);

const FORMA_MAIUSCOLA = /^[A-Z0-9]+([-_][A-Z0-9]+)+$/;

test('(P1) fuori dalla forma «MAIUSCOLE con separatori» non e\' mai un segnaposto', () => {
  let visti = 0;
  for (const password of CORPUS) {
    if (FORMA_MAIUSCOLA.test(password)) continue;
    visti += 1;
    assert.equal(eSegnapostoMaiuscolo(password), false, `${password} e' fuori forma`);
  }
  assert.ok(visti > 0, 'il corpus non conteneva nessun caso fuori forma');
});

test('(P2) oltre il tetto di lunghezza non e\' mai un segnaposto', () => {
  const oltre = [...CORPUS].filter(
    (p) => FORMA_MAIUSCOLA.test(p) && p.length > LUNGHEZZA_MASSIMA_SEGNAPOSTO,
  );
  assert.ok(oltre.length > 0, 'il corpus non conteneva nessun caso oltre il tetto');
  for (const password of oltre) {
    assert.equal(eSegnapostoMaiuscolo(password), false, `${password} supera il tetto`);
  }
});

// ⚠️ Questa e' la proprieta' che vale il file. Il rilievo di CRMA-91 era che le parole
//    "forti" facevano `return true` PRIMA del controllo di casualita': quattro esempi
//    passavano, ma il buco era della classe, non dei quattro. Qui si chiede la regola su
//    tutto il corpus, cosi' chi rimette un'uscita anticipata la trova rossa subito.
test('(P3) un pezzo che sembra casuale rifiuta, e nessuna parola della lista lo salva', () => {
  const conPezzoCasuale = [...CORPUS].filter(
    (p) => FORMA_MAIUSCOLA.test(p)
      && p.length <= LUNGHEZZA_MASSIMA_SEGNAPOSTO
      && p.toLowerCase().split(/[-_]/).some(sembraCasuale),
  );
  assert.ok(conPezzoCasuale.length > 100, `casi troppo pochi: ${conPezzoCasuale.length}`);

  // Fra questi ci sono anche quelli che contengono una parola-segnaposto: sono esattamente
  // il buco di CRMA-91, e devono essere rifiutati lo stesso.
  const anchePeggio = conPezzoCasuale.filter(
    (p) => p.toLowerCase().split(/[-_]/).some((pezzo) => PAROLE_SEGNAPOSTO.has(pezzo)),
  );
  assert.ok(anchePeggio.length > 100, `casi del rilievo troppo pochi: ${anchePeggio.length}`);

  for (const password of conPezzoCasuale) {
    assert.equal(eSegnapostoMaiuscolo(password), false, `${password} ha un pezzo casuale`);
  }
});

test('(P4) in forma, sotto il tetto e senza pezzi casuali: decide la lista delle parole', () => {
  let visti = 0;
  for (const password of CORPUS) {
    if (!FORMA_MAIUSCOLA.test(password)) continue;
    if (password.length > LUNGHEZZA_MASSIMA_SEGNAPOSTO) continue;
    const pezzi = password.toLowerCase().split(/[-_]/);
    if (pezzi.some(sembraCasuale)) continue;
    visti += 1;
    assert.equal(
      eSegnapostoMaiuscolo(password),
      pezzi.some((pezzo) => PAROLE_SEGNAPOSTO.has(pezzo)),
      `${password}: doveva decidere la lista delle parole`,
    );
  }
  assert.ok(visti > 100, `casi troppo pochi: ${visti}`);
});

// ---------------------------------------------------------------------------
// (3) I cinque rami di `eSegnaposto`, uno per uno: nessuno deve sparire in una
//     riscrittura. Ogni riga e' l'unico ramo che puo' aver deciso quel caso.
// ---------------------------------------------------------------------------
test('eSegnaposto: i cinque rami sono tutti vivi', () => {
  // ramo 1 - utente uguale alla password, anche a maiuscole diverse
  assert.equal(eSegnaposto('Postgres', 'POSTGRES'), true);
  // ramo 2 - password nella lista delle password intere
  assert.equal(eSegnaposto('root', 'ChangeMe'), true);
  // ramo 3 - segnaposto maiuscolo (delegato a eSegnapostoMaiuscolo)
  assert.equal(eSegnaposto('root', 'LA-TUA-PASSWORD'), true);
  // ramo 4 - interpolazione o parentesi
  assert.equal(eSegnaposto('root', '{{PASSWORD}}'), true);
  assert.equal(eSegnaposto('root', '<metti-qui>'), true);
  // ramo 5 - oscuramento
  assert.equal(eSegnaposto('root', '........'), true);
  // e il caso in cui nessun ramo scatta: un segreto vero
  assert.equal(eSegnaposto('admin', 'hunter2XYZ9'), false);
});
