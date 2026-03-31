-- AlterTable
ALTER TABLE "ApprovalRequest" ADD COLUMN "deptApprovedAt" TIMESTAMP(3),
ADD COLUMN "deptApprovedById" TEXT;

-- CreateIndex
CREATE INDEX "ApprovalRequest_deptApprovedById_idx" ON "ApprovalRequest"("deptApprovedById");

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_deptApprovedById_fkey" FOREIGN KEY ("deptApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
