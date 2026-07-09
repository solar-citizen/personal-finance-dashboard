// @ts-check
import pluginJsxA11y from 'eslint-plugin-jsx-a11y';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
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
      // @ts-expect-error - plugin has ESM/CJS compatibility issue with flat config types
      react: pluginReact,
      // @ts-expect-error - plugin has ESM/CJS compatibility issue with flat config types
      'react-hooks': pluginReactHooks,
      'jsx-a11y': pluginJsxA11y,
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

      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      'no-unused-vars': 'off',
      'react/jsx-no-bind': [
        'error',
        {
          allowArrowFunctions: true,
        },
      ],
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
