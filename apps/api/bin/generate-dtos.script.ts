import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import prettier from 'prettier';

dayjs.extend(timezone);

const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss [GMT]:Z');

const apiSrcDir = join(__dirname, '../src');
const rootGeneratedDir = join(__dirname, '../../../@generated/zod');
const schemasOutput = join(rootGeneratedDir, 'pfd-schemas.ts');
const dtosOutput = join(__dirname, '../src/@generated/zod/pfd-dtos.ts');

type SchemaInfo = {
  name: string;
  importPath: string;
  sourceFilePath: string;
};

function findSchemaFiles(
  dir: string,
  schemas: SchemaInfo[] = [],
): SchemaInfo[] {
  const entries = readdirSync(dir);

  return entries.flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      return ['node_modules', 'dist', '@generated', '.git'].includes(entry)
        ? []
        : findSchemaFiles(fullPath, schemas);
    }

    if (!entry.endsWith('.schema.ts')) {
      return [];
    }

    const content = readFileSync(fullPath, 'utf-8');
    const schemaMatches = Array.from(
      content.matchAll(/export const (\w+)Schema\s*=/g),
    );

    return schemaMatches.map((match) => {
      const schemaName = match[1];

      let relativeFromSchemas = relative(rootGeneratedDir, fullPath)
        .replace(/\.ts$/, '')
        .replace(/\\/g, '/');

      if (!relativeFromSchemas.startsWith('.')) {
        relativeFromSchemas = './' + relativeFromSchemas;
      }

      const dtosDir = dirname(dtosOutput);
      let relativeFromDtos = relative(dtosDir, fullPath)
        .replace(/\.ts$/, '')
        .replace(/\\/g, '/');
      if (!relativeFromDtos.startsWith('.')) {
        relativeFromDtos = './' + relativeFromDtos;
      }

      return {
        name: schemaName,
        importPath: relativeFromSchemas,
        sourceFilePath: fullPath,
      };
    });
  });
}

async function generateSchemas(schemas: SchemaInfo[]) {
  console.log('📝 Generating root schemas file...');

  // Ensure directory exists
  if (!existsSync(rootGeneratedDir)) {
    mkdirSync(rootGeneratedDir, { recursive: true });
  }

  let output = `// Auto-generated Zod schemas - do not edit manually
// Generated on ${timestamp}
// Run 'bun run dtos:generate' to regenerate

`;

  // Group imports by file
  const importsByPath = new Map<string, string[]>();

  schemas.forEach(({ name, importPath }) => {
    if (!importsByPath.has(importPath)) {
      importsByPath.set(importPath, []);
    }
    importsByPath.get(importPath)!.push(`${name}Schema`);
  });

  // Generate re-exports
  importsByPath.forEach((schemaNames, importPath) => {
    output += `export { ${schemaNames.join(', ')} } from '${importPath}';\n`;
  });

  const prettierConfig = (await prettier.resolveConfig(schemasOutput)) || {};
  const formattedOutput = await prettier.format(output, {
    ...prettierConfig,
    parser: 'typescript',
  });

  writeFileSync(schemasOutput, formattedOutput);

  console.log(
    `✓ Generated schemas at: ${relative(process.cwd(), schemasOutput)}`,
  );
}

async function generateDtos(schemas: SchemaInfo[]) {
  console.log('📝 Generating DTOs file...');

  // Ensure directory exists
  const outputDir = dirname(dtosOutput);

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Calculate relative path from DTOs file to root schemas
  const dtosDir = dirname(dtosOutput);
  let schemasImportPath = relative(dtosDir, schemasOutput)
    .replace(/\.ts$/, '')
    .replace(/\\/g, '/');

  if (!schemasImportPath.startsWith('.')) {
    schemasImportPath = './' + schemasImportPath;
  }

  let output = `// Auto-generated DTOs - do not edit manually
// Generated on ${timestamp}
// Run 'bun run dtos:generate' to regenerate

import { createZodDto } from 'nestjs-zod';

`;

  // Import all schemas from the root schemas file
  const allSchemaNames = schemas.map(({ name }) => `${name}Schema`);
  output += `// Schema imports from root @generated\n`;
  output += `import {\n  ${allSchemaNames.join(',\n  ')}\n} from '${schemasImportPath}';\n\n`;
  output += '// Generated DTOs\n';

  // Generate DTOs
  schemas.forEach(({ name }) => {
    output += `export class ${name}Dto extends createZodDto(${name}Schema) {}\n`;
  });

  const prettierConfig = await prettier.resolveConfig(dtosOutput);
  const formattedOutput = await prettier.format(output, {
    ...prettierConfig,
    filepath: dtosOutput,
  });

  writeFileSync(dtosOutput, formattedOutput);

  console.log(`✓ Generated DTOs at: ${relative(process.cwd(), dtosOutput)}`);
  console.log(`  - ${schemas.length} DTO class(es)`);
}

async function generateAll() {
  console.log('🔍 Scanning for schema files...');
  const schemas = findSchemaFiles(apiSrcDir);

  if (schemas.length === 0) {
    console.log('⚠️  No schemas found');
    return;
  }

  console.log(`✓ Found ${schemas.length} schema(s):`);

  schemas.forEach(({ name, importPath }) => {
    console.log(`  - ${name}Schema from ${importPath}`);
  });

  await generateSchemas(schemas);
  await generateDtos(schemas);

  console.log('\n✅ Generation complete!');
}

generateAll().catch((error: unknown) => {
  console.error('❌ Error during generation:', error);
  process.exit(1);
});
