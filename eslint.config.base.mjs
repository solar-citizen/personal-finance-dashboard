// @ts-check
import eslint from '@eslint/js';
import configPrettier from 'eslint-config-prettier';
import pluginImport from 'eslint-plugin-import';
import pluginPrettier from 'eslint-plugin-prettier';
import pluginPromise from 'eslint-plugin-promise';
import pluginSimpleImportSort from 'eslint-plugin-simple-import-sort';
import { defineConfig } from 'eslint/config';
import tsEslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/@generated/**',
      '**/eslint.config.mjs',
    ],
  },
  eslint.configs.recommended,
  ...tsEslint.configs.strictTypeChecked,
  ...tsEslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint/eslint-plugin': tsEslint,
      'simple-import-sort': pluginSimpleImportSort,
      // @ts-expect-error - plugin has ESM/CJS compatibility issue with flat config types
      promise: pluginPromise,
      import: pluginImport,
      prettier: pluginPrettier,
    },
    rules: {
      'max-len': ['warn', { code: 100 }],

      'prettier/prettier': 'error',

      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'function',
          format: ['PascalCase', 'camelCase'],
        },
        {
          selector: 'typeAlias',
          format: ['PascalCase'],
        },
      ],
      'no-duplicate-imports': 'error',
      'no-param-reassign': 'error',
      'object-shorthand': 'error',
      'require-await': 'error',
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      'padding-line-between-statements': [
        'warn',
        {
          blankLine: 'always',
          prev: ['block', 'block-like', 'multiline-block-like'],
          next: 'return',
        },
        { blankLine: 'always', prev: '*', next: 'if' },
        { blankLine: 'always', prev: '*', next: 'export' },
      ],

      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',

      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-duplicates': 'error',
      'import/max-dependencies': ['warn', { max: 15, ignoreTypeImports: true }],
    },
  },
  {
    files: ['**/*.script.ts', '**/prisma/seed.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  configPrettier,
);
