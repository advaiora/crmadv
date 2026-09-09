import type { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';

// Accesso alla tabella `PasswordResetToken`, che dal 31/8/2026 esisteva senza
// nessun lettore ne' scrittore (migrazione `20260831170847`). Forma copiata da
// `server/modules/team/team-invite.repository.ts`, incluso il `tx?` opzionale:
// la conferma del reset deve leggere e consumare il token dentro la stessa
// transazione che scrive la password nuova.

const withClient = (tx?: Prisma.TransactionClient) => tx ?? prisma;

const passwordResetTokenSelect = {
  id: true,
  userId: true,
  expiresAt: true,
  usedAt: true,
  createdAt: true,
} as const;

// ⚠️ `tokenHash` non e' nella select, ed e' deliberato: chi legge una riga di
// reset non ha nessun motivo di rimettere in circolo l'impronta. Si cerca PER
// impronta, non si legge l'impronta.

export const passwordResetRepository = {
  create(
    input: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
      requestIp: string | null;
    },
    tx?: Prisma.TransactionClient,
  ) {
    return withClient(tx).passwordResetToken.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        requestIp: input.requestIp,
      },
      select: passwordResetTokenSelect,
    });
  },

  findByTokenHash(tokenHash: string, tx?: Prisma.TransactionClient) {
    return withClient(tx).passwordResetToken.findUnique({
      where: { tokenHash },
      select: passwordResetTokenSelect,
    });
  },

  /**
   * Consuma il token, ma SOLO se e' ancora vergine.
   *
   * ⚠️ Il `usedAt: null` nel `where` non e' ridondante rispetto al controllo che
   * il servizio ha gia' fatto: e' cio' che rende il token davvero monouso quando
   * due richieste con lo stesso token arrivano insieme. Senza, entrambe
   * passerebbero il controllo prima che l'altra scriva. `updateMany` invece di
   * `update` perche' torna quante righe ha toccato: `0` significa "me l'ha
   * soffiato l'altra richiesta", e il servizio lo tratta da token gia' usato.
   */
  async markUsed(input: { tokenId: string; usedAt: Date }, tx?: Prisma.TransactionClient) {
    const result = await withClient(tx).passwordResetToken.updateMany({
      where: {
        id: input.tokenId,
        usedAt: null,
      },
      data: {
        usedAt: input.usedAt,
      },
    });

    return result.count === 1;
  },

  /**
   * Brucia le richieste ancora aperte di un utente.
   *
   * Serve due volte: quando se ne chiede una nuova (il link vecchio deve morire,
   * altrimenti restano validi tutti i link mai chiesti) e dopo un reset andato a
   * buon fine (chi e' rientrato non deve lasciarsi dietro link ancora buoni).
   */
  invalidateOutstanding(
    input: { userId: string; usedAt: Date },
    tx?: Prisma.TransactionClient,
  ) {
    return withClient(tx).passwordResetToken.updateMany({
      where: {
        userId: input.userId,
        usedAt: null,
      },
      data: {
        usedAt: input.usedAt,
      },
    });
  },

  /**
   * Quante richieste sono partite da questo indirizzo nella finestra.
   *
   * E' il motivo per cui la colonna `requestIp` esiste. Il limite in memoria
   * (`rate-limit.ts`) si azzera a ogni riavvio dell'API; questo no, perche' sta
   * a database — quindi regge anche a chi provasse ad approfittare di un
   * riavvio.
   */
  countRecentByIp(input: { requestIp: string; since: Date }) {
    return prisma.passwordResetToken.count({
      where: {
        requestIp: input.requestIp,
        createdAt: { gte: input.since },
      },
    });
  },
};
