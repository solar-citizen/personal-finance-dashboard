import { defineConfig } from '@openapi-codegen/cli';
import {
  generateFetchers,
  generateReactQueryComponents,
  generateSchemaTypes,
} from '@openapi-codegen/typescript';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

export default defineConfig({
  pfd: {
    from: {
      source: 'file',
      relativePath: '../../_generated/openapi.json',
    },
    outputDir: 'src/_generated/api',
    to: async context => {
      const filenamePrefix = 'pfd';

      const { schemasFiles } = await generateSchemaTypes(context, {
        filenamePrefix,
        filenameCase: 'kebab',
        formatFilename: filename => {
          /**
           * The filename comes as "pfd--schemas" (without extension)
           * Replace "--schemas" with "-types"
           */
          return filename.replace('--schemas', '-types');
        },
      });

      await generateFetchers(context, {
        filenamePrefix,
        schemasFiles,
        filenameCase: 'kebab',
      });

      await generateReactQueryComponents(context, {
        filenamePrefix,
        schemasFiles,
        filenameCase: 'kebab',
      });
    },
  },
});
