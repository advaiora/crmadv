-- Autorizza la «Prova connessione» della pagina «Server di posta» a raggiungere
-- un indirizzo della rete interna dell'agenzia.
--
-- Serve a chiudere il punto 7 di §7.7 in `decisioni-cliente-e-menu-2026-08-07.md`:
-- host e porta della prova li sceglie chi preme il pulsante, quindi senza un
-- controllo il pulsante e' una scansione della rete interna con un oracolo che
-- risponde. Bloccare e basta pero' romperebbe un caso legittimo — un'agenzia il
-- cui server di posta sta davvero dentro la propria rete — e questa colonna e'
-- l'interruttore che glielo lascia dichiarare.
--
-- ⚠️ `DEFAULT false` vale anche per le righe gia' salvate, ed e' voluto: se il
-- default fosse `true` la migrazione lascerebbe aperta proprio la
-- configurazione che c'e' gia', cioe' tutte.
--
-- Accendere l'interruttore e' una dichiarazione, non una scorciatoia: finisce
-- nei metadati di `mail.save` nel registro attivita', con data e autore. Chi puo'
-- fare il danno resta lo stesso di prima — cambia che si vede.

-- AlterTable
ALTER TABLE "public"."MailServerSettings" ADD COLUMN     "retePrivataConsentita" BOOLEAN NOT NULL DEFAULT false;
