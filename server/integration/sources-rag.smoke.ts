import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapRuntime } from '../bootstrap/startup.js';
import { initializePrisma, prisma, resetPrismaForTests } from '../prisma.js';
import {
  EMBEDDING_DIMENSIONS,
  reindexSource,
  searchProjectSources,
  type Embedder,
} from '../modules/sources/sources.rag.js';
import { indexSourceBestEffort } from '../modules/sources/sources.indexing.js';
import { sourcesRepository } from '../modules/sources/sources.repository.js';

// Embedder deterministico locale: bag-of-words con hashing su 1536 dimensioni.
// Non serve una chiave OpenAI: testi che condividono parole ottengono vettori
// simili, sufficiente a verificare che la ricerca per similarità coseno funzioni
// end-to-end (spezzettamento → salvataggio in pgvector → recupero ordinato).
const hashingEmbedder: Embedder = async (texts) =>
  texts.map((text) => {
    const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
    const tokens = text.toLowerCase().split(/[^a-z0-9àèéìòù]+/).filter(Boolean);
    for (const token of tokens) {
      let hash = 0;
      for (let i = 0; i < token.length; i += 1) {
        hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
      }
      vector[hash % EMBEDDING_DIMENSIONS] += 1;
    }
    return vector;
  });

const CONTENT_GATTI = [
  'Il gatto domestico ha bisogno di vaccini periodici.',
  'Il veterinario consiglia il richiamo del vaccino ogni anno per proteggere il gatto.',
  'Le visite dal veterinario servono a tenere sano un animale domestico come il gatto.',
].join(' ');

const CONTENT_FATTURE = [
  'La fatturazione elettronica è obbligatoria per chi ha partita IVA.',
  'Il regime forfettario semplifica gli adempimenti IVA per i piccoli professionisti.',
  'Il commercialista invia le fatture elettroniche al Sistema di Interscambio.',
].join(' ');

test('RAG fonti: la ricerca semantica ordina i chunk giusti (pgvector end-to-end)', async (t) => {
  const runtimeEnv = bootstrapRuntime();
  initializePrisma(runtimeEnv.databaseUrl);

  // Salta se il DB non è raggiungibile o pgvector non è installato.
  try {
    const ext = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = 'vector'`;
    if (ext.length === 0) {
      t.skip('Estensione pgvector non installata: salto lo smoke test RAG.');
      return;
    }
  } catch (error) {
    t.skip(`Database non raggiungibile per lo smoke test RAG: ${(error as Error).message}`);
    return;
  }

  const suffix = `${Date.now()}-${Math.floor(process.hrtime()[1] % 1_000_000)}`;
  let workspaceId: string | null = null;

  try {
    const workspace = await prisma.workspace.create({
      data: { name: 'RAG Smoke', slug: `rag-smoke-${suffix}` },
    });
    workspaceId = workspace.id;
    const project = await prisma.project.create({
      data: { workspaceId: workspace.id, name: 'Progetto RAG Smoke' },
    });

    const makeSource = (title: string, content: string) =>
      prisma.projectSource.create({
        data: {
          workspaceId: workspace.id,
          projectId: project.id,
          type: 'text',
          title,
          url: null,
          fileName: null,
          mimeType: null,
          fileSize: null,
          content,
          contentChars: content.length,
          status: 'ready',
          error: null,
        },
      });

    const sourceGatti = await makeSource('Gatti e veterinario', CONTENT_GATTI);
    const sourceFatture = await makeSource('Fatturazione elettronica', CONTENT_FATTURE);

    const indexedGatti = await reindexSource({
      workspaceId: workspace.id,
      projectId: project.id,
      sourceId: sourceGatti.id,
      content: CONTENT_GATTI,
      embedder: hashingEmbedder,
    });
    const indexedFatture = await reindexSource({
      workspaceId: workspace.id,
      projectId: project.id,
      sourceId: sourceFatture.id,
      content: CONTENT_FATTURE,
      embedder: hashingEmbedder,
    });
    assert.ok(indexedGatti.chunks >= 1, 'la fonte gatti deve avere almeno un chunk');
    assert.ok(indexedFatture.chunks >= 1, 'la fonte fatture deve avere almeno un chunk');

    // Domanda sul primo tema → in cima deve arrivare la fonte "gatti".
    const hitsGatti = await searchProjectSources({
      workspaceId: workspace.id,
      projectId: project.id,
      query: 'quanto costa il vaccino per il gatto dal veterinario',
      topK: 3,
      embedder: hashingEmbedder,
    });
    assert.ok(hitsGatti.length > 0, 'la ricerca deve restituire risultati');
    assert.equal(hitsGatti[0].sourceId, sourceGatti.id, 'il primo risultato deve essere la fonte gatti');

    // Domanda sul secondo tema → in cima deve arrivare la fonte "fatture".
    const hitsFatture = await searchProjectSources({
      workspaceId: workspace.id,
      projectId: project.id,
      query: 'come funziona la fatturazione elettronica con partita IVA',
      topK: 3,
      embedder: hashingEmbedder,
    });
    assert.ok(hitsFatture.length > 0, 'la ricerca deve restituire risultati');
    assert.equal(hitsFatture[0].sourceId, sourceFatture.id, 'il primo risultato deve essere la fonte fatture');

    // Lo score di similarità è nell'intervallo atteso (1 - distanza coseno).
    assert.ok(hitsGatti[0].score > 0 && hitsGatti[0].score <= 1.0001, `score fuori range: ${hitsGatti[0].score}`);

    // La cancellazione della fonte rimuove i suoi chunk (FK cascade).
    await prisma.projectSource.delete({ where: { id: sourceGatti.id } });
    const remaining = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::bigint AS count FROM "ProjectSourceChunk" WHERE "sourceId" = ${sourceGatti.id}`;
    assert.equal(Number(remaining[0].count), 0, 'i chunk devono sparire con la fonte (cascade)');
  } finally {
    // Pulizia: eliminando il workspace cascata su progetto, fonti e chunk.
    if (workspaceId) {
      await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
    }
    await resetPrismaForTests();
  }
});

