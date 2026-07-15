import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';

// Persistenza della Chat AI collaborativa (post-V4, Fase 1). Evoluzione della
// vecchia project-chat.repository (che era per-utente): ora la conversazione e'
// CONDIVISA per ambito. In Fase 1 l'unico ambito e' 'project' (una conversazione
// per progetto), con partecipanti su invito esplicito e autore su ogni messaggio.
// In Fase 2 si aggiungono gli ambiti 'client' e 'general', in Fase 3a gli allegati.
// Sola gestione storage; RAG e generazione stanno nel service del motore AI.

const AUTHOR_SELECT = { id: true, name: true, email: true } as const;

export type ConversationMessageInput = {
  workspaceId: string;
  conversationId: string;
  authorUserId: string | null; // null = messaggio dell'AI (role 'assistant')
  role: 'user' | 'assistant';
  content: string;
  citationsJson?: Prisma.InputJsonValue | null;
};

// Allegato in BOZZA: caricato nel composer, non ancora legato a un messaggio
// (messageId null). Diventa definitivo quando il messaggio viene inviato.
export type ConversationAttachmentDraftInput = {
  workspaceId: string;
  conversationId: string;
  createdByUserId: string;
  kind: 'file' | 'entity';
  entityType?: string | null;
  entityId?: string | null;
  label: string;
  mimeType?: string | null;
  fileSize?: number | null;
  content: string;
};

const ATTACHMENT_SELECT = {
  id: true,
  kind: true,
  entityType: true,
  entityId: true,
  label: true,
  mimeType: true,
  fileSize: true,
  contentChars: true,
  createdAt: true,
} as const;

