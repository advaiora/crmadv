-- CreateTable
CREATE TABLE "public"."AiConversationAttachmentBinary" (
    "attachmentId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiConversationAttachmentBinary_pkey" PRIMARY KEY ("attachmentId")
);

-- AddForeignKey
ALTER TABLE "public"."AiConversationAttachmentBinary" ADD CONSTRAINT "AiConversationAttachmentBinary_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "public"."AiConversationAttachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
