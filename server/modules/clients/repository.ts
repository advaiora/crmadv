import { Prisma, type ClientType } from '@prisma/client';
import { prisma } from '../../prisma.js';

export type ClientSortField = 'name' | 'createdAt' | 'updatedAt';
export type ClientSortDirection = 'asc' | 'desc';

type ListClientsInput = {
  workspaceId: string;
  query?: string;
  type?: ClientType;
  page: number;
  pageSize: number;
  sortField: ClientSortField;
  sortDirection: ClientSortDirection;
};

type ExportClientsInput = {
  workspaceId: string;
  query?: string;
  type?: ClientType;
  sortField: ClientSortField;
  sortDirection: ClientSortDirection;
};

type CreateClientInput = {
  type: ClientType;
  name: string;
  email: string | null;
  phone: string | null;
  vatNumber: string | null;
  taxCode: string | null;
  // I quattro campi di fatturazione e contatto sono arrivati dopo (CRMA-24) e
  // sono OPZIONALI qui apposta: la migrazione e i due elenchi di questo file
  // viaggiano da soli, senza obbligare `service.ts` a nominarli prima che
  // esistano a schermo. Chi non li passa scrive `null`, che e' il valore giusto.
  //
  // ✅ La catena e' stata chiusa il 9/9/2026 (CRMA-58): in `service.ts` i quattro
  // nomi sono ora in `CLIENT_BODY_FIELDS`, nei due parser del corpo, in
  // `mapClient`, nelle due direzioni del CSV e nel registro attivita'. Le regole
  // di forma (PEC, codice SDI, sito) stanno in `field-rules.ts`, provate a parte.
  // ⚠️ Un campo NUOVO va comunque collegato in tutti quei punti: qui e nel
  // `select` si salva e si rilegge, ma senza `service.ts` non arriva a schermo.
  pecEmail?: string | null;
  sdiCode?: string | null;
  website?: string | null;
  contactPerson?: string | null;
  street: string | null;
  city: string | null;
  zip: string | null;
  province: string | null;
  country: string | null;
  notes: string | null;
  tags: string[];
  customFields?: Prisma.InputJsonValue;
};

type UpdateClientInput = Partial<CreateClientInput>;

/**
 * Le colonne che escono da questo repository — una volta sola, perche' le
 * quattro query che le chiedono devono restituire la stessa cosa.
 *
 * ⚠️ Quando si aggiunge un campo a `Client` va aggiunto anche qui, o si ottiene
 * un campo che si salva e non si rilegge: nessun errore, nessun test rosso, e
 * il guasto si vede solo ricaricando la maschera. Il test
 * «ogni colonna del modello Client e' chiesta al database» in `repository.test.ts`
 * esiste apposta per non lasciarlo scoprire a chi usa il CRM. Modello imitato:
 * `server/modules/mail/mail.repository.ts` (`CAMPI_LETTI`).
 */
export const clientSelect = {
  id: true,
  workspaceId: true,
  type: true,
  name: true,
  email: true,
  phone: true,
  vatNumber: true,
  taxCode: true,
  pecEmail: true,
  sdiCode: true,
  website: true,
  contactPerson: true,
  street: true,
  city: true,
  zip: true,
  province: true,
  country: true,
  notes: true,
  tags: true,
  customFields: true,
  createdAt: true,
  updatedAt: true,
} as const;

const clientProjectSelect = {
  id: true,
  workspaceId: true,
  clientId: true,
  name: true,
  pipelineStageId: true,
  createdAt: true,
  updatedAt: true,
  pipelineStage: {
    select: {
      id: true,
      categoryId: true,
      name: true,
      sortOrder: true,
      isClosed: true,
      color: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} as const;

const PROJECT_TABLE = 'Project';
const PROJECT_CLIENT_TABLE = 'ProjectClient';

const isProjectClientColumnReady = async () => {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = ${PROJECT_TABLE}
      AND column_name = 'clientId'
    ) AS "exists"
  `);

  return rows[0]?.exists === true;
};

const isProjectClientsTableReady = async () => {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = ${PROJECT_CLIENT_TABLE}
    ) AS "exists"
  `);

  return rows[0]?.exists === true;
};

