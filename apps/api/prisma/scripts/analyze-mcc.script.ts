import { formatAmount } from 'src/lib/utils/currency.util';

import { prisma } from '../client';

type MccStats = {
  mcc: number;
  count: number;
  totalAmount: string;
  descriptions: string[];
};

/**
 * Step 1: Analyze all transactions with "Інше" category
 * This will show you which MCCs are most common in uncategorized transactions
 */
async function analyzeMissingCategories() {
  console.log('🔍 Analyzing transactions with missing categories...\n');

  const otherCategory = await prisma.category.findUnique({
    where: { mcc: 0 },
    select: { id: true },
  });

  if (!otherCategory) {
    console.log('❌ "Інше" category not found');
    return;
  }

  // Get all transactions with "Інше" category
  const transactions = await prisma.transaction.findMany({
    where: { categoryId: otherCategory.id },
    select: {
      mcc: true,
      description: true,
      amount: true,
    },
  });

  console.log(`📊 Found ${transactions.length} uncategorized transactions\n`);

  const mccMap = new Map<number, MccStats>();

  for (const { mcc, amount, description } of transactions) {
    if (!mccMap.has(mcc)) {
      mccMap.set(mcc, {
        mcc,
        count: 0,
        totalAmount: '0',
        descriptions: [],
      });
    }

    const stats = mccMap.get(mcc);

    if (!stats) {
      throw new Error(`Couldn't find stats for mcc: ${mcc}`);
    }

    stats.count++;
    stats.totalAmount = (BigInt(stats.totalAmount) + amount).toString();

    // Add unique descriptions (up to 5)
    if (
      stats.descriptions.length < 5 &&
      !stats.descriptions.includes(description)
    ) {
      stats.descriptions.push(description);
    }
  }

  // Sort by count (most common first)
  const sortedMccs = [...mccMap.values()].sort((a, b) => b.count - a.count);

  console.log('📈 Top MCCs without categories:\n');
  console.log('MCC    | Count | Total Amount (₴) | Sample Descriptions');
  console.log('-'.repeat(80));

  for (const stat of sortedMccs) {
    const amount = formatAmount(stat.totalAmount);
    const descriptions = stat.descriptions.join(', ');

    console.log(
      `${stat.mcc.toString().padEnd(6)} | ${stat.count.toString().padEnd(5)} | ${amount.padEnd(16)} | ${descriptions}`,
    );
  }

  console.log('\n💡 Use these MCCs to research and add new categories!');
  console.log(
    '   Search MCC codes at: https://www.citibank.com/tts/solutions/commercial-cards/assets/docs/govt/Merchant-Category-Codes.pdf or check in "/docs" folder',
  );

  return sortedMccs;
}

/**
 * Step 2: Add new categories to your seed data
 * After researching, update your categories array like this:
 *
 * const newCategories = [
 *   { name: 'Страхування', mcc: 6300, icon: '🛡️', color: '#8b5cf6' },
 *   { name: 'Готелі', mcc: 7011, icon: '🏨', color: '#ec4899' },
 *   // ... add more
 * ];
 */

/**
 * Step 3: Update existing transactions with new categories
 * Run this after adding new categories to the database
 */
async function updateTransactionCategories() {
  console.log('🔄 Updating transaction categories...\n');

  // Get all categories except "Інше"
  const categories = await prisma.category.findMany({
    where: { mcc: { not: 0 } },
    select: { id: true, mcc: true, name: true },
  });

  console.log(`📦 Found ${categories.length} categories to process\n`);

  let totalUpdated = 0;

  for (const category of categories) {
    // Update all transactions with this MCC that don't have a category yet
    const result = await prisma.transaction.updateMany({
      where: {
        mcc: category.mcc,
        OR: [
          { categoryId: null },
          {
            category: {
              mcc: 0, // "Інше" category
            },
          },
        ],
      },
      data: {
        categoryId: category.id,
      },
    });

    if (result.count > 0) {
      console.log(
        `✅ ${category.name} (MCC ${category.mcc}): Updated ${result.count} transactions`,
      );
      totalUpdated += result.count;
    }
  }

  console.log(`\n🎉 Total updated: ${totalUpdated} transactions`);
}

/**
 * Step 4: Verify results
 */
async function verifyResults() {
  console.log('\n📊 Verification Report:\n');

  const otherCategory = await prisma.category.findUnique({
    where: { mcc: 0 },
    select: { id: true },
  });

  const uncategorizedCount = await prisma.transaction.count({
    where: { categoryId: otherCategory?.id },
  });

  console.log(`Remaining uncategorized transactions: ${uncategorizedCount}`);

  // Show distribution by category
  const distribution = await prisma.transaction.groupBy({
    by: ['categoryId'],
    _count: true,
  });

  const categoriesWithCounts = await Promise.all(
    distribution.map(async (item) => {
      const category = await prisma.category.findUnique({
        where: { id: item.categoryId ?? undefined },
        select: { name: true },
      });

      return {
        category: category?.name ?? 'Unknown',
        count: item._count,
      };
    }),
  );

  console.log('\n📈 Transaction distribution by category:\n');
  categoriesWithCounts
    .sort((a, b) => b.count - a.count)
    .forEach(({ category, count }) => {
      console.log(`${category.padEnd(20)}: ${count}`);
    });
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'analyze':
      await analyzeMissingCategories();
      break;

    case 'update':
      await updateTransactionCategories();
      await verifyResults();
      break;

    case 'verify':
      await verifyResults();
      break;

    default:
      console.log('Usage:');
      console.log(
        '  npm run mcc analyze  - Analyze uncategorized transactions',
      );
      console.log(
        '  npm run mcc update   - Update transactions with new categories',
      );
      console.log('  npm run mcc verify   - Verify categorization results');
      console.log('\nWorkflow:');
      console.log('  1. Run "analyze" to see which MCCs need categories');
      console.log('  2. Research MCCs and add new categories to seed.ts');
      console.log('  3. Run "npm run seed" to add new categories to database');
      console.log('  4. Run "update" to categorize existing transactions');
      console.log('  5. Run "verify" to check results');
  }
}

main()
  .catch((err: unknown) => {
    console.error('❌ Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
