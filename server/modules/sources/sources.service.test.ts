import test from 'node:test';
import assert from 'node:assert/strict';
import { sourcesService } from './sources.service.js';
import { sourcesRepository } from './sources.repository.js';
import { sourceExtractor } from './sources.extractor.js';
import { audit } from '../../audit/audit.js';

const baseRecord = (over: Record<string, unknown>) => ({
  id: 's1',
  workspaceId: 'w1',
  projectId: 'p1',
  type: 'text',
  title: 'Testo',
  url: null,
  fileName: null,
  mimeType: null,
  fileSize: null,
  content: '',
  contentChars: 0,
  status: 'ready',
  error: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...over,
});

const stubCommon = (t: import('node:test').TestContext) => {
  t.mock.method(sourcesRepository, 'projectBelongsToWorkspace', async () => true);
  t.mock.method(audit, 'log', async () => {});
};

test('createSource testo: normalizza e salva contenuto con stato ready', async (t) => {
  stubCommon(t);
  let created: any;
  t.mock.method(sourcesRepository, 'create', async (input: any) => {
    created = input;
    return baseRecord(input);
  });

  const result = await sourcesService.createSource({
    workspaceId: 'w1',
    projectId: 'p1',
    actorUserId: 'u1',
    body: { type: 'text', title: 'Nota', content: 'Contenuto  di   prova' },
    request: {} as never,
  });

  assert.equal(created.status, 'ready');
  assert.equal(created.type, 'text');
  assert.equal(created.title, 'Nota');
  assert.equal(created.content, 'Contenuto  di   prova');
  assert.equal(created.contentChars, 'Contenuto  di   prova'.length);
  assert.equal(result.status, 'ready');
});

test('createSource url ok: usa l\'estrattore, titolo dedotto dalla pagina', async (t) => {
  stubCommon(t);
  t.mock.method(sourceExtractor, 'fromUrl', async () => ({ content: 'Testo estratto', title: 'Home' }));
  let created: any;
  t.mock.method(sourcesRepository, 'create', async (input: any) => {
    created = input;
    return baseRecord(input);
  });

  await sourcesService.createSource({
    workspaceId: 'w1',
    projectId: 'p1',
    actorUserId: 'u1',
    body: { type: 'url', url: 'https://esempio.it' },
    request: {} as never,
  });

  assert.equal(created.type, 'url');
  assert.equal(created.url, 'https://esempio.it/');
  assert.equal(created.title, 'Home'); // titolo dedotto
  assert.equal(created.content, 'Testo estratto');
  assert.equal(created.status, 'ready');
});

test('createSource url fallita: creata comunque con stato error e messaggio', async (t) => {
  stubCommon(t);
  const { SourceExtractionError } = await import('./sources.extractor.js');
  t.mock.method(sourceExtractor, 'fromUrl', async () => {
    throw new SourceExtractionError('URL non raggiungibile (stato 500)');
  });
  let created: any;
  t.mock.method(sourcesRepository, 'create', async (input: any) => {
    created = input;
    return baseRecord(input);
  });

  const result = await sourcesService.createSource({
    workspaceId: 'w1',
    projectId: 'p1',
    actorUserId: 'u1',
    body: { type: 'url', url: 'https://esempio.it' },
    request: {} as never,
  });

  assert.equal(created.status, 'error');
  assert.equal(created.content, null);
  assert.match(created.error, /non raggiungibile/);
  assert.equal(result.status, 'error');
});

test('createSource: tipo file va sull\'endpoint dedicato, non su body.type', async (t) => {
  stubCommon(t);
  await assert.rejects(
    () =>
      sourcesService.createSource({
        workspaceId: 'w1',
        projectId: 'p1',
        actorUserId: 'u1',
        body: { type: 'file' },
        request: {} as never,
      }),
    /endpoint dedicato/i,
  );
});

test('createFileSource: estrae testo dal file e salva come tipo file/ready', async (t) => {
  stubCommon(t);
  let created: any;
  t.mock.method(sourcesRepository, 'create', async (input: any) => {
    created = input;
    return baseRecord(input);
  });

  const result = await sourcesService.createFileSource({
    workspaceId: 'w1',
    projectId: 'p1',
    actorUserId: 'u1',
    file: { buffer: Buffer.from('Contenuto del documento', 'utf8'), fileName: 'brief.txt', mimeType: 'text/plain' },
    request: {} as never,
  });

  assert.equal(created.type, 'file');
  assert.equal(created.title, 'brief.txt'); // titolo di default = nome file
  assert.equal(created.fileName, 'brief.txt');
  assert.equal(created.mimeType, 'text/plain');
  assert.equal(created.fileSize, Buffer.from('Contenuto del documento', 'utf8').length);
  assert.equal(created.content, 'Contenuto del documento');
  assert.equal(created.status, 'ready');
  assert.equal(result.status, 'ready');
});

test('createFileSource: file illeggibile salvato con stato error e messaggio', async (t) => {
  stubCommon(t);
  let created: any;
  t.mock.method(sourcesRepository, 'create', async (input: any) => {
    created = input;
    return baseRecord(input);
  });

  const result = await sourcesService.createFileSource({
    workspaceId: 'w1',
    projectId: 'p1',
    actorUserId: 'u1',
    file: { buffer: Buffer.from([0, 1, 2, 3]), fileName: 'immagine.png', mimeType: 'image/png' },
    request: {} as never,
  });

  assert.equal(created.type, 'file');
  assert.equal(created.status, 'error');
  assert.equal(created.content, null);
  assert.match(created.error, /non supportato/i);
  assert.equal(result.status, 'error');
});

test('createFileSource: file vuoto rifiutato', async (t) => {
  stubCommon(t);
  await assert.rejects(
    () =>
      sourcesService.createFileSource({
        workspaceId: 'w1',
        projectId: 'p1',
        actorUserId: 'u1',
        file: { buffer: Buffer.alloc(0), fileName: 'vuoto.txt', mimeType: 'text/plain' },
        request: {} as never,
      }),
    /vuoto/i,
  );
});

test('createSource: url non valido rifiutato', async (t) => {
  stubCommon(t);
  await assert.rejects(
    () =>
      sourcesService.createSource({
        workspaceId: 'w1',
        projectId: 'p1',
        actorUserId: 'u1',
        body: { type: 'url', url: 'non-un-url' },
        request: {} as never,
      }),
    /url non valido/i,
  );
});

test('listSources: progetto non del workspace -> notFound', async (t) => {
  t.mock.method(sourcesRepository, 'projectBelongsToWorkspace', async () => false);
  await assert.rejects(
    () => sourcesService.listSources('w1', 'p-altro'),
    /progetto non trovato/i,
  );
});

test('deleteSource: fonte inesistente -> notFound', async (t) => {
  t.mock.method(sourcesRepository, 'findById', async () => null);
  await assert.rejects(
    () =>
      sourcesService.deleteSource({
        workspaceId: 'w1',
        id: 'x',
        actorUserId: 'u1',
        request: {} as never,
      }),
    /fonte non trovata/i,
  );
});
