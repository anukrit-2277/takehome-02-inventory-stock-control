/**
 * Seeds the reference data the app needs to be demonstrable: users of both
 * roles, locations, categories, items and staff assignments.
 *
 * Stock movements are deliberately NOT seeded here. They are written in a later
 * phase through the same ledger service the API uses, so demo data is subject
 * to exactly the same validation and balance rules as anything a user records.
 */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PASSWORD = 'Passw0rd!';

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

  const manager = users['manager@demo.test'];

  for (const [sku, name, category, unitOfMeasure, reorderLevel, description] of ITEMS) {
    const data = {
      name,
      description,
      unitOfMeasure,
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

  console.log(`\nAll demo accounts use password: ${PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
