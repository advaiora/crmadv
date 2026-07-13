import { randomUUID } from 'node:crypto';
import { prisma } from '../../prisma.js';
import { requestContext } from '../../core/request-context.js';
import { aiUsageRepository } from '../../repositories/ai-usage.repository.js';

// Vettorizzazione/RAG delle fonti di progetto (V4). Mattoni riusabili e testabili:
// spezzettamento del testo, generazione embedding (OpenAI), reindicizzazione di una
// fonte (chunk + embedding salvati in pgvector) e ricerca semantica per similarità
// coseno. L'aggancio ai flussi (createSource / motore AI) è un passo successivo:
// qui restano funzioni pure/di storage, senza dipendenze dal modulo agency-os.

// Modello e dimensione degli embedding. text-embedding-3-small = 1536 dimensioni,
// coerente con la colonna `vector(1536)` di ProjectSourceChunk. Anthropic non ha
// un'API di embedding: la vettorizzazione usa sempre OpenAI (Claude resta per la
// generazione di testo).
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;
const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';

// Parametri di default dello spezzettamento. ~2000 caratteri per blocco (≈500
// token) con 200 di sovrapposizione per non perdere il contesto ai bordi.
const DEFAULT_MAX_CHARS = 2000;
const DEFAULT_OVERLAP = 200;

// Un embedder è una funzione che trasforma N testi in N vettori. Astratto apposta:
// in produzione è OpenAI, nei test si inietta un embedder deterministico locale.
export type Embedder = (texts: string[]) => Promise<number[][]>;

// Spezzetta un testo in blocchi di ~maxChars caratteri con sovrapposizione,
// tagliando preferibilmente su uno spazio per non spezzare le parole a metà.
export const chunkText = (
  text: string,
  options?: { maxChars?: number; overlap?: number },
): string[] => {
  const maxChars = Math.max(options?.maxChars ?? DEFAULT_MAX_CHARS, 100);
  const overlap = Math.min(Math.max(options?.overlap ?? DEFAULT_OVERLAP, 0), maxChars - 1);
  const clean = (text ?? '').replace(/\r\n/g, '\n').trim();
  if (!clean) {
    return [];
  }
  if (clean.length <= maxChars) {
    return [clean];
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + maxChars, clean.length);
    // Se non siamo alla fine, prova a tagliare su uno spazio nella seconda metà
    // del blocco (evita parole troncate senza produrre blocchi troppo corti).
    if (end < clean.length) {
      const lastSpace = clean.lastIndexOf(' ', end);
      if (lastSpace > start + maxChars * 0.5) {
        end = lastSpace;
      }
    }
    const piece = clean.slice(start, end).trim();
    if (piece) {
      chunks.push(piece);
    }
    if (end >= clean.length) {
      break;
    }
    // Riparte indietro di `overlap` per mantenere continuità tra i blocchi.
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
};

// Massimo di testi per richiesta a OpenAI: documenti lunghi generano molti chunk,
// che vanno spezzati in più chiamate per non superare i limiti dell'API.
const EMBEDDING_BATCH_SIZE = 96;

