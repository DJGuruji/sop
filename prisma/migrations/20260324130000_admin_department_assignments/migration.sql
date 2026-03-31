CREATE TABLE "UserDepartmentAssignment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserDepartmentAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserDepartmentAssignment_userId_departmentId_key"
  ON "UserDepartmentAssignment"("userId", "departmentId");

CREATE INDEX "UserDepartmentAssignment_departmentId_idx"
  ON "UserDepartmentAssignment"("departmentId");

ALTER TABLE "UserDepartmentAssignment"
  ADD CONSTRAINT "UserDepartmentAssignment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserDepartmentAssignment"
  ADD CONSTRAINT "UserDepartmentAssignment_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