const buildSearchWhere = (query: string): Prisma.ClientWhereInput => ({
  OR: [
    {
      name: {
        contains: query,
        mode: 'insensitive',
      },
    },
    {
      email: {
        contains: query,
        mode: 'insensitive',
      },
    },
    {
      phone: {
        contains: query,
        mode: 'insensitive',
      },
    },
  ],
});

/**
 * Le colonne che questo repository SCRIVE quando crea un cliente.
 *
 * E' una funzione a se' — invece di un oggetto scritto dentro `create()` —
 * perche' cosi' si puo' provare senza database che nomini davvero tutti i campi
 * scrivibili del modello. La rilettura ha `clientSelect` a proteggerla; senza
 * questo, la scrittura non aveva niente.
 *
 * ⚠️ Un campo dimenticato qui e' l'altra meta' dello stesso guasto: si compila
 * a schermo, non arriva al database, e la maschera ricaricata lo mostra vuoto.
 */
export const buildCreateData = (
  workspaceId: string,
  input: CreateClientInput,
): Prisma.ClientUncheckedCreateInput => ({
  workspaceId,
  type: input.type,
  name: input.name,
  email: input.email,
  phone: input.phone,
  vatNumber: input.vatNumber,
  taxCode: input.taxCode,
  pecEmail: input.pecEmail ?? null,
  sdiCode: input.sdiCode ?? null,
  website: input.website ?? null,
  contactPerson: input.contactPerson ?? null,
  street: input.street,
  city: input.city,
  zip: input.zip,
  province: input.province,
  country: input.country,
  notes: input.notes,
  tags: input.tags,
  customFields: input.customFields ?? {},
});

export const clientsRepository = {
  async listClients(input: ListClientsInput) {
    const skip = (input.page - 1) * input.pageSize;
    const where: Prisma.ClientWhereInput = {
      workspaceId: input.workspaceId,
      ...(input.type ? { type: input.type } : {}),
      ...(input.query ? buildSearchWhere(input.query) : {}),
    };

    const orderBy: Prisma.ClientOrderByWithRelationInput[] = [
      { [input.sortField]: input.sortDirection },
      { id: input.sortDirection },
    ];

    const [items, total] = await prisma.$transaction([
      prisma.client.findMany({
        where,
        select: clientSelect,
        orderBy,
        skip,
        take: input.pageSize,
      }),
      prisma.client.count({
        where,
      }),
    ]);

    return {
      items,
      total,
    };
  },

  listForExport(input: ExportClientsInput) {
    const where: Prisma.ClientWhereInput = {
      workspaceId: input.workspaceId,
      ...(input.type ? { type: input.type } : {}),
      ...(input.query ? buildSearchWhere(input.query) : {}),
    };

    const orderBy: Prisma.ClientOrderByWithRelationInput[] = [
      { [input.sortField]: input.sortDirection },
      { id: input.sortDirection },
    ];

    return prisma.client.findMany({
      where,
      select: clientSelect,
      orderBy,
    });
  },

  findById(workspaceId: string, id: string) {
    return prisma.client.findFirst({
      where: {
        workspaceId,
        id,
      },
      select: clientSelect,
    });
  },

  async listProjectsByClient(workspaceId: string, clientId: string) {
    const [projectClientsReady, legacyProjectClientReady] = await Promise.all([
      isProjectClientsTableReady(),
      isProjectClientColumnReady(),
    ]);

    if (projectClientsReady) {
      return prisma.project.findMany({
        where: {
          workspaceId,
          clientLinks: {
            some: {
              clientId,
            },
          },
        },
        orderBy: [
          { updatedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        select: clientProjectSelect,
      });
    }

    if (legacyProjectClientReady) {
      return prisma.project.findMany({
        where: {
          workspaceId,
          clientId,
        },
        orderBy: [
          { updatedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        select: clientProjectSelect,
      });
    }

    return [];
  },

  create(workspaceId: string, input: CreateClientInput) {
    return prisma.client.create({
      data: buildCreateData(workspaceId, input),
      select: clientSelect,
    });
  },

  async update(workspaceId: string, id: string, input: UpdateClientInput) {
    const updated = await prisma.client.updateMany({
      where: {
        workspaceId,
        id,
      },
      data: input,
    });

    if (updated.count === 0) {
      return null;
    }

    return this.findById(workspaceId, id);
  },

  delete(workspaceId: string, id: string) {
    return prisma.client.deleteMany({
      where: {
        workspaceId,
        id,
      },
    });
  },
};
