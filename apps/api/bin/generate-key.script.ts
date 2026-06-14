import { generateEncryptionKey } from 'src/_lib/utils';

console.log('\n🔐 Encryption Key Generator\n');
console.log('Add this to your .env file:\n');
console.log(`ENCRYPTION_KEY="${generateEncryptionKey()}"\n`);
console.log('⚠️  Keep this key secret and never commit it!');
console.log('⚠️  If you lose this key, you cannot decrypt existing data!\n');
