import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';

// Persistenza della Chat AI collaborativa (post-V4). Evoluzione della vecchia
// project-chat.repository (che era per-utente): la conversazione e' CONDIVISA su
// invito esplicito, con autore su ogni messaggio. Ambiti 'project'/'client'/
// 'general' (Fase 2), allegati (Fase 3a).
// Sola gestione storage; RAG e generazione stanno nel service del motore AI.
//
// SESSIONI (15/7/2026, spec sez. 4-bis): un ambito ha N sessioni, non una chat
// sola. L'ambito e' un FILTRO (scope + progetto/cliente), la sessione e' la
// conversazione vera e propria. Chi lascia un gruppo viene congelato (frozenAt
// sul partecipante), mai cancellato.

const AUTHOR_SELECT = { id: true, name: true, email: true } as const;

// Ambito di una sessione: dice su quale contesto CRM ragiona la chat.
export type ChatScopeFilter =
  | { scope: 'project'; projectId: string }
  | { scope: 'client'; clientId: string }
  | { scope: 'general' };

// Filtro/valori dell'ambito. Gli id non pertinenti sono esplicitamente null (non
// undefined): serve sia a filtrare con precisione sia a creare righe coerenti.
const scopeWhere = (workspaceId: string, target: ChatScopeFilter) => ({
  workspaceId,
  scope: target.scope,
  projectId: target.scope === 'project' ? target.projectId : null,
  clientId: target.scope === 'client' ? target.clientId : null,
});

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
  // --- SESSIONI (15/7/2026). Un ambito ha N sessioni, non una chat sola. Prima
  // c'erano tre trii find/create/getOrCreate (uno per ambito) che restituivano
  // SEMPRE la stessa conversazione condivisa: chi non l'apriva per primo restava
  // fuori. Ora l'ambito e' solo un filtro e le sessioni sono per utente. ---

  // Elenco delle sessioni dell'utente su un ambito, dalla piu' recente. Include
  // le sessioni CONGELATE (ci si e' usciti/rimossi): restano nell'elenco in sola
  // lettura, per questo si filtra sul partecipante e non su frozenAt.
  listUserSessions(workspaceId: string, userId: string, target: ChatScopeFilter) {
    return prisma.aiConversation.findMany({
      where: {
        ...scopeWhere(workspaceId, target),
        participants: { some: { userId } },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        participants: {
          where: { userId },
          select: { role: true, frozenAt: true },
        },
        _count: { select: { messages: true, participants: true } },
      },
    });
  },

  // Sessione piu' recente dell'utente su un ambito. E' quella su cui si atterra
  // aprendo la chat senza chiederne una precisa.
  findLatestUserSession(workspaceId: string, userId: string, target: ChatScopeFilter) {
    return prisma.aiConversation.findFirst({
      where: {
        ...scopeWhere(workspaceId, target),
        participants: { some: { userId } },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
    });
  },

  // Sessione per id, senza controlli di accesso (li fa il service).
  findSessionById(workspaceId: string, conversationId: string) {
    return prisma.aiConversation.findFirst({ where: { id: conversationId, workspaceId } });
  },

  // Crea una sessione sull'ambito e iscrive il creatore come 'owner' in un'unica
  // transazione. 'owner' e' relativo a QUESTA sessione (rimuove i membri, scioglie
  // il gruppo): non rende proprietari dell'ambito, e si puo' uscire.
  createSession(input: {
    workspaceId: string;
    target: ChatScopeFilter;
    creatorUserId: string;
    title?: string | null;
    resumedFromConversationId?: string | null;
  }) {
    return prisma.aiConversation.create({
      data: {
        ...scopeWhere(input.workspaceId, input.target),
        createdByUserId: input.creatorUserId,
        title: input.title ?? null,
        resumedFromConversationId: input.resumedFromConversationId ?? null,
        lastMessageAt: new Date(),
        participants: {
          create: {
            workspaceId: input.workspaceId,
            userId: input.creatorUserId,
            role: 'owner',
            invitedByUserId: input.creatorUserId,
          },
        },
      },
    });
  },

  // Aggiorna la data dell'ultimo messaggio (ordina l'elenco) e, se la sessione non
  // ha ancora un titolo, glielo assegna. Chiamata a ogni invio.
  touchSession(conversationId: string, input: { lastMessageAt: Date; titleIfEmpty?: string | null }) {
    return prisma.aiConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: input.lastMessageAt,
        ...(input.titleIfEmpty ? { title: input.titleIfEmpty } : {}),
      },
    });
  },

  setSessionTitle(conversationId: string, title: string) {
    return prisma.aiConversation.update({ where: { id: conversationId }, data: { title } });
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
  // `until` (= frozenAt del partecipante) taglia i messaggi successivi all'uscita:
  // chi ha lasciato il gruppo vede cio' che ha vissuto, non cio' che e' successo dopo.
  async listMessages(conversationId: string, limit = 200, until?: Date | null) {
    const rows = await prisma.aiConversationMessage.findMany({
      where: { conversationId, ...(until ? { createdAt: { lte: until } } : {}) },
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

  // Partecipanti ATTIVI della conversazione, con i dati utente per la UI (chi puo'
  // vedere e scrivere). Owner in cima, poi per data di ingresso. I congelati sono
  // esclusi di proposito: chi resta a scrivere deve sapere esattamente chi lo legge.
  listParticipants(conversationId: string) {
    return prisma.aiConversationParticipant.findMany({
      where: { conversationId, frozenAt: null },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      include: { user: { select: AUTHOR_SELECT } },
    });
  },

  // Riga del partecipante, congelati compresi: il service ne legge role e frozenAt
  // per decidere tra accesso pieno, sola lettura e diniego.
  findParticipant(conversationId: string, userId: string) {
    return prisma.aiConversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
  },

  isParticipant(conversationId: string, userId: string) {
    return this.findParticipant(conversationId, userId).then((row) => Boolean(row) && !row?.frozenAt);
  },

  // Quanti partecipanti ATTIVI (non congelati) ha la sessione. Serve alla regola
  // "da solo l'AI risponde sempre" (spec sez. 2): in una sessione solitaria ogni
  // messaggio interpella l'AI, in una di gruppo serve @AI o il pulsante. E' per
  // SESSIONE, non per ambito, quindi si conta sulla conversazione.
  countActiveParticipants(conversationId: string) {
    return prisma.aiConversationParticipant.count({
      where: { conversationId, frozenAt: null },
    });
  },

  // Chi resta ATTIVO oltre a un utente, dal piu' anziano: e' l'ordine di successione
  // quando l'owner esce (la sessione passa a chi resta, non muore).
  listOtherActiveParticipants(conversationId: string, exceptUserId: string) {
    return prisma.aiConversationParticipant.findMany({
      where: { conversationId, frozenAt: null, userId: { not: exceptUserId } },
      orderBy: { createdAt: 'asc' },
    });
  },

  // Invita un partecipante. Idempotente sull'unicita' (conversationId, userId):
  // re-invitare un CONGELATO lo scongela e gli ridiventa visibile tutto lo storico.
  addParticipant(input: {
    workspaceId: string;
    conversationId: string;
    userId: string;
    role?: 'owner' | 'member';
    invitedByUserId: string;
  }) {
    return prisma.aiConversationParticipant.upsert({
      where: { conversationId_userId: { conversationId: input.conversationId, userId: input.userId } },
      update: { frozenAt: null },
      create: {
        workspaceId: input.workspaceId,
        conversationId: input.conversationId,
        userId: input.userId,
        role: input.role ?? 'member',
        invitedByUserId: input.invitedByUserId,
      },
    });
  },

  // Congela un partecipante: NON lo cancella. Vale per l'uscita autonoma, la
  // rimozione da parte dell'owner/admin e lo scioglimento del gruppo - regola unica.
  // Se era owner torna 'member': la gestione della sessione passa a chi resta.
  freezeParticipant(conversationId: string, userId: string, frozenAt: Date) {
    return prisma.aiConversationParticipant.updateMany({
      where: { conversationId, userId, frozenAt: null },
      data: { frozenAt, role: 'member' },
    });
  },

  // Congela in blocco tutti gli attivi tranne uno: e' lo scioglimento del gruppo,
  // che riporta la sessione a chi lo esegue senza toccare i messaggi.
  freezeOtherParticipants(conversationId: string, exceptUserId: string, frozenAt: Date) {
    return prisma.aiConversationParticipant.updateMany({
      where: { conversationId, frozenAt: null, userId: { not: exceptUserId } },
      data: { frozenAt, role: 'member' },
    });
  },

  promoteToOwner(conversationId: string, userId: string) {
    return prisma.aiConversationParticipant.updateMany({
      where: { conversationId, userId },
      data: { role: 'owner' },
    });
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
