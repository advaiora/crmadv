/**
 * Il meccanismo generale del Cestino (CRMA-29).
 *
 * Il compito dice che il lavoro vero non e' aggiungere la colonna: e' che
 * **ogni singola lettura** delle entita' accese escluda i cestinati. Se ne
 * sfugge una, il cliente cancellato ricompare in un punto solo del CRM, e non
 * lo trova nessun test — perche' il codice funziona: sta rispondendo a una
 * domanda che nessuno ha aggiornato.
 *
 * Questo file esiste perche' quel filtro sia **una cosa sola scritta una volta**
 * invece di `deletedAt: null` ricopiato a mano in una sessantina di punti. Un
 * letterale ricopiato non si puo' cercare in modo affidabile ne' cambiare in
 * blocco; una funzione con un nome si'.
 *
 * ⚠️ Le due regole di disegno da non perdere di vista:
 *
 * 1. **Cestinare non cancella niente.** Nessuna cascata parte: le righe figlie
 *    restano dove sono. E' per questo che un elemento ripristinato torna
 *    completo *per costruzione*, senza dover ricucire a mano le ~50 relazioni
 *    che puntano al perimetro. Le cascate del database sparano solo
 *    sull'eliminazione definitiva, che e' quando devono sparare.
 * 2. **Un figlio si nasconde guardando il padre**, non stampandogli addosso una
 *    seconda data. Se il cliente e' nel cestino, i suoi progetti spariscono
 *    perche' la lettura dei progetti filtra sul cliente — non perche' qualcuno
 *    abbia scritto `deletedAt` anche su di loro. Due date da tenere allineate
 *    sono due date che prima o poi divergono.
 */

/** Le entita' su cui il Cestino e' acceso oggi (perimetro della release di settembre). */
export const TRASHABLE_ENTITIES = {
  client: 'Client',
  membership: 'Membership',
  message: 'WorkspaceMessage',
  role: 'Role',
} as const;

export type TrashableEntity = (typeof TRASHABLE_ENTITIES)[keyof typeof TRASHABLE_ENTITIES];

/** Filtro "non cestinato": va aggiunto a OGNI lettura delle entita' qui sopra. */
export const NOT_DELETED = { deletedAt: null } as const;

/** Filtro "solo cestinato": lo usa la pagina Cestino, e nessun altro. */
export const ONLY_DELETED = { deletedAt: { not: null } } as const;

/**
 * Aggiunge il filtro "non cestinato" a una clausola `where` esistente.
 *
 * Si usa cosi':
 *   where: notDeleted({ workspaceId })
 * invece di:
 *   where: { workspaceId, deletedAt: null }
 *
 * La differenza non e' estetica: la prima forma si trova con una ricerca sola
 * quando fra sei mesi si accendera' il cestino sul resto del CRM.
 */
export const notDeleted = <T extends Record<string, unknown>>(where: T) => ({
  ...where,
  ...NOT_DELETED,
});

/** Come `notDeleted`, per le letture della pagina Cestino. */
export const onlyDeleted = <T extends Record<string, unknown>>(where: T) => ({
  ...where,
  ...ONLY_DELETED,
});

/**
 * I campi da scrivere per spostare una riga nel cestino.
 * `now` e' un parametro e non `new Date()` interno cosi' che, cestinando piu'
 * righe insieme, portino tutte lo stesso istante: e' quello che permette alla
 * pagina Cestino di raggrupparle come un'unica azione invece di sgranarle.
 */
export const markTrashed = (actorUserId: string, now: Date = new Date()) => ({
  deletedAt: now,
  deletedByUserId: actorUserId,
});

/** I campi da scrivere per riportare indietro una riga dal cestino. */
export const markRestored = () => ({
  deletedAt: null,
  deletedByUserId: null,
});

/** Vero se la riga letta risulta cestinata. */
export const isTrashed = (record: { deletedAt: Date | null } | null | undefined) =>
  Boolean(record?.deletedAt);
