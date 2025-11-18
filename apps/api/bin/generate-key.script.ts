import { randomBytes } from 'crypto';

function generateEncryptionKey(): string {
  return randomBytes(32).toString('base64');
}

console.log('\n🔐 Encryption Key Generator\n');
console.log('Add this to your .env file:\n');
console.log(`ENCRYPTION_KEY="${generateEncryptionKey()}"\n`);
console.log('⚠️  Keep this key secret and never commit it!');
console.log('⚠️  If you lose this key, you cannot decrypt existing data!\n');
