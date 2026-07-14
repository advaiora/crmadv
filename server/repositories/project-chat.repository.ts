import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';

// Persistenza della Chat AI di progetto (V4). Conversazione per-progetto e
// per-utente: una riga per messaggio (utente/assistente). Sola gestione storage;
// il recupero RAG e la generazione stanno nel service del motore AI.

export type ProjectChatMessageInput = {
  workspaceId: string;
  projectId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  citationsJson?: Prisma.InputJsonValue | null;
};

export const projectChatRepository = {
  // Messaggi della conversazione di un utente su un progetto, dal più vecchio al
  // più recente (ordine di lettura). `limit` tiene solo gli ultimi N se serve.
  async listForUser(workspaceId: string, projectId: string, userId: string, limit = 200) {
    const rows = await prisma.projectChatMessage.findMany({
      where: { workspaceId, projectId, userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.reverse();
  },

  create(data: ProjectChatMessageInput) {
    return prisma.projectChatMessage.create({
      data: {
        workspaceId: data.workspaceId,
        projectId: data.projectId,
        userId: data.userId,
        role: data.role,
        content: data.content,
        citationsJson: data.citationsJson ?? undefined,
      },
    });
  },

  // Salva in un colpo la coppia domanda utente + risposta assistente, così lo
  // storico resta coerente anche se qualcosa fallisce tra i due.
  createMany(rows: ProjectChatMessageInput[]) {
    return prisma.projectChatMessage.createMany({
      data: rows.map((row) => ({
        workspaceId: row.workspaceId,
        projectId: row.projectId,
        userId: row.userId,
        role: row.role,
        content: row.content,
        citationsJson: (row.citationsJson ?? undefined) as Prisma.InputJsonValue | undefined,
      })),
    });
  },

  deleteForUser(workspaceId: string, projectId: string, userId: string) {
    return prisma.projectChatMessage.deleteMany({ where: { workspaceId, projectId, userId } });
  },
};
