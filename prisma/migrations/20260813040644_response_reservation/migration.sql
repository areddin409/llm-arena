-- AlterEnum
ALTER TYPE "ResponseStatus" ADD VALUE 'STREAMING';

-- AlterTable
ALTER TABLE "ModelResponse" ADD COLUMN     "startedAt" TIMESTAMP(3);
