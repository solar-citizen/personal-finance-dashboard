import { prisma } from 'prisma/client';
import { encrypt } from '../../src/lib/utils/encryption.util';

async function main() {
  console.log('🔐 Starting token encryption migration...\n');

  const accounts = await prisma.account.findMany({
    where: {
      monoToken: {
        not: null,
      },
    },
  });

  console.log(`Found ${accounts.length} accounts with tokens\n`);

  let encrypted = 0;
  let skipped = 0;

  for (const account of accounts) {
    try {
      if (account.monoToken && account.monoToken.includes(':')) {
        console.log(`Account ${account.id} - already encrypted`);
        skipped++;

        continue;
      }

      if (!account.monoToken) {
        continue;
      }

      const encryptedToken = encrypt(account.monoToken);

      await prisma.account.update({
        where: { id: account.id },
        data: { monoToken: encryptedToken },
      });

      console.log(`✅ Account ${account.id} - token encrypted`);
      encrypted++;
    } catch (error) {
      console.error(`❌ Account ${account.id} - error:`, error);
    }
  }

  console.log('\n📊 Migration Summary:');
  console.log(`   Encrypted: ${encrypted}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total: ${accounts.length}\n`);
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