export const aiConversationRepository = {
  // Conversazione dell'ambito progetto (thread unico condiviso). Null se non
  // ancora creata (nessuno ha ancora aperto la chat di quel progetto).
  findProjectConversation(workspaceId: string, projectId: string) {
    return prisma.aiConversation.findFirst({
      where: { workspaceId, scope: 'project', projectId },
    });
  },

  // Crea la conversazione dell'ambito progetto e iscrive il creatore come 'owner'
  // in un'unica transazione, cosi' chi apre per primo la chat la "possiede".
  async createProjectConversation(workspaceId: string, projectId: string, creatorUserId: string) {
    return prisma.aiConversation.create({
      data: {
        workspaceId,
        scope: 'project',
        projectId,
        createdByUserId: creatorUserId,
        participants: {
          create: {
            workspaceId,
            userId: creatorUserId,
            role: 'owner',
            invitedByUserId: creatorUserId,
          },
        },
      },
    });
  },

  // Trova o crea la conversazione del progetto. Usato all'apertura della chat.
  async getOrCreateProjectConversation(workspaceId: string, projectId: string, creatorUserId: string) {
    const existing = await this.findProjectConversation(workspaceId, projectId);
    if (existing) {
      return existing;
    }
    return this.createProjectConversation(workspaceId, projectId, creatorUserId);
  },

  // --- Ambito CLIENTE (Fase 2): una conversazione condivisa per cliente. Stessa
  // logica dell'ambito progetto ma agganciata a un clientId. ---
  findClientConversation(workspaceId: string, clientId: string) {
    return prisma.aiConversation.findFirst({
      where: { workspaceId, scope: 'client', clientId },
    });
  },

  async createClientConversation(workspaceId: string, clientId: string, creatorUserId: string) {
    return prisma.aiConversation.create({
      data: {
        workspaceId,
        scope: 'client',
        clientId,
        createdByUserId: creatorUserId,
        participants: {
          create: {
            workspaceId,
            userId: creatorUserId,
            role: 'owner',
            invitedByUserId: creatorUserId,
          },
        },
      },
    });
  },

  async getOrCreateClientConversation(workspaceId: string, clientId: string, creatorUserId: string) {
    const existing = await this.findClientConversation(workspaceId, clientId);
    if (existing) {
      return existing;
    }
    return this.createClientConversation(workspaceId, clientId, creatorUserId);
  },

  // --- Ambito GENERALE (Fase 2): una sola conversazione condivisa per workspace,
  // senza contesto CRM. Non c'e' un vincolo DB (projectId e clientId sono entrambi
  // null): l'unicita' e' garantita qui dal findFirst nel get-or-create. ---
  findGeneralConversation(workspaceId: string) {
    return prisma.aiConversation.findFirst({
      where: { workspaceId, scope: 'general' },
      orderBy: { createdAt: 'asc' },
    });
  },

  async createGeneralConversation(workspaceId: string, creatorUserId: string) {
    return prisma.aiConversation.create({
      data: {
        workspaceId,
        scope: 'general',
        createdByUserId: creatorUserId,
        participants: {
          create: {
            workspaceId,
            userId: creatorUserId,
            role: 'owner',
            invitedByUserId: creatorUserId,
          },
        },
      },
    });
  },

  async getOrCreateGeneralConversation(workspaceId: string, creatorUserId: string) {
    const existing = await this.findGeneralConversation(workspaceId);
    if (existing) {
      return existing;
    }
    return this.createGeneralConversation(workspaceId, creatorUserId);
  },

  // Id dei progetti di un cliente, unendo il legame diretto (Project.clientId) e
  // quello molti-a-molti (ProjectClient). Serve al RAG dell'ambito Cliente, che
  // cerca sulle Fonti di TUTTI i progetti del cliente.
  async listClientProjectIds(workspaceId: string, clientId: string): Promise<string[]> {
    const [direct, links] = await Promise.all([
      prisma.project.findMany({ where: { workspaceId, clientId }, select: { id: true } }),
      prisma.projectClient.findMany({
        where: { clientId, project: { workspaceId } },
        select: { projectId: true },
      }),
    ]);
    const ids = new Set<string>();
    direct.forEach((row) => ids.add(row.id));
    links.forEach((row) => ids.add(row.projectId));
    return [...ids];
  },

  // Messaggi della conversazione dal piu' vecchio al piu' recente (ordine di
  // lettura). Include l'autore (per mostrarlo nella UI). `limit` tiene solo gli
  // ultimi N quando serve limitare il contesto passato all'AI.
  async listMessages(conversationId: string, limit = 200) {
    const rows = await prisma.aiConversationMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        author: { select: AUTHOR_SELECT },
        attachments: { select: ATTACHMENT_SELECT, orderBy: { createdAt: 'asc' } },
      },
    });
    return rows.reverse();
  },

  createMessages(rows: ConversationMessageInput[]) {
    return prisma.aiConversationMessage.createMany({
      data: rows.map((row) => ({
        workspaceId: row.workspaceId,
        conversationId: row.conversationId,
        authorUserId: row.authorUserId,
        role: row.role,
        content: row.content,
        citationsJson: (row.citationsJson ?? undefined) as Prisma.InputJsonValue | undefined,
      })),
    });
  },

  // Come createMessages ma per un solo messaggio, restituendo la riga creata:
  // serve l'id per legarci gli allegati in bozza (Fase 3a).
  createMessage(row: ConversationMessageInput) {
    return prisma.aiConversationMessage.create({
      data: {
        workspaceId: row.workspaceId,
        conversationId: row.conversationId,
        authorUserId: row.authorUserId,
        role: row.role,
        content: row.content,
        citationsJson: (row.citationsJson ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  },

  clearMessages(conversationId: string) {
    return prisma.aiConversationMessage.deleteMany({ where: { conversationId } });
  },

  // Partecipanti della conversazione, con i dati utente per la UI (chi puo' vedere
  // e scrivere). Owner in cima, poi per data di ingresso.
  listParticipants(conversationId: string) {
    return prisma.aiConversationParticipant.findMany({
      where: { conversationId },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      include: { user: { select: AUTHOR_SELECT } },
    });
  },

  isParticipant(conversationId: string, userId: string) {
    return prisma.aiConversationParticipant
      .findUnique({ where: { conversationId_userId: { conversationId, userId } } })
      .then((row) => Boolean(row));
  },

  // Invita (o riattiva) un partecipante. Idempotente sull'unicita' (conversationId, userId).
  addParticipant(input: {
    workspaceId: string;
    conversationId: string;
    userId: string;
    role?: 'owner' | 'member';
    invitedByUserId: string;
  }) {
    return prisma.aiConversationParticipant.upsert({
      where: { conversationId_userId: { conversationId: input.conversationId, userId: input.userId } },
      update: {},
      create: {
        workspaceId: input.workspaceId,
        conversationId: input.conversationId,
        userId: input.userId,
        role: input.role ?? 'member',
        invitedByUserId: input.invitedByUserId,
      },
    });
  },

  removeParticipant(conversationId: string, userId: string) {
    return prisma.aiConversationParticipant.deleteMany({ where: { conversationId, userId } });
  },

  // --- Allegati (Fase 3a): documenti caricati ed elementi CRM allegati a un
  // messaggio. Il ciclo di vita e' bozza (messageId null, di chi l'ha caricata) ->
  // legato al messaggio all'invio. ---

  createAttachmentDraft(input: ConversationAttachmentDraftInput) {
    return prisma.aiConversationAttachment.create({
      data: {
        workspaceId: input.workspaceId,
        conversationId: input.conversationId,
        createdByUserId: input.createdByUserId,
        kind: input.kind,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        label: input.label,
        mimeType: input.mimeType ?? null,
        fileSize: input.fileSize ?? null,
        content: input.content,
        contentChars: input.content.length,
      },
      select: ATTACHMENT_SELECT,
    });
  },

  // Bozze dell'utente su questa conversazione (quelle mostrate nel composer).
  listAttachmentDrafts(conversationId: string, userId: string) {
    return prisma.aiConversationAttachment.findMany({
      where: { conversationId, createdByUserId: userId, messageId: null },
      orderBy: { createdAt: 'asc' },
      select: ATTACHMENT_SELECT,
    });
  },

  // Bozze indicate, con il testo: usate per comporre il contesto AI del turno.
  listAttachmentDraftsByIds(conversationId: string, userId: string, ids: string[]) {
    if (ids.length === 0) {
      return Promise.resolve([] as Array<{ id: string; kind: string; label: string; content: string }>);
    }
    return prisma.aiConversationAttachment.findMany({
      where: { id: { in: ids }, conversationId, createdByUserId: userId, messageId: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, kind: true, label: true, content: true },
    });
  },

  deleteAttachmentDraft(id: string, userId: string) {
    return prisma.aiConversationAttachment.deleteMany({
      where: { id, createdByUserId: userId, messageId: null },
    });
  },

  // Lega le bozze indicate al messaggio appena creato (rendendole definitive).
  linkAttachmentsToMessage(input: {
    conversationId: string;
    userId: string;
    attachmentIds: string[];
    messageId: string;
  }) {
    if (input.attachmentIds.length === 0) {
      return Promise.resolve({ count: 0 });
    }
    return prisma.aiConversationAttachment.updateMany({
      where: {
        id: { in: input.attachmentIds },
        conversationId: input.conversationId,
        createdByUserId: input.userId,
        messageId: null,
      },
      data: { messageId: input.messageId },
    });
  },

  // Testo degli allegati gia' inviati nella conversazione, dal piu' recente:
  // serve a ridare all'AI il contesto allegato nei turni precedenti.
  listSentAttachments(conversationId: string, limit = 6) {
    return prisma.aiConversationAttachment.findMany({
      where: { conversationId, messageId: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, kind: true, label: true, content: true },
    });
  },

  // Membri attivi del workspace, per proporre chi invitare alla conversazione.
  listWorkspaceMembers(workspaceId: string) {
    return prisma.membership.findMany({
      where: { workspaceId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: AUTHOR_SELECT } },
    });
  },
};
