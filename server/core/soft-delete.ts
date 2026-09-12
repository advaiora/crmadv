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
 * Il filtro da mettere sulle letture dei FIGLI, quando il legame col padre e'
 * **obbligatorio** (la colonna non puo' essere nulla).
 *
 * E' la regola 2 di questo file messa in codice: un figlio si nasconde
 * guardando il padre. Un preventivo il cui cliente e' nel cestino sparisce
 * dall'elenco dei preventivi — non perche' qualcuno gli abbia scritto addosso
 * una seconda data, ma perche' la lettura dei preventivi filtra sul cliente.
 *
 * Si usa cosi':
 *   where: { workspaceId, ...parentNotDeleted('client') }
 *
 * ⚠️ Non serve — ed e' anzi sbagliato — toccare il `select` del join: su una
 * relazione obbligatoria Prisma restituisce sempre il padre, quindi l'unico
 * punto dove il figlio puo' sparire e' la `where` della query che lo legge.
 */
export const parentNotDeleted = <K extends string>(relation: K) => (
  { [relation]: NOT_DELETED } as { [P in K]: typeof NOT_DELETED }
);

/**
 * Come `parentNotDeleted`, ma quando il legame col padre e' **facoltativo**.
 *
 * La differenza non e' un dettaglio: su una relazione che ammette il nulla,
 * `{ client: { deletedAt: null } }` da solo butta fuori anche le righe **senza
 * cliente**, che col cestino non c'entrano niente (un progetto interno, un
 * asset non ancora assegnato). Servono due casi, ed e' per questo che questa
 * funzione vuole sia il nome della relazione sia quello della colonna.
 *
 * Esce sotto `AND` di proposito: quasi tutte le liste del CRM usano gia' un
 * `OR` per la ricerca testuale, e due `OR` sulla stessa `where` si sovra-
 * scrivono a vicenda in silenzio — un filtro che sparisce senza dare errore e'
 * esattamente il guasto che il Cestino non si puo' permettere.
 *
 * Si usa cosi':
 *   where: { workspaceId, ...optionalParentNotDeleted('client', 'clientId') }
 */
export const optionalParentNotDeleted = <R extends string, F extends string>(
  relation: R,
  foreignKey: F,
) => (
  {
    AND: [
      {
        OR: [
          { [foreignKey]: null },
          { [relation]: NOT_DELETED },
        ],
      },
    ],
  } as {
    AND: [{ OR: [{ [P in F]: null }, { [P in R]: typeof NOT_DELETED }] }];
  }
);

/**
 * I campi da scrivere per spostare una riga nel cestino.
 * `now` e' un parametro e non `new Date()` interno cosi' che, cestinando piu'
 * righe insieme, portino tutte lo stesso istante: e' quello che permette alla
 * pagina Cestino di raggrupparle come un'unica azione invece di sgranarle.
 *
 * ⚠️ **Il Cestino non aggira `onDelete: Restrict`, e non ne ha bisogno**
 * (decisione di CRMA-127, che il compito chiedeva di prendere e di scrivere).
 *
 * `Quote.client` e' vincolato `Restrict` (`prisma/schema.prisma` :1648): oggi un
 * cliente con preventivi non si puo' cancellare, e il database si rifiuta di
 * farlo. Il Cestino non cambia quel vincolo e non lo scavalca, per un motivo
 * meccanico prima che di prodotto: **cestinare e' una UPDATE**, scrive due
 * colonne e non cancella nessuna riga, quindi `Restrict` non entra nemmeno in
 * gioco. Ne segue la regola in due righe:
 *
 *   - **cestinare un cliente con preventivi: si'.** Il cliente sparisce da tutte
 *     le letture — compresi i suoi preventivi, che si nascondono guardando il
 *     padre (`parentNotDeleted('client')`) — e si puo' ripristinare intatto.
 *   - **eliminarlo per davvero: no**, finche' ha preventivi. Quella e' una DELETE
 *     vera, `Restrict` scatta e il database la rifiuta. Chi implementa
 *     `trash.purge` deve aspettarselo e dirlo a chi usa il CRM con un messaggio
 *     comprensibile («questo cliente ha N preventivi»), non con un errore del
 *     database: e' l'unico punto dove il vincolo si vede ancora.
 *
 * Il vincolo resta dov'e' apposta. Toglierlo per far funzionare la cancellazione
 * definitiva vorrebbe dire che eliminare un cliente porta via anche lo storico
 * dei suoi preventivi, che sono documenti contabili.
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
