-- I parametri del server di posta di un workspace, impostati dalla pagina
-- "Server di posta". Prima di questa migrazione stavano solo nel file .env,
-- quindi fuori dal CRM e fuori dalla portata di chi lo amministra.
--
-- Una riga per workspace, o nessuna: se non c'e' (o se "attivo" e' falso), il
-- CRM continua a leggere le variabili d'ambiente (server/core/mail.ts).
-- Nessun dato esistente si sposta: la tabella nasce vuota e le variabili
-- d'ambiente restano valide finche' qualcuno non configura dall'interfaccia.
--
-- La password non sta in chiaro: ciphertext/iv/authTag/keyVersion sono la busta
-- di cifratura AES-256-GCM gia' usata da Integration e AgencyRuntimeSetting.

-- CreateTable
CREATE TABLE "public"."MailServerSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "server" VARCHAR(255) NOT NULL,
    "porta" INTEGER NOT NULL DEFAULT 587,
    "connessioneSicura" BOOLEAN NOT NULL DEFAULT false,
    "utente" VARCHAR(255),
    "mittente" VARCHAR(255) NOT NULL,
    "ciphertext" TEXT,
    "iv" VARCHAR(255),
    "authTag" VARCHAR(255),
    "keyVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailServerSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MailServerSettings_workspaceId_key" ON "public"."MailServerSettings"("workspaceId");

-- AddForeignKey
ALTER TABLE "public"."MailServerSettings" ADD CONSTRAINT "MailServerSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
