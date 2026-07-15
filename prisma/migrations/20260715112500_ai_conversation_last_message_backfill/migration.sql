-- Backfill di AiConversation.lastMessageAt, aggiunto (vuoto) dalla migrazione
-- 20260715112041_ai_conversation_sessions. Il campo ordina l'elenco delle sessioni:
-- senza questo riempimento le conversazioni gia' esistenti comparirebbero in fondo
-- e senza data. Additiva e idempotente: tocca solo le righe ancora a NULL.
UPDATE "public"."AiConversation" AS c
SET "lastMessageAt" = m."lastAt"
FROM (
  SELECT "conversationId", MAX("createdAt") AS "lastAt"
  FROM "public"."AiConversationMessage"
  GROUP BY "conversationId"
) AS m
WHERE m."conversationId" = c."id"
  AND c."lastMessageAt" IS NULL;

-- Conversazioni senza alcun messaggio (aperte e mai usate): si ripiega sulla data
-- di creazione, cosi' nessuna sessione resta senza data nell'elenco.
UPDATE "public"."AiConversation"
SET "lastMessageAt" = "createdAt"
WHERE "lastMessageAt" IS NULL;