const embedBatch = async (
  apiKey: string,
  texts: string[],
): Promise<{ vectors: number[][]; tokens: number }> => {
  const response = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`OpenAI embeddings error ${response.status}: ${detail.slice(0, 300)}`);
  }
  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
    usage?: { prompt_tokens?: number };
  };
  const rows = payload.data ?? [];
  if (rows.length !== texts.length) {
    throw new Error(`OpenAI embeddings: attesi ${texts.length} vettori, ricevuti ${rows.length}`);
  }
  const vectors = rows.map((row) => {
    const vector = row.embedding ?? [];
    if (vector.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Embedding di dimensione inattesa: ${vector.length} (attese ${EMBEDDING_DIMENSIONS})`);
    }
    return vector;
  });
  return { vectors, tokens: payload.usage?.prompt_tokens ?? 0 };
};

// Embedder reale su OpenAI (text-embedding-3-small → 1536 dim). Spezza i testi in
// lotti (batch) per gestire anche fonti con molti chunk. Valida numero e dimensione.
// `onUsage` (opzionale) riceve i token consumati totali, per il tracciamento costi.
export const createOpenAiEmbedder = (
  apiKey: string,
  onUsage?: (usage: { promptTokens: number }) => void,
): Embedder => async (texts) => {
  if (texts.length === 0) {
    return [];
  }
  const vectors: number[][] = [];
  let totalTokens = 0;
  for (let start = 0; start < texts.length; start += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(start, start + EMBEDDING_BATCH_SIZE);
    const embedded = await embedBatch(apiKey, batch);
    vectors.push(...embedded.vectors);
    totalTokens += embedded.tokens;
  }
  onUsage?.({ promptTokens: totalTokens });
  return vectors;
};

// Prezzo embeddings (text-embedding-3-small): $0.02 per 1M token (solo input).
export const EMBEDDING_COST_PER_MILLION_TOKENS = 0.02;
export const estimateEmbeddingCostUsd = (tokens: number): number =>
  Number(((tokens / 1_000_000) * EMBEDDING_COST_PER_MILLION_TOKENS).toFixed(6));

// Registra l'uso degli embedding nel log costi AI (best-effort: non solleva mai).
// L'utente è quello del contesto di richiesta (null per job di sistema).
const recordEmbeddingUsage = async (input: {
  workspaceId: string;
  functionName: string;
  promptTokens: number;
  durationMs: number;
}): Promise<void> => {
  if (!input.workspaceId || input.promptTokens <= 0) {
    return;
  }
  try {
    await aiUsageRepository.create({
      workspaceId: input.workspaceId,
      userId: requestContext.getUserId(),
      functionName: input.functionName,
      model: EMBEDDING_MODEL,
      inputTokens: input.promptTokens,
      outputTokens: 0,
      costUsd: estimateEmbeddingCostUsd(input.promptTokens),
      durationMs: input.durationMs,
      status: 'success',
    });
  } catch {
    // accessorio: il log costi non deve mai rompere indicizzazione/ricerca
  }
};

// Embedder OpenAI che, oltre a generare i vettori, registra i consumi nel log costi
// AI. Usato dai flussi reali (indicizzazione e ricerca); i test iniettano un embedder
// deterministico e non passano di qui.
export const createLoggingOpenAiEmbedder = (input: {
  apiKey: string;
  workspaceId: string;
  functionName: string;
}): Embedder => async (texts) => {
  const startedAt = Date.now();
  let promptTokens = 0;
  const embedder = createOpenAiEmbedder(input.apiKey, (usage) => {
    promptTokens += usage.promptTokens;
  });
  const vectors = await embedder(texts);
  await recordEmbeddingUsage({
    workspaceId: input.workspaceId,
    functionName: input.functionName,
    promptTokens,
    durationMs: Date.now() - startedAt,
  });
  return vectors;
};

// Rappresentazione testuale di un vettore per pgvector: `[0.1,0.2,...]`.
const toVectorLiteral = (vector: number[]): string => `[${vector.join(',')}]`;

// Cancella tutti i chunk di una fonte (usata quando la fonte diventa vuota/in errore).
export const deleteSourceChunks = async (sourceId: string): Promise<void> => {
  await prisma.$executeRaw`DELETE FROM "ProjectSourceChunk" WHERE "sourceId" = ${sourceId}`;
};

// Reindicizza una fonte: cancella i chunk esistenti e reinserisce quelli nuovi con
// il relativo embedding. Idempotente (si può richiamare a ogni modifica della fonte).
// Se il contenuto è vuoto lascia la fonte senza chunk (coerente).
export const reindexSource = async (input: {
  workspaceId: string;
  projectId: string;
  sourceId: string;
  content: string;
  embedder: Embedder;
  chunkOptions?: { maxChars?: number; overlap?: number };
}): Promise<{ chunks: number }> => {
  const chunks = chunkText(input.content, input.chunkOptions);
  // Pulizia sempre, anche a 0 chunk (una fonte svuotata non deve lasciare residui).
  await prisma.$executeRaw`DELETE FROM "ProjectSourceChunk" WHERE "sourceId" = ${input.sourceId}`;
  if (chunks.length === 0) {
    return { chunks: 0 };
  }

  const vectors = await input.embedder(chunks);
  if (vectors.length !== chunks.length) {
    throw new Error(`Embedder: attesi ${chunks.length} vettori, ricevuti ${vectors.length}`);
  }

  for (let i = 0; i < chunks.length; i += 1) {
    const literal = toVectorLiteral(vectors[i]);
    await prisma.$executeRaw`
      INSERT INTO "ProjectSourceChunk"
        ("id", "workspaceId", "projectId", "sourceId", "chunkIndex", "content", "embedding", "createdAt")
      VALUES
        (${randomUUID()}, ${input.workspaceId}, ${input.projectId}, ${input.sourceId}, ${i}, ${chunks[i]}, ${literal}::vector, now())`;
  }
  return { chunks: chunks.length };
};

export type SourceSearchHit = {
  sourceId: string;
  chunkIndex: number;
  content: string;
  score: number;
};

// Ricerca semantica sui chunk di un progetto: vettorizza la domanda e ritorna i
// blocchi più vicini per distanza coseno (`<=>`). `score` = 1 - distanza (1 = identico).
export const searchProjectSources = async (input: {
  workspaceId: string;
  projectId: string;
  query: string;
  topK?: number;
  embedder: Embedder;
}): Promise<SourceSearchHit[]> => {
  const query = (input.query ?? '').trim();
  if (!query) {
    return [];
  }
  const topK = Math.min(Math.max(input.topK ?? 5, 1), 50);
  const [vector] = await input.embedder([query]);
  if (!vector) {
    return [];
  }
  const literal = toVectorLiteral(vector);
  const rows = await prisma.$queryRaw<Array<{
    sourceId: string;
    chunkIndex: number;
    content: string;
    score: number;
  }>>`
    SELECT "sourceId", "chunkIndex", "content",
           1 - ("embedding" <=> ${literal}::vector) AS score
    FROM "ProjectSourceChunk"
    WHERE "workspaceId" = ${input.workspaceId} AND "projectId" = ${input.projectId}
    ORDER BY "embedding" <=> ${literal}::vector
    LIMIT ${topK}`;
  return rows.map((row) => ({
    sourceId: row.sourceId,
    chunkIndex: Number(row.chunkIndex),
    content: row.content,
    score: Number(row.score),
  }));
};
