-- Units become a reference table instead of free text on the item.
--
-- Free text let "each", "Each", "EACH" and "ea" coexist as four different
-- units, and let anything at all be typed. A foreign key makes those variants
-- unrepresentable rather than merely discouraged, and matches how categories
-- already work.
--
-- items.unitId is added NOT NULL with no default, so this migration only
-- applies cleanly to an empty items table. Both databases were reset and
-- reseeded when it was introduced.

-- AlterTable
ALTER TABLE `items` DROP COLUMN `unitOfMeasure`,
    ADD COLUMN `unitId` INTEGER NOT NULL;

-- CreateTable
CREATE TABLE `units` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(32) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `units_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `items_unitId_idx` ON `items`(`unitId`);

-- AddForeignKey
ALTER TABLE `items` ADD CONSTRAINT `items_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

