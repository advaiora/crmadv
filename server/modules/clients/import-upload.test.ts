import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { isHttpError } from '../../core/errors.js';
import { readClientImportUpload, MAX_IMPORT_FILE_BYTES } from './import-file.js';

// Prova che il file arriva davvero come allegato, e che il vecchio tetto di
// ~1 MB (il bodyLimit di Fastify sul corpo JSON) non c'entra piu' niente.
// L'app di prova registra il multipart con gli stessi limiti di app.ts.
const buildApp = () => {
  const app = Fastify();
  void app.register(multipart, {
    limits: {
      files: 1,
      fileSize: MAX_IMPORT_FILE_BYTES,
    },
  });

  app.post('/clients/import', async (request, reply) => {
    try {
      const upload = await readClientImportUpload(request);
      return reply.send({
        bytes: upload.buffer.length,
        filename: upload.filename,
        dryRun: upload.dryRun,
        firstLine: upload.buffer.subarray(0, 40).toString('utf8').split('\n')[0],
      });
    } catch (error) {
      if (isHttpError(error)) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  return app;
};

const BOUNDARY = '----ProvaImportClienti';

type Field = { name: string; value: string } | { name: string; filename: string; content: Buffer };

const buildMultipartBody = (fields: Field[]) => {
  const chunks: Buffer[] = [];

  fields.forEach((field) => {
    chunks.push(Buffer.from(`--${BOUNDARY}\r\n`));
    if ('filename' in field) {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${field.name}"; filename="${field.filename}"\r\n` +
            'Content-Type: text/csv\r\n\r\n',
        ),
      );
      chunks.push(field.content);
    } else {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${field.name}"\r\n\r\n`));
      chunks.push(Buffer.from(field.value));
    }
    chunks.push(Buffer.from('\r\n'));
  });

  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`));

  return Buffer.concat(chunks);
};

const post = (app: ReturnType<typeof buildApp>, body: Buffer) =>
  app.inject({
    method: 'POST',
    url: '/clients/import',
    payload: body,
    headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
  });

// Anagrafiche finte, ma di peso vero: servono a superare il vecchio tetto.
const buildCsvOfAtLeast = (bytes: number) => {
  const lines = ['name,email,phone'];
  let size = lines[0].length;
  let index = 0;

  while (size < bytes) {
    const line = `Cliente numero ${index},cliente${index}@example.com,033300${index}`;
    lines.push(line);
    size += line.length + 1;
    index += 1;
  }

  return Buffer.from(lines.join('\n'), 'utf8');
};

test('un file da oltre 1 MB arriva intero, dove prima non passava', async () => {
  const app = buildApp();
  await app.ready();
  const csv = buildCsvOfAtLeast(1_500_000);

  const response = await post(app, buildMultipartBody([{ name: 'file', filename: 'clienti.csv', content: csv }]));

  assert.equal(response.statusCode, 200);
  assert.ok(csv.length > 1024 * 1024, 'il file di prova deve superare il vecchio tetto di 1 MiB');
  assert.equal(response.json().bytes, csv.length);
  assert.equal(response.json().firstLine, 'name,email,phone');
  await app.close();
});

test('un file oltre il tetto viene rifiutato in italiano, non con un errore generico', async () => {
  const app = buildApp();
  await app.ready();
  const troppoGrande = buildCsvOfAtLeast(MAX_IMPORT_FILE_BYTES + 512 * 1024);

  const response = await post(
    app,
    buildMultipartBody([{ name: 'file', filename: 'clienti.csv', content: troppoGrande }]),
  );

  assert.equal(response.statusCode, 400);
  assert.match(response.json().message, /supera il limite di 20MB/);
  await app.close();
});

test('la prova senza salvare viaggia come campo del modulo accanto al file', async () => {
  const app = buildApp();
  await app.ready();

  const response = await post(
    app,
    buildMultipartBody([
      { name: 'dryRun', value: 'true' },
      { name: 'file', filename: 'clienti.csv', content: Buffer.from('name\nRossi', 'utf8') },
    ]),
  );

  assert.equal(response.json().dryRun, true);
  await app.close();
});

test('senza il campo dryRun l import salva, come faceva prima', async () => {
  const app = buildApp();
  await app.ready();

  const response = await post(
    app,
    buildMultipartBody([{ name: 'file', filename: 'clienti.csv', content: Buffer.from('name\nRossi', 'utf8') }]),
  );

  assert.equal(response.json().dryRun, false);
  await app.close();
});

test('una richiesta senza file lo dice, invece di rispondere a vuoto', async () => {
  const app = buildApp();
  await app.ready();

  const response = await post(app, buildMultipartBody([{ name: 'dryRun', value: 'true' }]));

  assert.equal(response.statusCode, 400);
  assert.match(response.json().message, /Nessun file caricato/);
  await app.close();
});

// La rotta sceglie la strada guardando `request.isMultipart()`: e' il bivio fra
// l'allegato e la vecchia forma JSON, e vale la pena vederlo funzionare.
test('il bivio della rotta: multipart di qua, corpo JSON di la', async () => {
  const app = Fastify();
  void app.register(multipart, { limits: { files: 1, fileSize: MAX_IMPORT_FILE_BYTES } });
  app.post('/clients/import', async (request, reply) => reply.send({ multipart: request.isMultipart() }));
  await app.ready();

  const allegato = await post(
    app,
    buildMultipartBody([{ name: 'file', filename: 'clienti.csv', content: Buffer.from('name\nRossi', 'utf8') }]),
  );
  assert.equal(allegato.json().multipart, true);

  const jsonBody = await app.inject({
    method: 'POST',
    url: '/clients/import',
    payload: { csv: 'name\nRossi' },
  });
  assert.equal(jsonBody.json().multipart, false);

  await app.close();
});
