import { resolveAgencyOpenAiApiKey } from '../agency-os/agency.service.js';
import {
  createLoggingOpenAiEmbedder,
  deleteSourceChunks,
  reindexSource,
  type Embedder,
} from './sources.rag.js';

// Orchestrazione dell'indicizzazione delle Fonti (V4 — RAG, passo 4a). Collega il
// ciclo di vita di una Fonte (creazione/refresh) alla vettorizzazione: quando una
// Fonte è pronta con del testo, ne (ri)genera chunk + embedding; se è in errore o
// vuota, rimuove eventuali chunk vecchi. È "best-effort": non solleva mai, così un
// problema di indicizzazione non fa fallire la creazione della Fonte.
//
// Vive qui (e non in sources.service) per due motivi: (1) tiene il service puro e
// unit-testabile; (2) importa il motore agency per la chiave OpenAI — l'aggancio è
// fatto a livello di rotta, non dentro il service.

// Risolutore dell'embedder di produzione: OpenAI con la chiave del workspace.
// Ritorna null se non c'è chiave configurata (indicizzazione rimandata, non è un errore).
const defaultEmbedderResolver = async (workspaceId: string): Promise<Embedder | null> => {
  const apiKey = await resolveAgencyOpenAiApiKey(workspaceId);
  if (!apiKey) {
    return null;
  }
  return createLoggingOpenAiEmbedder({ apiKey, workspaceId, functionName: 'sources.embed.index' });
};

type IndexableSource = {
  workspaceId: string;
  projectId: string;
  id: string;
  content: string | null;
  status: string;
};

type IndexOptions = {
  // Iniettabile nei test per non dipendere da OpenAI/DB delle impostazioni.
  embedderResolver?: (workspaceId: string) => Promise<Embedder | null>;
  logger?: { warn: (msg: string) => void };
};

export type IndexOutcome = {
  indexed: boolean;
  chunks?: number;
  reason?: 'not-ready' | 'no-openai-key' | 'error';
};

// Indicizza una Fonte in modo best-effort. Non solleva mai eccezioni.
export const indexSourceBestEffort = async (
  source: IndexableSource,
  options?: IndexOptions,
): Promise<IndexOutcome> => {
  // Fonte non pronta o senza testo: nessun chunk. Pulisce eventuali chunk precedenti
  // (es. un URL prima leggibile e ora in errore) per non lasciare residui obsoleti.
  if (source.status !== 'ready' || !source.content) {
    try {
      await deleteSourceChunks(source.id);
    } catch (error) {
      options?.logger?.warn?.(`Pulizia chunk fonte ${source.id} fallita: ${(error as Error).message}`);
    }
    return { indexed: false, reason: 'not-ready' };
  }

  const resolver = options?.embedderResolver ?? defaultEmbedderResolver;
  let embedder: Embedder | null = null;
  try {
    embedder = await resolver(source.workspaceId);
  } catch (error) {
    options?.logger?.warn?.(`Risoluzione embedder fallita per fonte ${source.id}: ${(error as Error).message}`);
    return { indexed: false, reason: 'error' };
  }
  if (!embedder) {
    return { indexed: false, reason: 'no-openai-key' };
  }

  try {
    const { chunks } = await reindexSource({
      workspaceId: source.workspaceId,
      projectId: source.projectId,
      sourceId: source.id,
      content: source.content,
      embedder,
    });
    return { indexed: true, chunks };
  } catch (error) {
    options?.logger?.warn?.(`Indicizzazione fonte ${source.id} fallita: ${(error as Error).message}`);
    return { indexed: false, reason: 'error' };
  }
};
