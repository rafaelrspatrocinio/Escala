-- AlterTable
ALTER TABLE "User" ADD COLUMN     "availableWeekdays" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[];
