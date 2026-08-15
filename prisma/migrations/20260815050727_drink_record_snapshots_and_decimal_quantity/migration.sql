/*
  Warnings:

  - You are about to drop the column `volumeMl` on the `DrinkRecord` table. All the data in the column will be lost.
  - You are about to alter the column `quantity` on the `DrinkRecord` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(6,2)`.
  - Added the required column `volumeMlSnapshot` to the `DrinkRecord` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DrinkRecord" DROP COLUMN "volumeMl",
ADD COLUMN     "alcoholPercentSnapshot" DECIMAL(4,2),
ADD COLUMN     "volumeMlSnapshot" INTEGER NOT NULL,
ALTER COLUMN "quantity" SET DEFAULT 1,
ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(6,2);