test('RAG fonti: indexSourceBestEffort indicizza le pronte, salta errore e no-key', async (t) => {
  const runtimeEnv = bootstrapRuntime();
  initializePrisma(runtimeEnv.databaseUrl);

  try {
    const ext = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = 'vector'`;
    if (ext.length === 0) {
      t.skip('Estensione pgvector non installata: salto lo smoke test RAG.');
      return;
    }
  } catch (error) {
    t.skip(`Database non raggiungibile per lo smoke test RAG: ${(error as Error).message}`);
    return;
  }

  const suffix = `${Date.now()}-${Math.floor(process.hrtime()[1] % 1_000_000)}`;
  let workspaceId: string | null = null;
  const countChunks = async (sourceId: string) => {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::bigint AS count FROM "ProjectSourceChunk" WHERE "sourceId" = ${sourceId}`;
    return Number(rows[0].count);
  };

  try {
    const workspace = await prisma.workspace.create({
      data: { name: 'RAG Wiring', slug: `rag-wiring-${suffix}` },
    });
    workspaceId = workspace.id;
    const project = await prisma.project.create({
      data: { workspaceId: workspace.id, name: 'Progetto RAG Wiring' },
    });
    const content = 'Contenuto valido di una fonte da indicizzare per il RAG.';
    const source = await prisma.projectSource.create({
      data: {
        workspaceId: workspace.id,
        projectId: project.id,
        type: 'text',
        title: 'Fonte wiring',
        url: null,
        fileName: null,
        mimeType: null,
        fileSize: null,
        content,
        contentChars: content.length,
        status: 'ready',
        error: null,
      },
    });

    // Fonte pronta con embedder iniettato → indicizzata.
    const ready = await indexSourceBestEffort(
      { workspaceId: workspace.id, projectId: project.id, id: source.id, content, status: 'ready' },
      { embedderResolver: async () => hashingEmbedder },
    );
    assert.equal(ready.indexed, true, 'una fonte pronta deve essere indicizzata');
    assert.ok((ready.chunks ?? 0) >= 1);
    assert.ok((await countChunks(source.id)) >= 1, 'i chunk devono essere presenti dopo l\'indicizzazione');

    // Il conteggio chunk per la UI (badge "indicizzata / N blocchi") è corretto.
    const counts = await sourcesRepository.countChunksBySource([source.id]);
    assert.equal(counts[source.id], ready.chunks, 'countChunksBySource deve combaciare col numero di chunk');

    // Nessuna chiave (resolver → null) → saltata, ma i chunk esistenti restano.
    const noKey = await indexSourceBestEffort(
      { workspaceId: workspace.id, projectId: project.id, id: source.id, content, status: 'ready' },
      { embedderResolver: async () => null },
    );
    assert.equal(noKey.indexed, false);
    assert.equal(noKey.reason, 'no-openai-key');

    // Fonte non pronta (errore/vuota) → nessun chunk: quelli vecchi vengono rimossi.
    const notReady = await indexSourceBestEffort(
      { workspaceId: workspace.id, projectId: project.id, id: source.id, content: null, status: 'error' },
      { embedderResolver: async () => hashingEmbedder },
    );
    assert.equal(notReady.indexed, false);
    assert.equal(notReady.reason, 'not-ready');
    assert.equal(await countChunks(source.id), 0, 'i chunk devono essere rimossi per una fonte in errore');
  } finally {
    if (workspaceId) {
      await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
    }
    await resetPrismaForTests();
  }
});
