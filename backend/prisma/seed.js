/**
 * Seeds the reference data the app needs to be demonstrable: users of both
 * roles, locations, categories, items and staff assignments.
 *
 * Stock movements go through recordMovement(), the same service the API uses, so
 * the demo data obeys exactly the same rules as anything a user records. Nothing
 * is inserted straight into the ledger.
 */
import bcrypt from 'bcryptjs';

import { prisma } from '../src/lib/prisma.js';
import { recordMovement } from '../src/modules/movements/movements.service.js';

// Meets the strength rules in users.schemas.js: length, upper, lower,
// number and symbol. Published in SUBMISSION.md, so it is meant to be typed.
const PASSWORD = 'Inventory@2026';

const USERS = [
  { email: 'manager@demo.test', name: 'Priya Raman', role: 'MANAGER' },
  { email: 'manager2@demo.test', name: 'Daniel Okafor', role: 'MANAGER' },
  { email: 'staff@demo.test', name: 'Sam Whitfield', role: 'STAFF' },
  { email: 'staff2@demo.test', name: 'Lena Moretti', role: 'STAFF' },
  { email: 'staff3@demo.test', name: 'Arjun Bhatt', role: 'STAFF' },
];

const LOCATIONS = [
  { code: 'WH-MAIN', name: 'Main Warehouse' },
  { code: 'RT-NORTH', name: 'North Retail Floor' },
  { code: 'RT-SOUTH', name: 'South Retail Floor' },
  { code: 'SITE-A', name: 'Project Site A' },
];

const CATEGORIES = ['Fasteners', 'Power Tools', 'Safety Gear', 'Electrical', 'Consumables'];

// The units items can be stocked in. A maintained list, like categories, so
// "each", "Each" and "ea" cannot become three different units.
const UNITS = ['each', 'box', 'pack', 'roll', 'can', 'metre'];

// [sku, name, category, unit, reorderLevel, description]
const ITEMS = [
  ['FST-1001', 'M8 Hex Bolt 40mm', 'Fasteners', 'box', 25, 'Zinc-plated, 100 per box.'],
  ['FST-1002', 'M8 Nylon Lock Nut', 'Fasteners', 'box', 20, 'Nyloc, 200 per box.'],
  ['FST-1003', 'Wood Screw 4x50mm', 'Fasteners', 'box', 30, 'Countersunk pozi, 200 per box.'],
  ['PWR-2001', '18V Cordless Drill', 'Power Tools', 'each', 6, 'Brushless, body only.'],
  ['PWR-2002', '18V Battery 5Ah', 'Power Tools', 'each', 10, 'Fits all 18V platform tools.'],
  ['PWR-2003', '230mm Angle Grinder', 'Power Tools', 'each', 4, 'Corded, 2200W.'],
  ['SAF-3001', 'Safety Helmet White', 'Safety Gear', 'each', 15, 'EN 397, vented.'],
  ['SAF-3002', 'Nitrile Gloves L', 'Safety Gear', 'box', 40, 'Powder-free, 100 per box.'],
  ['SAF-3003', 'Hi-Vis Vest XL', 'Safety Gear', 'each', 20, 'Class 2, orange.'],
  ['ELE-4001', '2.5mm Twin & Earth Cable', 'Electrical', 'metre', 200, 'Grey PVC, 100m drum.'],
  ['ELE-4002', '13A Socket Double', 'Electrical', 'each', 25, 'White moulded, switched.'],
  ['ELE-4003', 'MCB 32A Type B', 'Electrical', 'each', 12, 'Single pole, 6kA.'],
  ['CON-5001', 'Duct Tape 50mm', 'Consumables', 'roll', 30, 'Silver cloth, 50m.'],
  ['CON-5002', 'Expanding Foam 750ml', 'Consumables', 'can', 18, 'Gun grade, B2 fire rated.'],
  ['CON-5003', 'Cable Ties 200mm', 'Consumables', 'pack', 25, 'Black UV stable, 100 per pack.'],
];

