/*
  Warnings:

  - You are about to alter the column `color` on the `PipelineStage` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.

*/
-- AlterTable
-- NOTE: the "color" column is only added in a later migration (20260212170000),
-- so ensure it exists here for this migration to apply cleanly to a fresh database.
ALTER TABLE "public"."PipelineStage" ADD COLUMN IF NOT EXISTS "color" TEXT;
ALTER TABLE "public"."PipelineStage" ALTER COLUMN "color" SET DATA TYPE VARCHAR(20);
