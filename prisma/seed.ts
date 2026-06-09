import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const CATALOG: Array<{
  id: string;
  name: string;
  services: Array<{ id: string; name: string; icon?: string }>;
  configOptions: Record<string, string[]>;
}> = [
  {
    id: 'wheel-services',
    name: 'Wheel Services',
    services: [
      { id: 'tire-rotation', name: 'Tire Rotation' },
      { id: 'tire-replacement', name: 'Tire Replacement' },
      { id: 'wheel-alignment', name: 'Wheel Alignment' },
    ],
    configOptions: {
      tireBrands: ['Michelin', 'Bridgestone', 'Goodyear', 'Pirelli'],
    },
  },
  {
    id: 'oil-services',
    name: 'Oil Services',
    services: [
      { id: 'oil-change', name: 'Oil Change' },
      { id: 'oil-filter', name: 'Oil Filter Replacement' },
    ],
    configOptions: {
      oilTypes: ['Synthetic', 'Semi-Synthetic', 'Mineral'],
    },
  },
  {
    id: 'body-paint',
    name: 'Body & Paint',
    services: [
      { id: 'dent-repair', name: 'Dent Repair' },
      { id: 'full-paint', name: 'Full Paint Job' },
    ],
    configOptions: {},
  },
];

async function main() {
  for (const cat of CATALOG) {
    await prisma.serviceCategory.upsert({
      where: { id: cat.id },
      update: { name: cat.name },
      create: { id: cat.id, name: cat.name },
    });

    for (const svc of cat.services) {
      await prisma.service.upsert({
        where: { id: svc.id },
        update: { name: svc.name, categoryId: cat.id, icon: svc.icon ?? null },
        create: {
          id: svc.id,
          name: svc.name,
          categoryId: cat.id,
          icon: svc.icon ?? null,
        },
      });
    }

    for (const [configKey, values] of Object.entries(cat.configOptions)) {
      for (const value of values) {
        await prisma.serviceConfigOption.upsert({
          where: {
            categoryId_configKey_value: {
              categoryId: cat.id,
              configKey,
              value,
            },
          },
          update: {},
          create: { categoryId: cat.id, configKey, value },
        });
      }
    }
  }
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
