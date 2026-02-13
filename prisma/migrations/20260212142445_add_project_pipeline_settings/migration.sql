/*
  Warnings:

  - You are about to alter the column `color` on the `PipelineStage` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.

*/
-- AlterTable
ALTER TABLE "public"."PipelineStage" ALTER COLUMN "color" SET DATA TYPE VARCHAR(20);
