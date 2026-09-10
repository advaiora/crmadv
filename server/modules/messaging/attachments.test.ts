// Allegati ai messaggi interni (A1 punto 8a, CRMA-30) — i limiti che il compito chiede
// di applicare SUL SERVER, provati sul server.
//
// Qui si prova solo la parte PURA (validazione, limiti, sanificazione del nome): non
// tocca il database, quindi gira in `npm run test:unit` senza bisogno di Postgres. Il
// filtro per workspace e appartenenza alla conversazione vive nel service e ha bisogno
// di dati veri: quello lo verifica il Collaudatore a schermo, e lo ricontrolla l'audit
// del punto 11.

import assert from 'node:assert/strict';
import test from 'node:test';
import { isHttpError } from '../../core/errors.js';
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  sanitizeAttachmentLabel,
  validateAttachment,
} from './attachments.js';

const pdf = (size: number) => ({
  buffer: Buffer.alloc(size, 1),
  fileName: 'preventivo.pdf',
  mimeType: 'application/pdf',
});

// Il compito chiede il rifiuto "con un messaggio comprensibile, non con un errore
// tecnico": si controlla che sia un 400 e che il testo sia in italiano, non solo che
// qualcosa sia esploso.
const expectBadRequest = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    assert.equal(isHttpError(error), true, 'deve essere un HttpError, non un errore grezzo');
    assert.equal((error as { statusCode: number }).statusCode, 400);
    return error as Error;
  }

  throw new assert.AssertionError({ message: 'era attesa una richiesta rifiutata' });
};

test('un allegato valido passa e torna normalizzato', () => {
  const result = validateAttachment(pdf(1024));

  assert.equal(result.mimeType, 'application/pdf');
  assert.equal(result.label, 'preventivo.pdf');
  assert.equal(result.fileSize, 1024);
});

test('il file vuoto viene rifiutato', () => {
  const error = expectBadRequest(() => validateAttachment(pdf(0)));
  assert.match(error.message, /vuoto/i);
});

test('oltre il limite di dimensione il file viene rifiutato, con i MB scritti in chiaro', () => {
  const error = expectBadRequest(() => validateAttachment(pdf(MAX_ATTACHMENT_BYTES + 1)));

  // Il messaggio deve dire "10 MB", non "10485760": e' la differenza fra un rifiuto
  // comprensibile e un errore tecnico.
  assert.match(error.message, /10 MB/);
  assert.doesNotMatch(error.message, /\d{7,}/, 'niente byte grezzi nel messaggio');
});

test('esattamente al limite il file passa: il tetto e\u2019 incluso', () => {
  const result = validateAttachment(pdf(MAX_ATTACHMENT_BYTES));
  assert.equal(result.fileSize, MAX_ATTACHMENT_BYTES);
});

test('un tipo fuori elenco viene rifiutato', () => {
  const error = expectBadRequest(() =>
    validateAttachment({
      buffer: Buffer.alloc(16, 1),
      fileName: 'installer.exe',
      mimeType: 'application/x-msdownload',
    }),
  );
  assert.match(error.message, /non ammesso/i);
});

// ⚠️ Il caso che ha motivato questo test: l'SVG e' escluso di proposito (puo' contenere
// <script>, e servito dalla nostra origine diventerebbe XSS). Se qualcuno lo rimettesse
// nell'elenco senza accorgersene, qui si accende un rosso.
test('l\u2019SVG resta fuori dai tipi ammessi', () => {
  assert.equal(ALLOWED_ATTACHMENT_MIME_TYPES.includes('image/svg+xml'), false);

  expectBadRequest(() =>
    validateAttachment({
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'),
      fileName: 'logo.svg',
      mimeType: 'image/svg+xml',
    }),
  );
});

// Il messaggio di rifiuto elenca i tipi buoni. Se elencasse un tipo che il server poi
// rifiuta, manderebbe la persona a riprovare a vuoto: e' il difetto trovato il 10/9/2026,
// quando il testo prometteva SVG mentre l'elenco lo escludeva.
test('il messaggio di rifiuto non promette tipi che il server non accetta', () => {
  const error = expectBadRequest(() =>
    validateAttachment({
      buffer: Buffer.alloc(16, 1),
      fileName: 'installer.exe',
      mimeType: 'application/x-msdownload',
    }),
  );

  assert.doesNotMatch(
    error.message,
    /SVG/i,
    'il testo non deve nominare l\u2019SVG finche\u2019 non e\u2019 fra i tipi ammessi',
  );
});

test('il tipo con i parametri del browser viene normalizzato', () => {
  const result = validateAttachment({
    buffer: Buffer.from('nome;cognome\n'),
    fileName: 'contatti.csv',
    mimeType: 'text/CSV; charset=UTF-8',
  });

  assert.equal(result.mimeType, 'text/csv');
});

test('il nome del file perde i percorsi: non si scrive fuori da dove si deve', () => {
  assert.equal(sanitizeAttachmentLabel('../../etc/passwd'), 'passwd');
  assert.equal(sanitizeAttachmentLabel('C:\\Users\\jacopo\\nota.txt'), 'nota.txt');
});

test('il nome del file perde i caratteri di controllo: niente header injection', () => {
  const label = sanitizeAttachmentLabel('nota\r\nContent-Type: text/html\u0000.txt');

  assert.doesNotMatch(label, /[\r\n\u0000]/);
});

test('un nome lungo viene troncato e un nome vuoto ha un ripiego', () => {
  assert.equal(sanitizeAttachmentLabel(`${'a'.repeat(500)}.pdf`).length, 200);
  assert.equal(sanitizeAttachmentLabel('   '), 'allegato');
  assert.equal(sanitizeAttachmentLabel('../'), 'allegato');
});
