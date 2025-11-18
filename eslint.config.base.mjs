import eslint from '@eslint/js';
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
    plugins: {
      '@typescript-eslint/eslint-plugin': tsEslint,
    },
    rules: {
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
    },
  },
);