// Which locations each staff member covers. Managers act everywhere and are
// deliberately given no rows here — that is the point of the role split.
const ASSIGNMENTS = {
  'staff@demo.test': ['WH-MAIN', 'RT-NORTH'],
  'staff2@demo.test': ['RT-SOUTH'],
  'staff3@demo.test': ['WH-MAIN', 'SITE-A', 'RT-NORTH'],
};

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const users = {};
  for (const u of USERS) {
    users[u.email] = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role },
      create: { ...u, passwordHash },
    });
  }
  console.log(`users:      ${Object.keys(users).length}`);

  const locations = {};
  for (const l of LOCATIONS) {
    locations[l.code] = await prisma.location.upsert({
      where: { code: l.code },
      update: { name: l.name },
      create: l,
    });
  }
  console.log(`locations:  ${Object.keys(locations).length}`);

  const categories = {};
  for (const name of CATEGORIES) {
    categories[name] = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`categories: ${Object.keys(categories).length}`);

  const units = {};
  for (const code of UNITS) {
    units[code] = await prisma.unit.upsert({ where: { code }, update: {}, create: { code } });
  }
  console.log(`units:      ${Object.keys(units).length}`);

  const manager = users['manager@demo.test'];

  for (const [sku, name, category, unit, reorderLevel, description] of ITEMS) {
    const data = {
      name,
      description,
      unitId: units[unit].id,
      reorderLevel,
      categoryId: categories[category].id,
      createdById: manager.id,
    };
    const item = await prisma.item.upsert({
      where: { sku },
      update: data,
      create: { sku, ...data },
    });
    // Timeline starts at creation (goal 9). Only write it on a genuinely new
    // item so re-running the seed cannot duplicate history.
    const hasHistory = await prisma.itemEvent.count({ where: { itemId: item.id } });
    if (!hasHistory) {
      await prisma.itemEvent.create({
        data: { itemId: item.id, type: 'CREATED', actorId: manager.id, newValue: sku },
      });
    }
  }
  console.log(`items:      ${ITEMS.length}`);

  let assignmentCount = 0;
  for (const [email, codes] of Object.entries(ASSIGNMENTS)) {
    for (const code of codes) {
      await prisma.locationAssignment.upsert({
        where: { userId_locationId: { userId: users[email].id, locationId: locations[code].id } },
        update: {},
        create: {
          userId: users[email].id,
          locationId: locations[code].id,
          assignedById: manager.id,
        },
      });
      assignmentCount += 1;
    }
  }
  console.log(`assignments:${assignmentCount}`);

  await seedMovements(users, locations);

  console.log(`\nAll demo accounts use password: ${PASSWORD}`);
}

// ---------------------------------------------------------------------------
// Stock movements: roughly eight weeks of trading, so the dashboard charts and
// the low-stock alerts have something real to show.
// ---------------------------------------------------------------------------

/** Seeded random number generator, so every run produces the same demo data. */
function makeRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(9 + (days % 8), 30, 0, 0);
  return date;
}

// How each item should look by the end, so the demo has healthy stock, items
// sitting on the reorder line, and one that has run out entirely.
const STOCK_PROFILE = {
  'FST-1003': 'low',
  'PWR-2002': 'low',
  'SAF-3003': 'low',
  'ELE-4003': 'empty',
  'CON-5002': 'low',
};

