import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getFileExtension,
  normalizeText,
  sourceExtractor,
  SourceExtractionError,
} from './sources.extractor.js';

const htmlResponse = (html: string, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'text/html; charset=utf-8' },
    text: async () => html,
  }) as unknown as Response;

test('normalizeText: uniforma newline, comprime righe vuote e taglia gli spazi', () => {
  const out = normalizeText('  riga1\r\n\r\n\r\n\r\nriga2  \n');
  assert.equal(out, 'riga1\n\nriga2');
});

test('fromUrl: estrae titolo e testo da HTML, rimuovendo script/style', async () => {
  const html =
    '<html><head><title>Titolo Pagina</title><style>.x{color:red}</style></head>' +
    '<body><script>var a=1;</script><h1>Ciao</h1><p>Mondo &amp; co.</p></body></html>';
  const result = await sourceExtractor.fromUrl('https://esempio.it', async () => htmlResponse(html));
  assert.equal(result.title, 'Titolo Pagina');
  assert.equal(result.content, 'Ciao Mondo & co.');
});

test('fromUrl: stato non-200 genera SourceExtractionError', async () => {
  await assert.rejects(
    () => sourceExtractor.fromUrl('https://esempio.it/404', async () => htmlResponse('', 404)),
    (error: unknown) => error instanceof SourceExtractionError && /stato 404/.test((error as Error).message),
  );
});

test('fromUrl: errore di rete genera SourceExtractionError', async () => {
  await assert.rejects(
    () =>
      sourceExtractor.fromUrl('https://esempio.it', async () => {
        throw new Error('ECONNREFUSED');
      }),
    (error: unknown) => error instanceof SourceExtractionError,
  );
});

test('fromUrl: HTML senza testo utile genera errore "nessun testo"', async () => {
  await assert.rejects(
    () => sourceExtractor.fromUrl('https://esempio.it', async () => htmlResponse('<html><body>   </body></html>')),
    (error: unknown) => error instanceof SourceExtractionError && /nessun testo/i.test((error as Error).message),
  );
});

test('getFileExtension: minuscolo col punto, o stringa vuota se assente', () => {
  assert.equal(getFileExtension('Brief Cliente.PDF'), '.pdf');
  assert.equal(getFileExtension('note.finali.docx'), '.docx');
  assert.equal(getFileExtension('senza-estensione'), '');
});

test('fromFile: estrae testo da .txt normalizzandolo', async () => {
  const buffer = Buffer.from('  Riga uno\r\n\r\n\r\n\r\nRiga due  ', 'utf8');
  const result = await sourceExtractor.fromFile({ buffer, fileName: 'appunti.txt' });
  assert.equal(result.content, 'Riga uno\n\nRiga due');
  assert.equal(result.title, null);
});

test('fromFile: legge anche .csv e .md come testo', async () => {
  const csv = await sourceExtractor.fromFile({ buffer: Buffer.from('a,b\n1,2', 'utf8'), fileName: 'dati.csv' });
  assert.equal(csv.content, 'a,b\n1,2');
  const md = await sourceExtractor.fromFile({ buffer: Buffer.from('# Titolo', 'utf8'), fileName: 'readme.md' });
  assert.equal(md.content, '# Titolo');
});

test('fromFile: formato non supportato genera SourceExtractionError', async () => {
  await assert.rejects(
    () => sourceExtractor.fromFile({ buffer: Buffer.from([0, 1, 2]), fileName: 'foto.png' }),
    (error: unknown) => error instanceof SourceExtractionError && /non supportato/i.test((error as Error).message),
  );
});

test('fromFile: file di testo vuoto genera errore "nessun testo estraibile"', async () => {
  await assert.rejects(
    () => sourceExtractor.fromFile({ buffer: Buffer.from('   \n  ', 'utf8'), fileName: 'vuoto.txt' }),
    (error: unknown) => error instanceof SourceExtractionError && /nessun testo/i.test((error as Error).message),
  );
});
