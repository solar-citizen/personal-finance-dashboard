import { hash } from 'bcrypt';

import { prisma } from './client';
import { mccCategories } from './lib/mcc-categories';

const adminName = process.env.SEED_ADMIN_NAME;
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
const adminEmail = process.env.SEED_ADMIN_EMAIL;

async function main() {
  console.log('🌱 Seeding database...');

  const nameCount = new Map<string, number>();

  mccCategories.forEach(({ name }) => {
    nameCount.set(name, (nameCount.get(name) ?? 0) + 1);
  });

  const duplicates = [...nameCount].filter(([, count]) => count > 1);

  if (duplicates.length > 0) {
    console.error('⚠️  Duplicate names found:');
    duplicates.forEach(([name, count]) => {
      console.log(`  - "${name}": ${count} times`);

      const mccs = mccCategories
        .filter((c) => c.name === name)
        .map(({ mcc }) => mcc);

      console.log(`    MCCs: ${mccs.join(', ')}`);
    });
  }

  console.log('📦 Creating categories...');

  await prisma.$transaction(
    mccCategories.map((category) =>
      prisma.category.upsert({
        where: { mcc: category.mcc },
        update: {
          name: category.name,
          icon: category.icon,
          color: category.color,
        },
        create: category,
      }),
    ),
  );

  console.log(`✅ Created ${mccCategories.length} mcc categories`);
  console.log('👤 Creating admin user...');

  if (!adminPassword) {
    throw new Error('SEED_ADMIN_PASSWORD env variable is missing.');
  }

  const passwordHash = await hash(adminPassword, 10);

  if (!adminEmail) {
    throw new Error('SEED_ADMIN_EMAIL env variable is missing.');
  }

  if (!adminName) {
    throw new Error('SEED_ADMIN_NAME env variable is missing.');
  }

  const { email } = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      name: adminName,
    },
  });

  console.log(`✅ Admin created: ${email} / password: ${adminPassword}`);
  console.log('🎉 Seeding completed!');
}

main()
  .catch((err: unknown) => {
    console.error('❌ Seeding error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