async function seedMovements(users, locations) {
  if ((await prisma.stockMovement.count()) > 0) {
    console.log('movements:  already present, skipping');
    return;
  }

  const random = makeRandom(20260911);
  const randomInt = (min, max) => min + Math.floor(random() * (max - min + 1));

  const manager = actorFor(users['manager@demo.test'], []);
  // Staff, with the locations the assignment step above gave them. The seed is
  // held to the same access rules as the API, so a movement is attributed to a
  // staff member only where they are actually assigned, and to a manager
  // otherwise.
  const staffMembers = [
    actorFor(users['staff@demo.test'], [locations['WH-MAIN'].id, locations['RT-NORTH'].id]),
    actorFor(users['staff2@demo.test'], [locations['RT-SOUTH'].id]),
    actorFor(users['staff3@demo.test'], [locations['WH-MAIN'].id, locations['SITE-A'].id, locations['RT-NORTH'].id]),
  ];
  const whoWorksAt = (locationId) => {
    const covering = staffMembers.filter((member) => member.locationIds.includes(locationId));
    return covering.length > 0 ? covering[randomInt(0, covering.length - 1)] : manager;
  };

  const main = locations['WH-MAIN'].id;
  const retail = [locations['RT-NORTH'].id, locations['RT-SOUTH'].id];
  const items = await prisma.item.findMany({ orderBy: { id: 'asc' } });

  let movementCount = 0;
  const record = async (input, actor) => {
    await recordMovement(input, actor);
    movementCount += 1;
  };

  for (const item of items) {
    const profile = STOCK_PROFILE[item.sku] ?? 'healthy';
    const base = Math.max(item.reorderLevel, 5);
    // Local copy of this item's balances, so we never try to issue more than
    // the ledger holds and get rejected by our own rules.
    const onHand = {};

    const opening = base * (profile === 'healthy' ? 6 : 2);
    await record({ itemId: item.id, kind: 'RECEIPT', quantity: opening, locationId: main, occurredAt: daysAgo(56) }, manager);
    onHand[main] = opening;

    // Push some of it out to the shop floors.
    for (const destination of retail) {
      const quantity = Math.max(1, Math.round(opening * 0.2));
      if (onHand[main] < quantity) continue;
      await record({ itemId: item.id, kind: 'TRANSFER', quantity, sourceLocationId: main, destinationLocationId: destination, occurredAt: daysAgo(randomInt(48, 54)) }, manager);
      onHand[main] -= quantity;
      onHand[destination] = (onHand[destination] ?? 0) + quantity;
    }

    // Eight weeks of selling, a couple of movements a week.
    for (let week = 7; week >= 0; week -= 1) {
      for (let n = 0; n < randomInt(1, 3); n += 1) {
        const day = week * 7 + randomInt(0, 6);
        if (day < 0) continue;

        const stocked = Object.keys(onHand).filter((id) => onHand[id] > 1);
        if (stocked.length === 0) break;
        const locationId = Number(stocked[randomInt(0, stocked.length - 1)]);

        const quantity = Math.max(1, Math.min(onHand[locationId], randomInt(1, Math.ceil(base * 0.4))));
        await record({ itemId: item.id, kind: 'ISSUE', quantity, locationId, occurredAt: daysAgo(day) }, whoWorksAt(locationId));
        onHand[locationId] -= quantity;
      }

      // Occasional restock into the warehouse.
      if (profile === 'healthy' && random() < 0.25) {
        const quantity = randomInt(base, base * 2);
        await record({ itemId: item.id, kind: 'RECEIPT', quantity, locationId: main, occurredAt: daysAgo(week * 7 + 3) }, whoWorksAt(main));
        onHand[main] = (onHand[main] ?? 0) + quantity;
      }
    }

    // Drive the deliberately-low items down to where the alerts will fire.
    const target =
      profile === 'empty' ? 0
      : profile === 'low' ? Math.max(1, item.reorderLevel - randomInt(0, 2))
      : null;

    if (target !== null) {
      const total = () => Object.values(onHand).reduce((sum, value) => sum + value, 0);

      // Too much left: issue the excess away, location by location.
      for (const [id, quantity] of Object.entries(onHand)) {
        const excess = Math.min(quantity, total() - target);
        if (excess <= 0) continue;
        await record({ itemId: item.id, kind: 'ISSUE', quantity: excess, locationId: Number(id), occurredAt: daysAgo(randomInt(0, 3)) }, whoWorksAt(Number(id)));
        onHand[id] -= excess;
      }

      // Too little left: a small delivery brings it back onto the reorder line,
      // which is a more interesting demo than an item sitting flat at zero.
      const shortfall = target - total();
      if (shortfall > 0) {
        await record({ itemId: item.id, kind: 'RECEIPT', quantity: shortfall, locationId: main, occurredAt: daysAgo(randomInt(1, 4)) }, whoWorksAt(main));
        onHand[main] = (onHand[main] ?? 0) + shortfall;
      }
    }
  }

  // A couple of adjustments, so the demo shows counts being corrected.
  const [first, second] = items;
  const firstStock = await prisma.stockMovementLine.aggregate({ where: { itemId: first.id, locationId: main }, _sum: { quantityDelta: true } });
  if ((firstStock._sum.quantityDelta ?? 0) >= 2) {
    await record({ itemId: first.id, kind: 'ADJUSTMENT', quantity: -2, locationId: main, reason: 'Cycle count: two boxes damaged in transit', occurredAt: daysAgo(2) }, manager);
  }
  await record({ itemId: second.id, kind: 'ADJUSTMENT', quantity: 3, locationId: main, reason: 'Cycle count: pallet found behind racking', occurredAt: daysAgo(1) }, manager);

  console.log(`movements:  ${movementCount}`);
}

/** recordMovement expects the shape requireAuth builds, so mirror it here. */
function actorFor(user, locationIds) {
  return { id: user.id, role: user.role, locationIds };
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
