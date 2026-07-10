import type { FastifyRequest } from 'fastify';
import { audit } from '../../audit/audit.js';
import { badRequest, notFound } from '../../core/errors.js';
import {
  MAX_CONTENT_CHARS,
  SourceExtractionError,
  normalizeText,
  sourceExtractor,
} from './sources.extractor.js';
import { sourcesRepository } from './sources.repository.js';

// Tipi di fonte gestiti ORA. Il caricamento file (Word/PDF) è previsto ma non
// ancora implementato: la colonna/metadati file esistono già nel modello.
export const SOURCE_TYPES = ['url', 'text'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

const MAX_TITLE_LENGTH = 200;
const PREVIEW_LENGTH = 300;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type SourceRecord = NonNullable<Awaited<ReturnType<typeof sourcesRepository.findById>>>;

const normalizeType = (value: unknown): SourceType => {
  if (value === 'file') {
    throw badRequest('Il caricamento di file non è ancora supportato', { comingSoon: true });
  }
  if (typeof value !== 'string' || !SOURCE_TYPES.includes(value as SourceType)) {
    throw badRequest('Tipo di fonte non valido', { allowed: SOURCE_TYPES });
  }
  return value as SourceType;
};

const normalizeTitle = (value: unknown, fallback: string): string => {
  if (value === undefined || value === null || value === '') {
    return fallback.slice(0, MAX_TITLE_LENGTH);
  }
  if (typeof value !== 'string') {
    throw badRequest('title deve essere una stringa');
  }
  const title = value.trim();
  if (!title) {
    return fallback.slice(0, MAX_TITLE_LENGTH);
  }
  return title.slice(0, MAX_TITLE_LENGTH);
};

const normalizeUrl = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw badRequest('url obbligatorio per le fonti di tipo url');
  }
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw badRequest('url non valido');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw badRequest('url deve iniziare con http:// o https://');
  }
  return parsed.toString();
};

// Vista pubblica di una fonte. Con `full` include l'intero contenuto estratto;
// altrimenti solo un'anteprima (le liste possono contenere testi molto lunghi).
const serializeSource = (record: SourceRecord, options?: { full?: boolean }) => {
  const content = record.content ?? '';
  return {
    id: record.id,
    projectId: record.projectId,
    type: record.type,
    title: record.title,
    url: record.url,
    fileName: record.fileName,
    mimeType: record.mimeType,
    fileSize: record.fileSize,
    contentChars: record.contentChars,
    status: record.status,
    error: record.error,
    ...(options?.full
      ? { content }
      : { contentPreview: content.slice(0, PREVIEW_LENGTH) }),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
};

const requireProject = async (workspaceId: string, projectId: string) => {
  const normalized = typeof projectId === 'string' ? projectId.trim() : '';
  if (!normalized) {
    throw badRequest('projectId obbligatorio');
  }
  const belongs = await sourcesRepository.projectBelongsToWorkspace(workspaceId, normalized);
  if (!belongs) {
    throw notFound('Progetto non trovato');
  }
  return normalized;
};

// Estrae il contenuto in base al tipo. Ritorna esito con status: un errore di
// estrazione (rete/URL) NON blocca la creazione, viene salvato come stato error.
const extractContent = async (
  type: SourceType,
  input: { url?: string; content?: unknown },
): Promise<{ content: string; status: 'ready' | 'error'; error: string | null; title: string | null }> => {
  if (type === 'text') {
    const content = normalizeText(input.content);
    if (!content) {
      throw badRequest('content obbligatorio per le fonti di tipo testo');
    }
    return { content, status: 'ready', error: null, title: null };
  }

  // type === 'url'
  try {
    const result = await sourceExtractor.fromUrl(input.url as string);
    return { content: result.content, status: 'ready', error: null, title: result.title };
  } catch (error) {
    if (error instanceof SourceExtractionError) {
      return { content: '', status: 'error', error: error.message, title: null };
    }
    throw error;
  }
};

export const sourcesService = {
  async listSources(workspaceId: string, projectId: string) {
    const validProjectId = await requireProject(workspaceId, projectId);
    const records = await sourcesRepository.listByProject(workspaceId, validProjectId);
    return records.map((record) => serializeSource(record));
  },

  async getSource(workspaceId: string, id: string) {
    const record = await sourcesRepository.findById(workspaceId, id);
    if (!record) {
      throw notFound('Fonte non trovata');
    }
    return serializeSource(record, { full: true });
  },

  async createSource(input: {
    workspaceId: string;
    projectId: string;
    actorUserId: string;
    body: unknown;
    request: FastifyRequest;
  }) {
    const projectId = await requireProject(input.workspaceId, input.projectId);
    if (!isObject(input.body)) {
      throw badRequest('Body must be a JSON object');
    }

    const type = normalizeType(input.body.type);
    const url = type === 'url' ? normalizeUrl(input.body.url) : null;

    const extracted = await extractContent(type, {
      url: url ?? undefined,
      content: input.body.content,
    });

    // Titolo: quello fornito, altrimenti il titolo estratto (url) o un fallback.
    const fallbackTitle = type === 'url' ? extracted.title ?? url ?? 'Fonte' : 'Testo';
    const title = normalizeTitle(input.body.title, fallbackTitle);

    const created = await sourcesRepository.create({
      workspaceId: input.workspaceId,
      projectId,
      type,
      title,
      url,
      fileName: null,
      mimeType: null,
      fileSize: null,
      content: extracted.content || null,
      contentChars: extracted.content.length,
      status: extracted.status,
      error: extracted.error,
    });

    await audit.log({
      event: 'sources.create',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'ProjectSource',
      entityId: created.id,
      metadata: { projectId, type, status: created.status },
      request: input.request,
    });

    return serializeSource(created, { full: true });
  },

  // Ri-estrae il contenuto di una fonte URL (utile se prima era in errore o è
  // cambiata la pagina). Sulle fonti testo non ha effetto.
  async refreshSource(input: {
    workspaceId: string;
    id: string;
    actorUserId: string;
    request: FastifyRequest;
  }) {
    const record = await sourcesRepository.findById(input.workspaceId, input.id);
    if (!record) {
      throw notFound('Fonte non trovata');
    }
    if (record.type !== 'url' || !record.url) {
      throw badRequest('Solo le fonti di tipo url possono essere ri-scaricate');
    }

    const extracted = await extractContent('url', { url: record.url });
    const updated = await sourcesRepository.update(input.workspaceId, input.id, {
      content: extracted.content || null,
      contentChars: extracted.content.length,
      status: extracted.status,
      error: extracted.error,
    });
    if (!updated) {
      throw notFound('Fonte non trovata');
    }

    await audit.log({
      event: 'sources.refresh',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'ProjectSource',
      entityId: updated.id,
      metadata: { projectId: updated.projectId, status: updated.status },
      request: input.request,
    });

    return serializeSource(updated, { full: true });
  },

  async deleteSource(input: {
    workspaceId: string;
    id: string;
    actorUserId: string;
    request: FastifyRequest;
  }) {
    const record = await sourcesRepository.findById(input.workspaceId, input.id);
    if (!record) {
      throw notFound('Fonte non trovata');
    }
    await sourcesRepository.delete(input.workspaceId, input.id);

    await audit.log({
      event: 'sources.delete',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'ProjectSource',
      entityId: record.id,
      metadata: { projectId: record.projectId },
      request: input.request,
    });
  },

  // Esposto per riuso/estensioni future (es. limite condiviso col chunking).
  maxContentChars: MAX_CONTENT_CHARS,
};
