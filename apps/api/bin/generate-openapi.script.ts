import { NestFactory } from '@nestjs/core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { AppModule } from '../src/app.module';
import { initSwagger } from '../src/lib/swagger.config';

async function generateOpenAPISpec() {
  console.log('Generating OpenAPI specification...');

  const app = await NestFactory.create(AppModule, {
    logger: false, // Disable logging for cleaner output
  });

  const document = initSwagger(app);

  const outputPath = join(__dirname, '../../../../@generated/openapi.json');
  const outputDir = dirname(outputPath);

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  writeFileSync(outputPath, JSON.stringify(document, null, 2));

  console.log(`✓ OpenAPI spec generated at: ${outputPath}`);

  await app.close();
}

generateOpenAPISpec().catch((error: unknown) => {
  console.error('Error generating OpenAPI spec:', error);
  process.exit(1);
});
