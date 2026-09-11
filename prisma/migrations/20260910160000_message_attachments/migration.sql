-- Allegati ai messaggi interni (A1 punto 8a, CRMA-30).
--
-- Due tabelle: il record dell'allegato e i BYTE veri, separati di proposito - i
-- binari possono essere grandi e non devono caricarsi a ogni elenco. E' lo stesso
-- disegno gia' usato dalla Chat AI (AiConversationAttachment + ...Binary).
--
-- messageId NON e' nullable: niente allegati in bozza, quindi niente binari orfani.
-- Cancellato il messaggio, cade l'allegato; cancellato l'allegato, cadono i byte.

-- CreateTable
CREATE TABLE "public"."WorkspaceMessageAttachment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "label" VARCHAR(200) NOT NULL,
    "mimeType" VARCHAR(120) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkspaceMessageAttachmentBinary" (
    "attachmentId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMessageAttachmentBinary_pkey" PRIMARY KEY ("attachmentId")
);

-- CreateIndex
CREATE INDEX "WorkspaceMessageAttachment_messageId_idx" ON "public"."WorkspaceMessageAttachment"("messageId");

-- CreateIndex
CREATE INDEX "WorkspaceMessageAttachment_workspaceId_idx" ON "public"."WorkspaceMessageAttachment"("workspaceId");

-- AddForeignKey
ALTER TABLE "public"."WorkspaceMessageAttachment" ADD CONSTRAINT "WorkspaceMessageAttachment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkspaceMessageAttachment" ADD CONSTRAINT "WorkspaceMessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."WorkspaceMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkspaceMessageAttachment" ADD CONSTRAINT "WorkspaceMessageAttachment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkspaceMessageAttachmentBinary" ADD CONSTRAINT "WorkspaceMessageAttachmentBinary_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "public"."WorkspaceMessageAttachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

