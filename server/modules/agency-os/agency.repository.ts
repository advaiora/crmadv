import {
  AgencyPriority,
  Prisma,
  ProjectAlertSeverity,
  ProjectAlertStatus,
  ProjectOpportunityStatus,
} from '@prisma/client';
import { prisma } from '../../prisma.js';

const PROJECT_TABLE = 'Project';

// Perimetro di visibilita' utente->progetto (V2). Replica locale, per il modulo
// Agency, della logica canonica di projects.repository.buildVisibilityOr: un
// membro vede i progetti di cui e' owner o a cui e' assegnato (ProjectAccess),
// piu' quelli dei reparti che guida e i progetti "generali" senza reparto.
// `scope` null a monte = l'utente ha projects.view_all e vede tutto.
export type AgencyProjectVisibilityScope = {
  userId: string;
  ledDepartmentIds: string[];
  isLead: boolean;
};

const buildAgencyProjectVisibilityOr = (
  scope: AgencyProjectVisibilityScope,
): Prisma.ProjectWhereInput[] => {
  const conditions: Prisma.ProjectWhereInput[] = [
    { ownerUserId: scope.userId },
    { access: { some: { userId: scope.userId } } },
  ];
  if (scope.ledDepartmentIds.length > 0) {
    conditions.push({ departments: { some: { departmentId: { in: scope.ledDepartmentIds } } } });
  }
  if (scope.isLead) {
    conditions.push({ departments: { none: {} } });
  }
  return conditions;
};
const PROJECT_TYPE_TABLE = 'ProjectType';
const PROJECT_MEMORY_TABLE = 'ProjectMemory';
const PROJECT_ACTIVE_MODULE_TABLE = 'ProjectActiveModule';
const PROJECT_ALERT_TABLE = 'ProjectAlert';
const PROJECT_OPPORTUNITY_TABLE = 'ProjectOpportunity';
const PROJECT_TASK_TABLE = 'ProjectTask';
const PROJECT_CLIENT_TABLE = 'ProjectClient';
const AGENCY_RUNTIME_SETTING_TABLE = 'AgencyRuntimeSetting';
const AGENCY_REQUIRED_TABLES = [
  'ProjectType',
  'ProjectActiveModule',
  'ProjectMemory',
  'ProjectAlert',
  'ProjectOpportunity',
] as const;
const AGENCY_REQUIRED_PROJECT_COLUMNS = [
  'projectTypeId',
  'goal',
  'scopePurchased',
  'statusAgency',
  'priorityAgency',
  'ownerUserId',
  'startDate',
  'endDate',
] as const;
const PROJECT_MEMORY_WEB_COLUMNS = ['webJson'] as const;
const PROJECT_MEMORY_ADS_COLUMNS = ['adsJson'] as const;
const PROJECT_MEMORY_DIAGNOSIS_COLUMNS = ['diagnosisJson'] as const;
const PROJECT_MEMORY_REPORTS_COLUMNS = ['reportsJson'] as const;
const PROJECT_MEMORY_SOURCES_COLUMNS = ['sourcesJson'] as const;
const PROJECT_OPPORTUNITY_V2_COLUMNS = [
  'category',
  'type',
  'rationale',
  'priority',
  'score',
  'impactLevel',
  'sourceModule',
  'sourceSignalKey',
  'dedupKey',
  'suggestedService',
  'lastEvaluatedAt',
] as const;

const tableExists = async (tableName: string) => {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = ${tableName}
    ) AS "exists"
  `);

  return rows[0]?.exists === true;
};

const tableHasColumns = async (tableName: string, columns: readonly string[]) => {
  const rows = await prisma.$queryRaw<Array<{ column_name: string }>>(Prisma.sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = ${tableName}
  `);

  const availableColumns = new Set(rows.map((row) => row.column_name));
  return columns.every((column) => availableColumns.has(column));
};

const normalizeTitleKey = (value: string) => value.trim().toLowerCase();
const normalizeTaskKey = (title: string, teamRole: string) => `${normalizeTitleKey(title)}::${teamRole.trim().toLowerCase()}`;
const normalizeOpportunityKey = (title: string, dedupKey?: string | null) => {
  const normalizedDedupKey = typeof dedupKey === 'string' ? dedupKey.trim().toLowerCase() : '';
  return normalizedDedupKey || normalizeTitleKey(title);
};
const normalizeOpportunityKeys = (title: string, dedupKey?: string | null) => {
  const keys = new Set<string>();
  const primaryKey = normalizeOpportunityKey(title, dedupKey);
  const titleKey = normalizeTitleKey(title);

  if (primaryKey) {
    keys.add(primaryKey);
  }

  if (titleKey) {
    keys.add(titleKey);
  }

  return keys;
};

const mergeBriefJsonWithSources = (briefJson: unknown, sourcesJson: Prisma.InputJsonValue) => {
  const base = typeof briefJson === 'object' && briefJson !== null && !Array.isArray(briefJson)
    ? { ...(briefJson as Record<string, unknown>) }
    : {};

  return {
    ...base,
    sources: sourcesJson,
  } as Prisma.InputJsonValue;
};

