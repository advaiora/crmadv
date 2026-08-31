-- I token del «password dimenticata»: una riga per ogni link di
-- reimpostazione inviato via email. Prima di questa migrazione il CRM non
-- aveva nessun posto dove conservarli, quindi il recupero password non poteva
-- esistere (decisioni-cliente-e-menu-2026-08-07.md §7.10 punto 7).
--
-- La forma e' quella gia' collaudata di TeamInvite: a database finisce solo
-- l'impronta del token ("tokenHash"), mai il valore in chiaro che viaggia
-- nell'email. Chi legge il database non puo' quindi rientrare nell'account di
-- nessuno.
--
-- Monouso: "usedAt" si valorizza al primo consumo, e da quel momento il link
-- non vale piu' anche se non e' ancora scaduto. Scadenza breve: "expiresAt",
-- deciso dal codice che genera il token, non dal database.
--
-- "requestIp" serve solo a limitare gli abusi (quante richieste dallo stesso
-- indirizzo) ed e' facoltativo.
--
-- La tabella nasce vuota e nessun'altra tabella viene toccata: il vincolo di
-- chiave esterna sta su PasswordResetToken, non su User. Cancellando un utente
-- spariscono i suoi token (ON DELETE CASCADE).

-- CreateTable
CREATE TABLE "public"."PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "requestIp" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "public"."PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "public"."PasswordResetToken"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "public"."PasswordResetToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "public"."PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

