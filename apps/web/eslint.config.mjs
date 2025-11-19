import pluginImport from 'eslint-plugin-import';
import pluginJsxA11y from 'eslint-plugin-jsx-a11y';
import pluginPromise from 'eslint-plugin-promise';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginSimpleImportSort from 'eslint-plugin-simple-import-sort';
import { defineConfig, globalIgnores } from 'eslint/config';
import baseConfig from '../../eslint.config.base.mjs';

const eslintConfig = defineConfig(
  [...baseConfig, globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts'])],
  {
    settings: {
      react: { version: 'detect' },
    },
  },
  {
    plugins: {
      react: pluginReact,
      import: pluginImport,
      promise: pluginPromise,
      'react-hooks': pluginReactHooks,
      'jsx-a11y': pluginJsxA11y,
      'simple-import-sort': pluginSimpleImportSort,
    },
  },
  {
    rules: {
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/jsx-curly-brace-presence': [
        'error',
        {
          props: 'always',
          children: 'always',
        },
      ],

      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-duplicates': 'error',
      'import/max-dependencies': ['warn', { max: 10, ignoreTypeImports: true }],

      '@typescript-eslint/no-unused-vars': 'error',
      'no-unused-vars': 'off',
    },
  },
  {
    files: ['src/app/**/*', 'app/**/*'],
    rules: {
      'import/no-default-export': 'off',
    },
  },
);

export default eslintConfig;
