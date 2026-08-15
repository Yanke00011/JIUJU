-- AlterEnum
ALTER TYPE "RoomStatus" ADD VALUE 'ENDING';

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "finalizedAt" TIMESTAMPTZ(3);
