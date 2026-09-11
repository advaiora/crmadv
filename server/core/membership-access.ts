/**
 * Chi e' «membro di un workspace», dal Cestino in poi (CRMA-157).
 *
 * Prima del Cestino la domanda aveva una risposta sola: `status === 'ACTIVE'`.
 * Da quando cestinare una membership e' un gesto possibile, quella risposta e'
 * **incompleta**, perche' cestinare NON cambia lo stato: scrive `deletedAt` e
 * lascia la riga `ACTIVE` (`prisma/schema.prisma:343-350`). Un controllo che
 * guarda il solo stato quindi non sbaglia — risponde a una domanda che nessuno
 * ha aggiornato, ed e' esattamente il guasto che non da' errore.
 *
 * La decisione di prodotto che questo file mette in codice:
 *
 * 1. **Cestinare una membership TOGLIE l'accesso**, e il livello giusto e' la
 *    membership, non l'utente. Una persona sta in piu' workspace: cestinarla in
 *    A non deve toccarla in B. Per questo il rifiuto e' un **403 in
 *    `requireWorkspace`** («non sei membro di questo workspace»), non un 401
 *    globale in `requireAuth` — e per questo `User` non ha `deletedAt` e non
 *    deve averlo.
 * 2. **Il ripristino non ha bisogno di nessun gesto in piu'.** `markRestored()`
 *    azzera `deletedAt`, e siccome l'accesso si decide leggendo quella colonna,
 *    la persona rientra da sola. Nessuna migrazione dati, niente da ricucire.
 *
 * Il filtro sta scritto qui una volta invece di essere ricopiato nei sette punti
 * della catena, per la stessa ragione per cui esiste `soft-delete.ts`: un
 * letterale ricopiato non si cerca in modo affidabile e non si cambia in blocco.
 */

import { NOT_DELETED, isTrashed, markRestored } from './soft-delete.js';

/**
 * Le due condizioni che insieme fanno un membro. Vanno aggiunte a OGNI lettura
 * di `Membership` che serva a decidere un accesso, un conteggio di membri o
 * l'intestazione di qualcosa a una persona.
 */
export const ACTIVE_MEMBER = {
  status: 'ACTIVE',
  ...NOT_DELETED,
} as const;

/**
 * Aggiunge le due condizioni a una clausola `where` esistente.
 *
 * Si usa cosi':
 *   where: activeMember({ workspaceId, userId })
 * invece di:
 *   where: { workspaceId, userId, status: 'ACTIVE' }
 */
export const activeMember = <T extends Record<string, unknown>>(where: T) => ({
  ...where,
  ...ACTIVE_MEMBER,
});

/**
 * Il `select` minimo per decidere se una membership da' accesso.
 *
 * Serve dove la lettura passa per `findUnique` sulla chiave `(workspaceId,
 * userId)`: li' il `where` accetta solo i campi unici, quindi il filtro non puo'
 * stare nella query e la decisione si prende sulla riga letta con
 * `grantsWorkspaceAccess`. ⚠️ `deletedAt` va chiesto esplicitamente: un `select`
 * che non lo nomina fa tornare `undefined`, e `undefined` non e' cestinato.
 */
export const MEMBERSHIP_ACCESS_SELECT = {
  id: true,
  status: true,
  deletedAt: true,
} as const;

/** Vero se la membership letta da' davvero accesso al workspace. */
export const grantsWorkspaceAccess = (
  membership: { status: string; deletedAt: Date | null } | null | undefined,
): boolean => membership?.status === 'ACTIVE' && !isTrashed(membership);

/**
 * I campi da scrivere quando si riporta dentro una persona che era stata tolta:
 * accettazione di un invito, e ogni altro punto che «ri-attiva» una membership
 * gia' esistente.
 *
 * ⚠️ Non basta rimettere `status: 'ACTIVE'`, ed e' il difetto speculare di tutto
 * questo lavoro: la coppia `(workspaceId, userId)` resta unica anche da
 * cestinata, quindi reinvitare aggiorna la riga vecchia invece di crearne una
 * nuova. Senza `markRestored()` l'invito riuscirebbe, verrebbe emesso un token
 * di sessione valido, e poi ogni rotta risponderebbe 403 — un blocco fuori dal
 * CRM, senza un errore che spieghi perche'.
 */
export const markMembershipReactivated = () => ({
  status: 'ACTIVE' as const,
  ...markRestored(),
});
