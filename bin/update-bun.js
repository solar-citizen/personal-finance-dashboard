import { readFileSync, writeFileSync } from 'node:fs';

const packageJsonPath = './package.json';

process.stdout.write('🔄 Upgrading Bun to latest stable version...\n');
await Bun.$`bun upgrade`;

const newVersion = (await Bun.$`bun --version`.text()).trim();
process.stdout.write(`✅ Bun upgraded to version ${newVersion}\n`);

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
packageJson.packageManager = `bun@${newVersion}`;

writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
process.stdout.write(`📦 package.json updated with bun@${newVersion}\n`);