const agencyProjectSnapshotSelect = {
  id: true,
  workspaceId: true,
  clientId: true,
  name: true,
  goal: true,
  scopePurchased: true,
  statusAgency: true,
  priorityAgency: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
  client: {
    select: {
      id: true,
      name: true,
    },
  },
  projectType: {
    select: {
      key: true,
      label: true,
      description: true,
    },
  },
  activeModules: {
    orderBy: { moduleKey: 'asc' as const },
    select: {
      id: true,
      moduleKey: true,
      moduleLabel: true,
      included: true,
      suggested: true,
      active: true,
      source: true,
      updatedAt: true,
    },
  },
  projectMemory: {
    select: {
      id: true,
      briefJson: true,
      webJson: true,
      adsJson: true,
      diagnosisJson: true,
      reportsJson: true,
      contextSummary: true,
      memorySummary: true,
      updatedAt: true,
    },
  },
  projectAlerts: {
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true,
      title: true,
      description: true,
      reason: true,
      severity: true,
      priority: true,
      status: true,
      source: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  projectOpportunities: {
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true,
      title: true,
      stage: true,
      estimatedValue: true,
      status: true,
      source: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} as const;

const agencyProjectListSelect = {
  id: true,
  workspaceId: true,
  clientId: true,
  name: true,
  goal: true,
  scopePurchased: true,
  statusAgency: true,
  priorityAgency: true,
  createdAt: true,
  updatedAt: true,
  client: {
    select: {
      id: true,
      name: true,
    },
  },
  projectType: {
    select: {
      key: true,
      label: true,
      description: true,
    },
  },
  activeModules: {
    select: {
      id: true,
      moduleKey: true,
      moduleLabel: true,
      included: true,
      suggested: true,
      active: true,
      source: true,
      updatedAt: true,
    },
    orderBy: { moduleKey: 'asc' as const },
  },
  projectMemory: {
    select: {
      id: true,
      briefJson: true,
      webJson: true,
      adsJson: true,
      diagnosisJson: true,
      reportsJson: true,
      contextSummary: true,
      updatedAt: true,
    },
  },
} as const;

export const agencyRepository = {
  async isAgencySchemaReady() {
    const [requiredTablesReady, requiredProjectColumnsReady] = await Promise.all([
      Promise.all(AGENCY_REQUIRED_TABLES.map((tableName) => tableExists(tableName))).then((checks) => checks.every(Boolean)),
      tableHasColumns(PROJECT_TABLE, AGENCY_REQUIRED_PROJECT_COLUMNS),
    ]);

    return requiredTablesReady && requiredProjectColumnsReady;
  },

  async isProjectTypeSchemaReady() {
    return tableExists(PROJECT_TYPE_TABLE);
  },

  async isProjectClientSchemaReady() {
    return tableExists(PROJECT_CLIENT_TABLE);
  },

  async isAgencyRuntimeSettingsSchemaReady() {
    return tableExists(AGENCY_RUNTIME_SETTING_TABLE);
  },

  async listAgencyRuntimeSettings(workspaceId: string) {
    const schemaReady = await this.isAgencyRuntimeSettingsSchemaReady();
    if (!schemaReady) {
      return null;
    }

    return prisma.$queryRaw<Array<{
      id: string;
      workspaceId: string;
      key: string;
      valueJson: Prisma.JsonValue | null;
      ciphertext: string | null;
      iv: string | null;
      authTag: string | null;
      keyVersion: number | null;
      isSecret: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>>(Prisma.sql`
      SELECT
        "id",
        "workspaceId",
        "key",
        "valueJson",
        "ciphertext",
        "iv",
        "authTag",
        "keyVersion",
        "isSecret",
        "createdAt",
        "updatedAt"
      FROM "public"."AgencyRuntimeSetting"
      WHERE "workspaceId" = ${workspaceId}
    `);
  },

  async upsertAgencyRuntimeSetting(input: {
    workspaceId: string;
    key: string;
    valueJson?: Prisma.InputJsonValue | null;
    encrypted?: {
      ciphertext: string;
      iv: string;
      authTag: string;
      keyVersion: number;
    } | null;
    isSecret: boolean;
  }) {
    const schemaReady = await this.isAgencyRuntimeSettingsSchemaReady();
    if (!schemaReady) {
      return null;
    }

    const id = `agency_setting_${input.workspaceId}_${input.key}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 191);
    const valueJson = input.valueJson === undefined || input.valueJson === null
      ? null
      : JSON.stringify(input.valueJson);
    const encrypted = input.encrypted ?? null;

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "public"."AgencyRuntimeSetting" (
        "id",
        "workspaceId",
        "key",
        "valueJson",
        "ciphertext",
        "iv",
        "authTag",
        "keyVersion",
        "isSecret",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${id},
        ${input.workspaceId},
        ${input.key},
        ${valueJson}::jsonb,
        ${encrypted?.ciphertext ?? null},
        ${encrypted?.iv ?? null},
        ${encrypted?.authTag ?? null},
        ${encrypted?.keyVersion ?? null},
        ${input.isSecret},
        NOW(),
        NOW()
      )
      ON CONFLICT ("workspaceId", "key")
      DO UPDATE SET
        "valueJson" = EXCLUDED."valueJson",
        "ciphertext" = EXCLUDED."ciphertext",
        "iv" = EXCLUDED."iv",
        "authTag" = EXCLUDED."authTag",
        "keyVersion" = EXCLUDED."keyVersion",
        "isSecret" = EXCLUDED."isSecret",
        "updatedAt" = NOW()
    `);

    return this.listAgencyRuntimeSettings(input.workspaceId);
  },

  async deleteAgencyRuntimeSetting(input: {
    workspaceId: string;
    key: string;
  }) {
    const schemaReady = await this.isAgencyRuntimeSettingsSchemaReady();
    if (!schemaReady) {
      return null;
    }

    await prisma.$executeRaw(Prisma.sql`
      DELETE FROM "public"."AgencyRuntimeSetting"
      WHERE "workspaceId" = ${input.workspaceId}
      AND "key" = ${input.key}
    `);

    return this.listAgencyRuntimeSettings(input.workspaceId);
  },

  async findProjectSnapshot(workspaceId: string, projectId: string) {
    const schemaReady = await this.isAgencySchemaReady();
    if (!schemaReady) {
      return null;
    }

    return prisma.project.findFirst({
      where: {
        workspaceId,
        id: projectId,
      },
      select: agencyProjectSnapshotSelect,
    });
  },

  async isProjectMemorySchemaReady() {
    return tableExists(PROJECT_MEMORY_TABLE);
  },

  async isProjectMemoryWebSchemaReady() {
    const [tableReady, columnsReady] = await Promise.all([
      this.isProjectMemorySchemaReady(),
      tableHasColumns(PROJECT_MEMORY_TABLE, PROJECT_MEMORY_WEB_COLUMNS),
    ]);

    return tableReady && columnsReady;
  },

  async isProjectMemoryAdsSchemaReady() {
    const [tableReady, columnsReady] = await Promise.all([
      this.isProjectMemorySchemaReady(),
      tableHasColumns(PROJECT_MEMORY_TABLE, PROJECT_MEMORY_ADS_COLUMNS),
    ]);

    return tableReady && columnsReady;
  },

  async isProjectMemoryDiagnosisSchemaReady() {
    const [tableReady, columnsReady] = await Promise.all([
      this.isProjectMemorySchemaReady(),
      tableHasColumns(PROJECT_MEMORY_TABLE, PROJECT_MEMORY_DIAGNOSIS_COLUMNS),
    ]);

    return tableReady && columnsReady;
  },

  async isProjectMemoryReportsSchemaReady() {
    const [tableReady, columnsReady] = await Promise.all([
      this.isProjectMemorySchemaReady(),
      tableHasColumns(PROJECT_MEMORY_TABLE, PROJECT_MEMORY_REPORTS_COLUMNS),
    ]);

    return tableReady && columnsReady;
  },

  async isProjectMemorySourcesSchemaReady() {
    const [tableReady, columnsReady] = await Promise.all([
      this.isProjectMemorySchemaReady(),
      tableHasColumns(PROJECT_MEMORY_TABLE, PROJECT_MEMORY_SOURCES_COLUMNS),
    ]);

    return tableReady && columnsReady;
  },

  async findProjectLite(workspaceId: string, projectId: string) {
    return prisma.project.findFirst({
      where: {
        workspaceId,
        id: projectId,
      },
      select: {
        id: true,
        workspaceId: true,
        name: true,
      },
    });
  },

  async findClientLite(workspaceId: string, clientId: string) {
    return prisma.client.findFirst({
      where: {
        workspaceId,
        id: clientId,
      },
      select: {
        id: true,
        name: true,
      },
    });
  },

  async listWorkspaceProjectsLite(workspaceId: string) {
    return prisma.project.findMany({
      where: {
        workspaceId,
      },
      orderBy: [
        { updatedAt: 'desc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        workspaceId: true,
        name: true,
        statusAgency: true,
        priorityAgency: true,
        updatedAt: true,
        projectType: {
          select: {
            key: true,
            label: true,
          },
        },
      },
    });
  },

  async listWorkspaceAgencyProjects(workspaceId: string) {
    return prisma.project.findMany({
      where: {
        workspaceId,
        OR: [
          {
            projectTypeId: {
              not: null,
            },
          },
          {
            projectMemory: {
              isNot: null,
            },
          },
          {
            activeModules: {
              some: {},
            },
          },
        ],
      },
      orderBy: [
        { updatedAt: 'desc' },
        { name: 'asc' },
      ],
      select: agencyProjectListSelect,
    });
  },

  // Progetti per il selettore della Chat globale (Fase 2). Applica la visibilita'
  // V2 (scope null = vede tutto) e restituisce, per ciascun progetto, se e'
  // "assegnato a me" (owner o ProjectAccess) e se ha Fonti indicizzate (chunk RAG),
  // cosi' la UI puo' mettere in cima gli assegnati e segnalare quelli interrogabili.
  async listAgencyChatProjects(
    workspaceId: string,
    scope: AgencyProjectVisibilityScope | null,
    userId: string,
  ) {
    const projects = await prisma.project.findMany({
      where: {
        workspaceId,
        ...(scope ? { OR: buildAgencyProjectVisibilityOr(scope) } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        clientId: true,
        ownerUserId: true,
        updatedAt: true,
        client: { select: { id: true, name: true } },
        access: { where: { userId }, select: { id: true } },
      },
    });

    // Quali progetti hanno almeno una Fonte indicizzata (un chunk RAG presente):
    // una sola query aggregata invece di N controlli per riga.
    const projectIds = projects.map((project) => project.id);
    const indexedRows = projectIds.length
      ? await prisma.projectSourceChunk.findMany({
          where: { workspaceId, projectId: { in: projectIds } },
          distinct: ['projectId'],
          select: { projectId: true },
        })
      : [];
    const indexedProjectIds = new Set(indexedRows.map((row) => row.projectId));

    return projects.map((project) => ({
      id: project.id,
      name: project.name,
      clientId: project.clientId,
      clientName: project.client?.name ?? null,
      updatedAt: project.updatedAt,
      assignedToMe: project.ownerUserId === userId || project.access.length > 0,
      hasIndexedSources: indexedProjectIds.has(project.id),
    }));
  },

  async findAgencyProject(workspaceId: string, projectId: string) {
    return prisma.project.findFirst({
      where: {
        workspaceId,
        id: projectId,
      },
      select: agencyProjectListSelect,
    });
  },

  // Cliente del workspace (nome per il prompt della Chat, ambito Cliente — Fase 2).
  findAgencyClient(workspaceId: string, clientId: string) {
    return prisma.client.findFirst({
      where: { workspaceId, id: clientId },
      select: { id: true, name: true },
    });
  },

  // Titoli delle fonti citate (RAG), per etichettare le citazioni quando gli estratti
  // arrivano da piu' progetti (ambito Cliente): risolve i titoli in una sola query.
  listSourceTitlesByIds(workspaceId: string, sourceIds: string[]) {
    if (sourceIds.length === 0) {
      return Promise.resolve([] as Array<{ id: string; title: string }>);
    }
    return prisma.projectSource.findMany({
      where: { workspaceId, id: { in: sourceIds } },
      select: { id: true, title: true },
    });
  },

  async findProjectTypeByKey(workspaceId: string, key: string) {
    const schemaReady = await this.isProjectTypeSchemaReady();
    if (!schemaReady) {
      return null;
    }

    return prisma.projectType.findFirst({
      where: {
        workspaceId,
        key,
      },
      select: {
        id: true,
        key: true,
        label: true,
        description: true,
      },
    });
  },

  async upsertWorkspaceProjectType(input: {
    workspaceId: string;
    key: string;
    label: string;
    description?: string | null;
  }) {
    const schemaReady = await this.isProjectTypeSchemaReady();
    if (!schemaReady) {
      return null;
    }

    return prisma.projectType.upsert({
      where: {
        workspaceId_key: {
          workspaceId: input.workspaceId,
          key: input.key,
        },
      },
      update: {
        label: input.label,
        description: input.description ?? null,
      },
      create: {
        workspaceId: input.workspaceId,
        key: input.key,
        label: input.label,
        description: input.description ?? null,
      },
      select: {
        id: true,
        key: true,
        label: true,
        description: true,
      },
    });
  },

  async createAgencyProject(input: {
    workspaceId: string;
    name: string;
    clientId?: string | null;
    projectTypeId?: string | null;
    goal?: string | null;
    scopePurchased?: Prisma.InputJsonValue | null;
    statusAgency?: Prisma.AgencyProjectStatus | null;
    priorityAgency?: AgencyPriority | null;
  }) {
    return prisma.project.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        clientId: input.clientId ?? null,
        projectTypeId: input.projectTypeId ?? null,
        goal: input.goal ?? null,
        scopePurchased: input.scopePurchased ?? Prisma.JsonNull,
        statusAgency: input.statusAgency ?? undefined,
        priorityAgency: input.priorityAgency ?? undefined,
      },
      select: agencyProjectListSelect,
    });
  },

  async linkProjectClient(input: {
    projectId: string;
    clientId: string;
  }) {
    const schemaReady = await this.isProjectClientSchemaReady();
    if (!schemaReady) {
      return null;
    }

    return prisma.projectClient.upsert({
      where: {
        projectId_clientId: {
          projectId: input.projectId,
          clientId: input.clientId,
        },
      },
      update: {},
      create: {
        projectId: input.projectId,
        clientId: input.clientId,
      },
      select: {
        id: true,
        projectId: true,
        clientId: true,
      },
    });
  },

  async findProjectMemory(workspaceId: string, projectId: string) {
    const schemaReady = await this.isProjectMemorySchemaReady();
    if (!schemaReady) {
      return null;
    }
    const sourcesSchemaReady = await this.isProjectMemorySourcesSchemaReady();

    return prisma.projectMemory.findFirst({
      where: {
        workspaceId,
        projectId,
      },
      select: {
        id: true,
        projectId: true,
        workspaceId: true,
        briefJson: true,
        ...(sourcesSchemaReady ? { sourcesJson: true } : {}),
        contextSummary: true,
        memorySummary: true,
        updatedAt: true,
      },
    });
  },

  async findProjectMemoryWeb(workspaceId: string, projectId: string) {
    const schemaReady = await this.isProjectMemoryWebSchemaReady();
    if (!schemaReady) {
      return null;
    }

    return prisma.projectMemory.findFirst({
      where: {
        workspaceId,
        projectId,
      },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        webJson: true,
        updatedAt: true,
      },
    });
  },

  async findProjectMemoryAds(workspaceId: string, projectId: string) {
    const schemaReady = await this.isProjectMemoryAdsSchemaReady();
    if (!schemaReady) {
      return null;
    }

    return prisma.projectMemory.findFirst({
      where: {
        workspaceId,
        projectId,
      },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        adsJson: true,
        updatedAt: true,
        },
      });
    },

  async findProjectMemoryReports(workspaceId: string, projectId: string) {
    const schemaReady = await this.isProjectMemoryReportsSchemaReady();
    if (!schemaReady) {
      return null;
    }

    return prisma.projectMemory.findFirst({
      where: {
        workspaceId,
        projectId,
      },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        reportsJson: true,
        updatedAt: true,
      },
    });
  },

  async findProjectMemoryDiagnosis(workspaceId: string, projectId: string) {
    const schemaReady = await this.isProjectMemoryDiagnosisSchemaReady();
    if (!schemaReady) {
      return null;
    }

    return prisma.projectMemory.findFirst({
      where: {
        workspaceId,
        projectId,
      },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        diagnosisJson: true,
        updatedAt: true,
      },
    });
  },

  async upsertProjectMemory(input: {
    workspaceId: string;
    projectId: string;
    briefJson: Prisma.InputJsonValue;
    contextSummary: string;
    sourcesJson?: Prisma.InputJsonValue;
  }) {
    const schemaReady = await this.isProjectMemorySchemaReady();
    if (!schemaReady) {
      return null;
    }
    const sourcesSchemaReady = input.sourcesJson !== undefined
      ? await this.isProjectMemorySourcesSchemaReady()
      : false;
    const briefJsonForWrite = input.sourcesJson !== undefined && !sourcesSchemaReady
      ? mergeBriefJsonWithSources(input.briefJson, input.sourcesJson)
      : input.briefJson;

    return prisma.projectMemory.upsert({
      where: {
        projectId: input.projectId,
      },
      update: {
        briefJson: briefJsonForWrite,
        ...(sourcesSchemaReady ? { sourcesJson: input.sourcesJson } : {}),
        contextSummary: input.contextSummary,
      },
      create: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        briefJson: briefJsonForWrite,
        ...(sourcesSchemaReady ? { sourcesJson: input.sourcesJson } : {}),
        contextSummary: input.contextSummary,
      },
      select: {
        id: true,
        projectId: true,
        workspaceId: true,
        briefJson: true,
        contextSummary: true,
        memorySummary: true,
        updatedAt: true,
      },
    });
  },

  // Fonti normalizzate del Modulo Fonti (V4) pronte per l'indicizzazione AI.
  // Guardia try/catch: su un DB dove la migrazione ProjectSource non è ancora
  // applicata, l'augmentazione viene semplicemente saltata (nessuna fonte).
  async listIndexedProjectSources(workspaceId: string, projectId: string) {
    try {
      return await prisma.projectSource.findMany({
        where: { workspaceId, projectId, status: 'ready' },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          type: true,
          title: true,
          url: true,
          content: true,
          contentChars: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch {
      return [];
    }
  },

  async findProjectMemorySources(workspaceId: string, projectId: string) {
    const memorySchemaReady = await this.isProjectMemorySchemaReady();
    if (!memorySchemaReady) {
      return null;
    }
    const sourcesSchemaReady = await this.isProjectMemorySourcesSchemaReady();

    if (!sourcesSchemaReady) {
      return prisma.projectMemory.findFirst({
        where: {
          workspaceId,
          projectId,
        },
        select: {
          id: true,
          workspaceId: true,
          projectId: true,
          briefJson: true,
          updatedAt: true,
        },
      });
    }

    return prisma.projectMemory.findFirst({
      where: {
        workspaceId,
        projectId,
      },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        briefJson: true,
        sourcesJson: true,
        updatedAt: true,
      },
    });
  },

  async upsertProjectMemorySources(input: {
    workspaceId: string;
    projectId: string;
    sourcesJson: Prisma.InputJsonValue;
  }) {
    const memorySchemaReady = await this.isProjectMemorySchemaReady();
    if (!memorySchemaReady) {
      return null;
    }
    const sourcesSchemaReady = await this.isProjectMemorySourcesSchemaReady();

    if (!sourcesSchemaReady) {
      const existing = await prisma.projectMemory.findFirst({
        where: {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
        },
        select: {
          briefJson: true,
        },
      });
      const briefJson = mergeBriefJsonWithSources(existing?.briefJson, input.sourcesJson);

      const record = await prisma.projectMemory.upsert({
        where: {
          projectId: input.projectId,
        },
        update: {
          briefJson,
        },
        create: {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          briefJson,
        },
        select: {
          id: true,
          workspaceId: true,
          projectId: true,
          briefJson: true,
          updatedAt: true,
        },
      });

      return {
        ...record,
        sourcesJson: input.sourcesJson,
        persistenceMode: 'briefJson.sources',
      };
    }

    return prisma.projectMemory.upsert({
      where: {
        projectId: input.projectId,
      },
      update: {
        sourcesJson: input.sourcesJson,
      },
      create: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        sourcesJson: input.sourcesJson,
      },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        sourcesJson: true,
        updatedAt: true,
      },
    });
  },

  async upsertProjectMemoryWeb(input: {
    workspaceId: string;
    projectId: string;
    webJson: Prisma.InputJsonValue;
  }) {
    const schemaReady = await this.isProjectMemoryWebSchemaReady();
    if (!schemaReady) {
      return null;
    }

    return prisma.projectMemory.upsert({
      where: {
        projectId: input.projectId,
      },
      update: {
        webJson: input.webJson,
      },
      create: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        webJson: input.webJson,
      },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        webJson: true,
        updatedAt: true,
      },
    });
  },

  async upsertProjectMemoryAds(input: {
    workspaceId: string;
    projectId: string;
    adsJson: Prisma.InputJsonValue;
  }) {
    const schemaReady = await this.isProjectMemoryAdsSchemaReady();
    if (!schemaReady) {
      return null;
    }

    return prisma.projectMemory.upsert({
      where: {
        projectId: input.projectId,
      },
      update: {
        adsJson: input.adsJson,
      },
      create: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        adsJson: input.adsJson,
      },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        adsJson: true,
        updatedAt: true,
        },
      });
    },

  async upsertProjectMemoryReports(input: {
    workspaceId: string;
    projectId: string;
    reportsJson: Prisma.InputJsonValue;
  }) {
    const schemaReady = await this.isProjectMemoryReportsSchemaReady();
    if (!schemaReady) {
      return null;
    }

    return prisma.projectMemory.upsert({
      where: {
        projectId: input.projectId,
      },
      update: {
        reportsJson: input.reportsJson,
      },
      create: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        reportsJson: input.reportsJson,
      },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        reportsJson: true,
        updatedAt: true,
      },
    });
  },

  async upsertProjectMemoryDiagnosis(input: {
    workspaceId: string;
    projectId: string;
    diagnosisJson: Prisma.InputJsonValue;
  }) {
    const schemaReady = await this.isProjectMemoryDiagnosisSchemaReady();
    if (!schemaReady) {
      return null;
    }

    return prisma.projectMemory.upsert({
      where: {
        projectId: input.projectId,
      },
      update: {
        diagnosisJson: input.diagnosisJson,
      },
      create: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        diagnosisJson: input.diagnosisJson,
      },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        diagnosisJson: true,
        updatedAt: true,
      },
    });
  },

  async isProjectActiveModulesSchemaReady() {
    return tableExists(PROJECT_ACTIVE_MODULE_TABLE);
  },

  async listProjectActiveModules(workspaceId: string, projectId: string) {
    const schemaReady = await this.isProjectActiveModulesSchemaReady();
    if (!schemaReady) {
      return null;
    }

    return prisma.projectActiveModule.findMany({
      where: {
        workspaceId,
        projectId,
      },
      orderBy: [
        { moduleKey: 'asc' },
      ],
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        moduleKey: true,
        moduleLabel: true,
        included: true,
        suggested: true,
        active: true,
        source: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async upsertProjectActiveModules(input: {
    workspaceId: string;
    projectId: string;
    source: string;
    items: Array<{
      moduleKey: string;
      moduleLabel?: string;
      included: boolean;
      suggested: boolean;
      active: boolean;
    }>;
  }) {
    const schemaReady = await this.isProjectActiveModulesSchemaReady();
    if (!schemaReady) {
      return null;
    }

    const moduleKeys = input.items.map((entry) => entry.moduleKey);
    await prisma.$transaction(async (tx) => {
      await tx.projectActiveModule.deleteMany({
        where: {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          source: input.source,
          ...(moduleKeys.length > 0
            ? {
                moduleKey: {
                  notIn: moduleKeys,
                },
              }
            : {}),
        },
      });

      for (const entry of input.items) {
        await tx.projectActiveModule.upsert({
          where: {
            projectId_moduleKey: {
              projectId: input.projectId,
              moduleKey: entry.moduleKey,
            },
          },
          update: {
            moduleLabel: entry.moduleLabel,
            included: entry.included,
            suggested: entry.suggested,
            active: entry.active,
            source: input.source,
          },
          create: {
            workspaceId: input.workspaceId,
            projectId: input.projectId,
            moduleKey: entry.moduleKey,
            moduleLabel: entry.moduleLabel,
            included: entry.included,
            suggested: entry.suggested,
            active: entry.active,
            source: input.source,
          },
        });
      }
    });

    return this.listProjectActiveModules(input.workspaceId, input.projectId);
  },

  async isProjectAlertsSchemaReady() {
    return tableExists(PROJECT_ALERT_TABLE);
  },

  async isProjectOpportunitiesSchemaReady() {
    return tableExists(PROJECT_OPPORTUNITY_TABLE);
  },

  async isProjectOpportunitiesV2SchemaReady() {
    const [schemaReady, columnsReady] = await Promise.all([
      this.isProjectOpportunitiesSchemaReady(),
      tableHasColumns(PROJECT_OPPORTUNITY_TABLE, PROJECT_OPPORTUNITY_V2_COLUMNS),
    ]);

    return schemaReady && columnsReady;
  },

  async listProjectAlerts(workspaceId: string, projectId: string) {
    const schemaReady = await this.isProjectAlertsSchemaReady();
    if (!schemaReady) {
      return null;
    }

    return prisma.projectAlert.findMany({
      where: {
        workspaceId,
        projectId,
      },
      orderBy: [
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        projectId: true,
        title: true,
        severity: true,
        status: true,
        priority: true,
        reason: true,
        source: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async listWorkspaceAlerts(workspaceId: string) {
    const schemaReady = await this.isProjectAlertsSchemaReady();
    if (!schemaReady) {
      return null;
    }

    return prisma.projectAlert.findMany({
      where: {
        workspaceId,
      },
      orderBy: [
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        projectId: true,
        title: true,
        severity: true,
        status: true,
        priority: true,
        reason: true,
        source: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async replaceProjectAlertsBySource(input: {
    workspaceId: string;
    projectId: string;
    source: string;
    items: Array<{
      title: string;
      severity: ProjectAlertSeverity;
      status: ProjectAlertStatus;
      priority: AgencyPriority;
      reason?: string;
    }>;
  }) {
    const schemaReady = await this.isProjectAlertsSchemaReady();
    if (!schemaReady) {
      return null;
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.projectAlert.findMany({
        where: {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          source: input.source,
        },
        select: {
          id: true,
          title: true,
        },
      });

      const existingByKey = new Map(existing.map((entry) => [normalizeTitleKey(entry.title), entry]));
      const incomingKeys = new Set<string>();

      for (const item of input.items) {
        const normalizedTitle = item.title.trim();
        const itemKey = normalizeTitleKey(normalizedTitle);
        if (!itemKey || incomingKeys.has(itemKey)) {
          continue;
        }

        incomingKeys.add(itemKey);
        const existingEntry = existingByKey.get(itemKey);

        if (existingEntry) {
          await tx.projectAlert.update({
            where: {
              id: existingEntry.id,
            },
            data: {
              title: normalizedTitle,
              severity: item.severity,
              status: item.status,
              priority: item.priority,
              reason: item.reason,
              source: input.source,
            },
          });
          continue;
        }

        await tx.projectAlert.create({
          data: {
            workspaceId: input.workspaceId,
            projectId: input.projectId,
            title: normalizedTitle,
            severity: item.severity,
            status: item.status,
            priority: item.priority,
            reason: item.reason,
            source: input.source,
          },
        });
      }

      const staleIds = existing
        .filter((entry) => !incomingKeys.has(normalizeTitleKey(entry.title)))
        .map((entry) => entry.id);

      if (staleIds.length > 0) {
        await tx.projectAlert.deleteMany({
          where: {
            id: {
              in: staleIds,
            },
          },
        });
      }
    });

    return this.listProjectAlerts(input.workspaceId, input.projectId);
  },

  async listProjectOpportunities(workspaceId: string, projectId: string) {
    const schemaReady = await this.isProjectOpportunitiesSchemaReady();
    if (!schemaReady) {
      return null;
    }

    const opportunityV2Ready = await this.isProjectOpportunitiesV2SchemaReady();

    return prisma.projectOpportunity.findMany({
      where: {
        workspaceId,
        projectId,
      },
      orderBy: [
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        projectId: true,
        title: true,
        stage: true,
        estimatedValue: true,
        status: true,
        ...(opportunityV2Ready
          ? {
              category: true,
              type: true,
              rationale: true,
              priority: true,
              score: true,
              impactLevel: true,
              sourceModule: true,
              sourceSignalKey: true,
              dedupKey: true,
              suggestedService: true,
              lastEvaluatedAt: true,
            }
          : {}),
        source: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async listWorkspaceOpportunities(workspaceId: string) {
    const schemaReady = await this.isProjectOpportunitiesSchemaReady();
    if (!schemaReady) {
      return null;
    }

    const opportunityV2Ready = await this.isProjectOpportunitiesV2SchemaReady();

    return prisma.projectOpportunity.findMany({
      where: {
        workspaceId,
      },
      orderBy: [
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        projectId: true,
        title: true,
        stage: true,
        estimatedValue: true,
        status: true,
        ...(opportunityV2Ready
          ? {
              category: true,
              type: true,
              rationale: true,
              priority: true,
              score: true,
              impactLevel: true,
              sourceModule: true,
              sourceSignalKey: true,
              dedupKey: true,
              suggestedService: true,
              lastEvaluatedAt: true,
            }
          : {}),
        source: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async replaceProjectOpportunitiesBySource(input: {
    workspaceId: string;
    projectId: string;
    source: string;
    items: Array<{
      title: string;
      stage: string;
      estimatedValue: number;
      status: ProjectOpportunityStatus;
      category?: string | null;
      type?: string | null;
      rationale?: string | null;
      priority?: AgencyPriority | null;
      score?: number | null;
      impactLevel?: AgencyPriority | null;
      sourceModule?: string | null;
      sourceSignalKey?: string | null;
      dedupKey?: string | null;
      suggestedService?: string | null;
      lastEvaluatedAt?: Date | null;
    }>;
  }) {
    const schemaReady = await this.isProjectOpportunitiesSchemaReady();
    if (!schemaReady) {
      return null;
    }

    const opportunityV2Ready = await this.isProjectOpportunitiesV2SchemaReady();

    await prisma.$transaction(async (tx) => {
      const existing = await tx.projectOpportunity.findMany({
        where: {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          source: input.source,
        },
        select: {
          id: true,
          title: true,
          ...(opportunityV2Ready ? { dedupKey: true } : {}),
        },
      });

      const existingByKey = new Map<string, (typeof existing)[number]>();
      existing.forEach((entry) => {
        normalizeOpportunityKeys(entry.title, 'dedupKey' in entry ? entry.dedupKey : null).forEach((key) => {
          existingByKey.set(key, entry);
        });
      });
      const incomingPrimaryKeys = new Set<string>();
      const incomingAllKeys = new Set<string>();

      for (const item of input.items) {
        const normalizedTitle = item.title.trim();
        const itemKey = normalizeOpportunityKey(normalizedTitle, opportunityV2Ready ? item.dedupKey : null);
        if (!itemKey || incomingPrimaryKeys.has(itemKey)) {
          continue;
        }

        incomingPrimaryKeys.add(itemKey);
        normalizeOpportunityKeys(normalizedTitle, opportunityV2Ready ? item.dedupKey : null).forEach((key) => {
          incomingAllKeys.add(key);
        });
        const existingEntry = existingByKey.get(itemKey)
          ?? existingByKey.get(normalizeTitleKey(normalizedTitle));

        if (existingEntry) {
          await tx.projectOpportunity.update({
            where: {
              id: existingEntry.id,
            },
            data: {
              title: normalizedTitle,
              stage: item.stage,
              estimatedValue: new Prisma.Decimal(item.estimatedValue),
              status: item.status,
              ...(opportunityV2Ready
                ? {
                    category: item.category ?? null,
                    type: item.type ?? null,
                    rationale: item.rationale ?? null,
                    priority: item.priority ?? null,
                    score: typeof item.score === 'number' ? item.score : null,
                    impactLevel: item.impactLevel ?? null,
                    sourceModule: item.sourceModule ?? null,
                    sourceSignalKey: item.sourceSignalKey ?? null,
                    dedupKey: item.dedupKey ?? null,
                    suggestedService: item.suggestedService ?? null,
                    lastEvaluatedAt: item.lastEvaluatedAt ?? null,
                  }
                : {}),
              source: input.source,
            },
          });
          continue;
        }

        await tx.projectOpportunity.create({
          data: {
            workspaceId: input.workspaceId,
            projectId: input.projectId,
            title: normalizedTitle,
            stage: item.stage,
            estimatedValue: new Prisma.Decimal(item.estimatedValue),
            status: item.status,
            ...(opportunityV2Ready
              ? {
                  category: item.category ?? null,
                  type: item.type ?? null,
                  rationale: item.rationale ?? null,
                  priority: item.priority ?? null,
                  score: typeof item.score === 'number' ? item.score : null,
                  impactLevel: item.impactLevel ?? null,
                  sourceModule: item.sourceModule ?? null,
                  sourceSignalKey: item.sourceSignalKey ?? null,
                  dedupKey: item.dedupKey ?? null,
                  suggestedService: item.suggestedService ?? null,
                  lastEvaluatedAt: item.lastEvaluatedAt ?? null,
                }
              : {}),
            source: input.source,
          },
        });
      }

      const staleIds = existing
        .filter((entry) => {
          const entryKeys = normalizeOpportunityKeys(entry.title, 'dedupKey' in entry ? entry.dedupKey : null);
          return !Array.from(entryKeys).some((key) => incomingAllKeys.has(key));
        })
        .map((entry) => entry.id);

      if (staleIds.length > 0) {
        await tx.projectOpportunity.deleteMany({
          where: {
            id: {
              in: staleIds,
            },
          },
        });
      }
    });

    return this.listProjectOpportunities(input.workspaceId, input.projectId);
  },

  async isProjectTasksSchemaReady() {
    return tableExists(PROJECT_TASK_TABLE);
  },

  async listProjectTasks(workspaceId: string, projectId: string) {
    const schemaReady = await this.isProjectTasksSchemaReady();
    if (!schemaReady) {
      return null;
    }

    return prisma.projectTask.findMany({
      where: {
        workspaceId,
        projectId,
      },
      orderBy: [
        { createdAt: 'asc' },
      ],
      select: {
        id: true,
        projectId: true,
        title: true,
        description: true,
        teamRole: true,
        priority: true,
        status: true,
        sourceType: true,
        dependsOnTaskId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async replaceProjectTasksBySource(input: {
    workspaceId: string;
    projectId: string;
    sourceType: string;
    items: Array<{
      title: string;
      description?: string;
      teamRole: string;
      priority: AgencyPriority;
      status: string;
      dependsOnTaskId?: string;
    }>;
  }) {
    const schemaReady = await this.isProjectTasksSchemaReady();
    if (!schemaReady) {
      return null;
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.projectTask.findMany({
        where: {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          sourceType: input.sourceType,
        },
        select: {
          id: true,
          title: true,
          teamRole: true,
        },
      });

      const existingByKey = new Map(existing.map((entry) => [normalizeTaskKey(entry.title, entry.teamRole), entry]));
      const incomingKeys = new Set<string>();

      for (const item of input.items) {
        const normalizedTitle = item.title.trim();
        const normalizedTeamRole = item.teamRole.trim();
        const itemKey = normalizeTaskKey(normalizedTitle, normalizedTeamRole);
        if (!itemKey || incomingKeys.has(itemKey)) {
          continue;
        }

        incomingKeys.add(itemKey);
        const existingEntry = existingByKey.get(itemKey);

        if (existingEntry) {
          await tx.projectTask.update({
            where: {
              id: existingEntry.id,
            },
            data: {
              title: normalizedTitle,
              description: item.description,
              teamRole: normalizedTeamRole,
              priority: item.priority,
              status: item.status,
              sourceType: input.sourceType,
              dependsOnTaskId: item.dependsOnTaskId,
            },
          });
          continue;
        }

        await tx.projectTask.create({
          data: {
            workspaceId: input.workspaceId,
            projectId: input.projectId,
            title: normalizedTitle,
            description: item.description,
            teamRole: normalizedTeamRole,
            priority: item.priority,
            status: item.status,
            sourceType: input.sourceType,
            dependsOnTaskId: item.dependsOnTaskId,
          },
        });
      }

      const staleIds = existing
        .filter((entry) => !incomingKeys.has(normalizeTaskKey(entry.title, entry.teamRole)))
        .map((entry) => entry.id);

      if (staleIds.length > 0) {
        await tx.projectTask.deleteMany({
          where: {
            id: {
              in: staleIds,
            },
          },
        });
      }
    });

    return this.listProjectTasks(input.workspaceId, input.projectId);
  },
};
