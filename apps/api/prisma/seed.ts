import { hash } from 'bcrypt';
import { prisma } from './client';

const adminName = process.env.SEED_ADMIN_NAME;
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
const adminEmail = process.env.SEED_ADMIN_EMAIL;

const categories = [
  { name: 'Продукти', mcc: 5411, icon: '🛒', color: '#10b981' },
  { name: 'Ресторани', mcc: 5812, icon: '🍽️', color: '#f59e0b' },
  { name: 'Кафе', mcc: 5814, icon: '☕', color: '#f97316' },
  { name: 'Транспорт', mcc: 4111, icon: '🚇', color: '#3b82f6' },
  { name: 'Таксі', mcc: 4121, icon: '🚕', color: '#06b6d4' },
  { name: 'АЗС', mcc: 5541, icon: '⛽', color: '#6366f1' },
  { name: 'Аптеки', mcc: 5912, icon: '💊', color: '#ef4444' },
  { name: 'Медицина', mcc: 8011, icon: '🏥', color: '#dc2626' },
  { name: 'Розваги', mcc: 7997, icon: '🎬', color: '#ec4899' },
  { name: 'Спорт', mcc: 5941, icon: '⚽', color: '#8b5cf6' },
  { name: 'Одяг', mcc: 5691, icon: '👕', color: '#a855f7' },
  { name: 'Електроніка', mcc: 5732, icon: '💻', color: '#6366f1' },
  { name: 'Комунальні', mcc: 4900, icon: '🏠', color: '#14b8a6' },
  { name: "Зв'язок", mcc: 4814, icon: '📱', color: '#06b6d4' },
  { name: 'Освіта', mcc: 8211, icon: '📚', color: '#0ea5e9' },
  { name: 'Перекази', mcc: 6012, icon: '💸', color: '#64748b' },
  { name: 'Готівка', mcc: 6010, icon: '💵', color: '#84cc16' },
  { name: 'Інше', mcc: 0, icon: '❓', color: '#94a3b8' },
];

async function main() {
  console.log('🌱 Seeding database...');
  console.log('📦 Creating categories...');

  for (const category of categories) {
    await prisma.category.upsert({
      where: { mcc: category.mcc },
      update: {},
      create: category,
    });
  }

  console.log(`✅ Created ${categories.length} categories`);
  console.log('👤 Creating admin user...');

  if (!adminPassword) {
    throw new Error('SEED_ADMIN_PASSWORD env variable is missing.');
  }

  const passwordHash = await hash(adminPassword, 10);

  if (!adminEmail) {
    throw new Error('SEED_ADMIN_EMAIL env variable is missing.');
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
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
