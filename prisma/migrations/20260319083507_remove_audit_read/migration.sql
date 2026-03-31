/*
  Warnings:

  - The values [READ] on the enum `AuditAction` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AuditAction_new" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'SOFT_DELETE', 'RESTORE', 'SUBMIT_FOR_APPROVAL', 'APPROVE', 'REJECT', 'ESCALATE', 'PUBLISH', 'UNPUBLISH', 'LOGIN', 'LOGOUT');
ALTER TABLE "AuditLog" ALTER COLUMN "action" TYPE "AuditAction_new" USING ("action"::text::"AuditAction_new");
ALTER TYPE "AuditAction" RENAME TO "AuditAction_old";
ALTER TYPE "AuditAction_new" RENAME TO "AuditAction";
DROP TYPE "public"."AuditAction_old";
COMMIT;
