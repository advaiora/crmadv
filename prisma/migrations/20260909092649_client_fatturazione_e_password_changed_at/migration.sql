-- Le DUE modifiche di schema della release di settembre, in una migrazione sola.
--
-- Stanno insieme non perche' siano parenti — non lo sono — ma perche' CLAUDE.md
-- vieta di tenere una migrazione su un ramo lungo: due rami con due migrazioni
-- si uniscono e il database non sa piu' in che ordine applicarle. E' il debito
-- appena chiuso con l'unione dei nove rami, e non lo si riapre il giorno dopo.
-- Quindi: una migrazione, un ramo corto, unita a `main` appena e' verde.
--
-- 1. `User.passwordChangedAt` — serve al recupero password (punto 2).
--    Oggi `server/modules/password/password.service.ts` dichiara che al cambio
--    password le sessioni gia' aperte restano valide, perche' il JWT e' senza
--    stato, dura 7 giorni e non c'e' nessun campo su cui appoggiare la revoca.
--    Questa colonna e' quel campo. Resta `NULL` per tutti gli utenti esistenti,
--    ed e' voluto: `NULL` vuol dire «mai cambiata da quando la colonna esiste»,
--    cioe' nessun token da invalidare. Riempirla con `now()` alla migrazione
--    avrebbe buttato fuori dal CRM tutti quelli collegati in quel momento.
--
-- 2. Quattro colonne su `Client` — servono all'anagrafica di fatturazione
--    (punto 5). `pecEmail` e `sdiCode` sono i due recapiti della fatturazione
--    elettronica: un cliente che non ha ne' l'uno ne' l'altro e' un cliente a
--    cui non si puo' fatturare. `website` e `contactPerson` completano la
--    scheda. Tutte e quattro nascono nullable, senza default: le righe gia' in
--    tabella non sanno niente di questi campi e non c'e' nessun valore che
--    sarebbe piu' vero di «non lo so».
--
-- La migrazione e' interamente additiva: nessun DROP, nessun NOT NULL, nessun
-- vincolo nuovo. Applicarla non puo' far fallire il codice gia' in produzione.

-- AlterTable
ALTER TABLE "public"."Client" ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "pecEmail" TEXT,
ADD COLUMN     "sdiCode" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);
