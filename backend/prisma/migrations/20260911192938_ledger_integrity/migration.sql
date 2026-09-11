-- DropForeignKey
ALTER TABLE `stock_movement_lines` DROP FOREIGN KEY `stock_movement_lines_movementId_fkey`;

-- DropForeignKey
ALTER TABLE `stock_movements` DROP FOREIGN KEY `stock_movements_destinationLocationId_fkey`;

-- DropForeignKey
ALTER TABLE `stock_movements` DROP FOREIGN KEY `stock_movements_locationId_fkey`;

-- DropForeignKey
ALTER TABLE `stock_movements` DROP FOREIGN KEY `stock_movements_sourceLocationId_fkey`;

-- CreateIndex
CREATE UNIQUE INDEX `stock_movements_id_item_occurred_key` ON `stock_movements`(`id`, `itemId`, `occurredAt`);

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_sourceLocationId_fkey` FOREIGN KEY (`sourceLocationId`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_destinationLocationId_fkey` FOREIGN KEY (`destinationLocationId`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `stock_movement_lines` ADD CONSTRAINT `stock_movement_lines_movementId_itemId_occurredAt_fkey` FOREIGN KEY (`movementId`, `itemId`, `occurredAt`) REFERENCES `stock_movements`(`id`, `itemId`, `occurredAt`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Everything below is hand-written. Prisma cannot model CHECK constraints or
-- triggers, so these are the rules we want the DATABASE to guarantee rather
-- than trusting every present and future code path to remember them.
-- ---------------------------------------------------------------------------

-- Movement shape. A transfer has a source and a destination and no single
-- location; every other kind has a single location and neither of the other
-- two. A transfer into its own source location is meaningless, so it is
-- rejected here as well.
ALTER TABLE `stock_movements` ADD CONSTRAINT `chk_movement_shape` CHECK (
  (`kind` = 'TRANSFER'
     AND `locationId` IS NULL
     AND `sourceLocationId` IS NOT NULL
     AND `destinationLocationId` IS NOT NULL
     AND `sourceLocationId` <> `destinationLocationId`)
  OR
  (`kind` <> 'TRANSFER'
     AND `locationId` IS NOT NULL
     AND `sourceLocationId` IS NULL
     AND `destinationLocationId` IS NULL)
);

-- A zero-quantity movement records nothing.
ALTER TABLE `stock_movements` ADD CONSTRAINT `chk_movement_quantity_nonzero`
  CHECK (`quantity` <> 0);

-- Receipts, issues and transfers carry a magnitude. Only an adjustment may be
-- negative, because only an adjustment can correct a count downwards.
ALTER TABLE `stock_movements` ADD CONSTRAINT `chk_movement_positive_unless_adjustment`
  CHECK (`kind` = 'ADJUSTMENT' OR `quantity` > 0);

-- Goal 4: every adjustment must carry a reason. Enforced here as well as in the
-- service, so no import path, migration script or console session can slip one
-- through unexplained.
ALTER TABLE `stock_movements` ADD CONSTRAINT `chk_movement_adjustment_reason`
  CHECK (`kind` <> 'ADJUSTMENT' OR (`reason` IS NOT NULL AND CHAR_LENGTH(TRIM(`reason`)) > 0));

-- A ledger line that moves nothing is noise.
ALTER TABLE `stock_movement_lines` ADD CONSTRAINT `chk_line_delta_nonzero`
  CHECK (`quantityDelta` <> 0);

ALTER TABLE `items` ADD CONSTRAINT `chk_item_reorder_level_nonnegative`
  CHECK (`reorderLevel` >= 0);

-- ---------------------------------------------------------------------------
-- Append-only enforcement.
--
-- Goals 4 and 9 say the ledger and the item timeline can never be changed or
-- removed, "including by managers". Omitting the UPDATE and DELETE endpoints is
-- necessary but not sufficient: it holds only for as long as nobody adds one.
-- These triggers make the rule a property of the tables themselves, so a stray
-- prisma.update(), a data-fix script or someone at a mysql prompt fails exactly
-- the way an API call would.
-- ---------------------------------------------------------------------------

CREATE TRIGGER `trg_stock_movements_no_update` BEFORE UPDATE ON `stock_movements`
  FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'stock_movements is append-only: rows cannot be updated';

CREATE TRIGGER `trg_stock_movements_no_delete` BEFORE DELETE ON `stock_movements`
  FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'stock_movements is append-only: rows cannot be deleted';

CREATE TRIGGER `trg_stock_movement_lines_no_update` BEFORE UPDATE ON `stock_movement_lines`
  FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'stock_movement_lines is append-only: rows cannot be updated';

CREATE TRIGGER `trg_stock_movement_lines_no_delete` BEFORE DELETE ON `stock_movement_lines`
  FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'stock_movement_lines is append-only: rows cannot be deleted';

CREATE TRIGGER `trg_item_events_no_update` BEFORE UPDATE ON `item_events`
  FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'item_events is append-only: rows cannot be updated';

CREATE TRIGGER `trg_item_events_no_delete` BEFORE DELETE ON `item_events`
  FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'item_events is append-only: rows cannot be deleted';
