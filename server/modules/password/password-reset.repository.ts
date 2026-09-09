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

  /**
   * Cancella le righe ormai inutili a chiunque. Torna quante ne ha tolte.
   *
   * Senza questa, la tabella cresceva e non calava mai: nessuno cancellava ne'
   * i token usati ne' quelli scaduti. Una tabella che cresce all'infinito
   * peggiora nel tempo proprio `countRecentByIp` qui sopra, che e' l'unica
   * difesa a database della rotta pubblica.
   *
   * ⚠️ SI CANCELLA PER `expiresAt`, NON PER `createdAt`, e non e' un dettaglio.
   * `countRecentByIp` conta le righe RECENTI per indirizzo IP: se la purga
   * togliesse righe dentro la sua finestra, chi sta abusando della rotta si
   * ritroverebbe il contatore azzerato dalla pulizia, cioe' la purga
   * smonterebbe il tetto. Filtrando su `expiresAt` la cosa e' impossibile per
   * costruzione: `expiresAt` e' sempre POSTERIORE a `createdAt` (viene
   * calcolato come `createdAt + durata` alla creazione), quindi una riga con
   * `expiresAt` piu' vecchio del taglio ha per forza un `createdAt` ancora piu'
   * vecchio. Il chiamante sceglie il taglio, e il servizio lo tiene ben oltre
   * la finestra del tetto (`RESET_PURGE_RETENTION_MS`).
   *
   * Usa l'indice `@@index([expiresAt])`, che esiste dal 31/8/2026.
   */
  async purgeExpired(input: { expiredBefore: Date }) {
    const result = await prisma.passwordResetToken.deleteMany({
      where: {
        expiresAt: { lt: input.expiredBefore },
      },
    });

    return result.count;
  },
};
