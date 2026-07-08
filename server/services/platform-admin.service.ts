import { badRequest, conflict, notFound } from '../core/errors.js';
import { prisma } from '../prisma.js';
import { ensureWorkspaceSystemRoles } from '../auth/workspace-bootstrap.js';
import { platformAdminRepository } from '../repositories/platform-admin.repository.js';
import { aiUsageRepository } from '../repositories/ai-usage.repository.js';

const AI_SETTING_KEYS = {
  enabled: 'agency_ai_enabled',
  model: 'agency_ai_model',
  maxTokens: 'agency_ai_max_output_tokens',
  apiKey: 'openai_api_key',
} as const;

const DEFAULT_USAGE_WINDOW_DAYS = 30;
const MAX_USAGE_WINDOW_DAYS = 365;
const RECENT_USAGE_LIMIT = 50;

const readJsonBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
  return fallback;
};

const readJsonString = (value: unknown, fallback: string | null): string | null => {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

const readJsonNumber = (value: unknown, fallback: number | null): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return fallback;
};

const round6 = (value: number | null | undefined): number => Number((value ?? 0).toFixed(6));

const MAX_NAME_LENGTH = 80;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_SUFFIX_ATTEMPTS = 50;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeName = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw badRequest('Workspace name is required');
  }
  const name = value.trim();
  if (name.length > MAX_NAME_LENGTH) {
    throw badRequest('Workspace name is too long', { maxLength: MAX_NAME_LENGTH });
  }
  return name;
};

// Trasforma un nome in uno slug valido (minuscole, trattini, senza accenti/simboli).
const slugifyName = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

const normalizeSlugInput = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw badRequest('Workspace slug is required');
  }
  const slug = value.trim().toLowerCase();
  if (!SLUG_PATTERN.test(slug)) {
    throw badRequest('Workspace slug non valido (usa lettere minuscole, numeri e trattini)');
  }
  return slug;
};

// Trova uno slug libero partendo da una base, aggiungendo un suffisso numerico se serve.
const resolveAvailableSlug = async (baseSlug: string): Promise<string> => {
  const base = baseSlug || 'workspace';
  for (let attempt = 1; attempt <= MAX_SLUG_SUFFIX_ATTEMPTS; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    const existing = await platformAdminRepository.findWorkspaceBySlug(candidate);
    if (!existing) {
      return candidate;
    }
  }
  throw conflict('Impossibile generare uno slug libero per questo nome, specificane uno manualmente');
};

