import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { initSwagger } from '../src/lib/swagger.config';

async function generateOpenAPISpec() {
  console.log('Generating OpenAPI specification...');

  const app = await NestFactory.create(AppModule, {
    logger: ['error'],
  });

  const document = initSwagger(app);

  const outputPath = join(__dirname, '../../../@generated/openapi.json');
  const outputDir = dirname(outputPath);

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  writeFileSync(outputPath, JSON.stringify(document, null, 2));

  console.log(`✓ OpenAPI spec generated at: ${outputPath}`);

  await app.close();
}

generateOpenAPISpec().catch((err: unknown) => {
  console.error('Error generating OpenAPI spec:', err);
  process.exit(1);
});