export const platformAdminService = {
  listWorkspaces() {
    return platformAdminRepository.listWorkspaces();
  },

  async createWorkspace(body: unknown, actorUserId: string) {
    if (!isObject(body)) {
      throw badRequest('Body must be a JSON object');
    }

    const name = normalizeName(body.name);

    let slug: string;
    if (body.slug !== undefined && body.slug !== null && body.slug !== '') {
      slug = normalizeSlugInput(body.slug);
      const existing = await platformAdminRepository.findWorkspaceBySlug(slug);
      if (existing) {
        throw conflict('Workspace slug already in use', { slug });
      }
    } else {
      slug = await resolveAvailableSlug(slugifyName(name));
    }

    // Crea il workspace e i suoi ruoli/moduli di sistema in un'unica transazione,
    // cosi' nasce gia' usabile (ruoli standard e moduli abilitati).
    const workspaceId = await prisma.$transaction(async (tx) => {
      const created = await tx.workspace.create({
        data: { name, slug },
        select: { id: true },
      });

      await ensureWorkspaceSystemRoles({
        tx,
        workspaceId: created.id,
        actorUserId,
        sourceAction: 'admin.workspace.create',
      });

      return created.id;
    });

    return platformAdminRepository.findWorkspaceById(workspaceId);
  },

  async updateWorkspace(workspaceId: string, body: unknown) {
    const existing = await platformAdminRepository.findWorkspaceById(workspaceId);
    if (!existing) {
      throw notFound('Workspace not found');
    }

    if (!isObject(body)) {
      throw badRequest('Body must be a JSON object');
    }

    const data: { name?: string; slug?: string } = {};

    if (body.name !== undefined) {
      data.name = normalizeName(body.name);
    }

    if (body.slug !== undefined) {
      const slug = normalizeSlugInput(body.slug);
      if (slug !== existing.slug) {
        const clash = await platformAdminRepository.findWorkspaceBySlug(slug);
        if (clash && clash.id !== workspaceId) {
          throw conflict('Workspace slug already in use', { slug });
        }
      }
      data.slug = slug;
    }

    if (data.name === undefined && data.slug === undefined) {
      throw badRequest('Nothing to update');
    }

    return platformAdminRepository.updateWorkspace(workspaceId, data);
  },

  async setWorkspaceSuspended(workspaceId: string, suspended: boolean) {
    const existing = await platformAdminRepository.findWorkspaceById(workspaceId);
    if (!existing) {
      throw notFound('Workspace not found');
    }

    return platformAdminRepository.setWorkspaceStatus(
      workspaceId,
      suspended ? 'SUSPENDED' : 'ACTIVE',
      suspended ? new Date() : null,
    );
  },

  listPlatformAdmins() {
    return platformAdminRepository.listPlatformAdmins();
  },

  parseSearchQuery(rawQuery: unknown): string {
    if (rawQuery === undefined || rawQuery === null) {
      return '';
    }
    if (typeof rawQuery !== 'string') {
      throw badRequest('query must be a string');
    }
    return rawQuery.trim();
  },

  searchUsers(query: string) {
    return platformAdminRepository.searchUsers(query, 20);
  },

  parseUserId(body: unknown): string {
    if (!isObject(body) || typeof body.userId !== 'string' || !body.userId.trim()) {
      throw badRequest('userId is required');
    }
    return body.userId.trim();
  },

  async promotePlatformAdmin(userId: string) {
    const user = await platformAdminRepository.findUserById(userId);
    if (!user) {
      throw notFound('User not found');
    }
    if (user.isPlatformAdmin) {
      return user;
    }
    return platformAdminRepository.setUserPlatformAdmin(userId, true);
  },

  async demotePlatformAdmin(userId: string, actorUserId: string) {
    // Protezioni anti-lockout: non ci si puo' auto-rimuovere ne' rimuovere l'ultimo admin.
    if (userId === actorUserId) {
      throw badRequest('Non puoi rimuovere te stesso dai Super Admin di piattaforma');
    }

    const user = await platformAdminRepository.findUserById(userId);
    if (!user) {
      throw notFound('User not found');
    }
    if (!user.isPlatformAdmin) {
      return user;
    }

    const adminCount = await platformAdminRepository.countPlatformAdmins();
    if (adminCount <= 1) {
      throw badRequest('Deve restare almeno un Super Admin di piattaforma');
    }

    return platformAdminRepository.setUserPlatformAdmin(userId, false);
  },

  parseWindowDays(rawDays: unknown): number {
    if (rawDays === undefined || rawDays === null || rawDays === '') {
      return DEFAULT_USAGE_WINDOW_DAYS;
    }
    const parsed = Number(rawDays);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw badRequest('days deve essere un numero positivo');
    }
    return Math.min(Math.floor(parsed), MAX_USAGE_WINDOW_DAYS);
  },

  // Costi/consumi AI aggregati per workspace + totali + ultime chiamate.
  async getAiUsage(windowDays: number) {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const [grouped, totals, workspaces, recent] = await Promise.all([
      aiUsageRepository.aggregateByWorkspace(since),
      aiUsageRepository.totals(since),
      platformAdminRepository.listWorkspaces(),
      aiUsageRepository.recentLogs(RECENT_USAGE_LIMIT),
    ]);

    const infoById = new Map(workspaces.map((w) => [w.id, { name: w.name, slug: w.slug }]));

    const perWorkspace = grouped
      .map((row) => ({
        workspaceId: row.workspaceId,
        name: infoById.get(row.workspaceId)?.name ?? '(workspace rimosso)',
        slug: infoById.get(row.workspaceId)?.slug ?? '',
        calls: row._count._all,
        costUsd: round6(row._sum.costUsd),
        inputTokens: row._sum.inputTokens ?? 0,
        outputTokens: row._sum.outputTokens ?? 0,
        lastCallAt: row._max.createdAt,
      }))
      .sort((left, right) => right.costUsd - left.costUsd);

    return {
      windowDays,
      totals: {
        calls: totals._count._all,
        costUsd: round6(totals._sum.costUsd),
        inputTokens: totals._sum.inputTokens ?? 0,
        outputTokens: totals._sum.outputTokens ?? 0,
      },
      perWorkspace,
      recent: recent.map((log) => ({
        id: log.id,
        workspaceId: log.workspaceId,
        name: infoById.get(log.workspaceId)?.name ?? '',
        functionName: log.functionName,
        model: log.model,
        costUsd: log.costUsd,
        inputTokens: log.inputTokens,
        outputTokens: log.outputTokens,
        durationMs: log.durationMs,
        createdAt: log.createdAt,
      })),
    };
  },

  // Configurazione AI per workspace (senza esporre la chiave API in chiaro).
  async getAiConfig() {
    const [workspaces, settings] = await Promise.all([
      platformAdminRepository.listWorkspaces(),
      platformAdminRepository.listAiRuntimeSettings(Object.values(AI_SETTING_KEYS)),
    ]);

    const byWorkspace = new Map<string, Map<string, (typeof settings)[number]>>();
    for (const setting of settings) {
      let entry = byWorkspace.get(setting.workspaceId);
      if (!entry) {
        entry = new Map();
        byWorkspace.set(setting.workspaceId, entry);
      }
      entry.set(setting.key, setting);
    }

    return workspaces.map((workspace) => {
      const entry = byWorkspace.get(workspace.id);
      const apiKeyRow = entry?.get(AI_SETTING_KEYS.apiKey);
      return {
        workspaceId: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        aiEnabled: readJsonBoolean(entry?.get(AI_SETTING_KEYS.enabled)?.valueJson, false),
        model: readJsonString(entry?.get(AI_SETTING_KEYS.model)?.valueJson, null),
        maxOutputTokens: readJsonNumber(entry?.get(AI_SETTING_KEYS.maxTokens)?.valueJson, null),
        apiKeyConfigured: Boolean(apiKeyRow?.ciphertext),
      };
    });
  },
};
