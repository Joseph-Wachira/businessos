import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'] },
  js.configs.recommended,
  {
    files: ['backend/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Tenant-resource services (products, sales, inventory, ...) must accept
    // a Prisma client from their controller (req.context.db, scoped via
    // forTenant()) instead of importing the raw singleton, so a missing
    // business_id filter is impossible to write rather than easy to forget.
    // auth/users/businesses are exempted below: they legitimately need
    // unscoped access (bootstrapping a session/business before any tenant
    // context exists, or a user's own cross-business "my businesses" list).
    files: ['backend/src/modules/**/*.service.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/db/prisma.js'],
              message:
                'Import the scoped client via req.context.db instead. If this module genuinely needs the raw client (bootstrap or cross-tenant-by-design queries, like auth/users/businesses do), add its path to the exemption block in eslint.config.js.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'backend/src/modules/auth/**/*.service.js',
      'backend/src/modules/users/**/*.service.js',
      'backend/src/modules/businesses/**/*.service.js',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['frontend/**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      // Plain JS project, no prop-types package or TypeScript — nothing
      // else here declares prop shapes either.
      'react/prop-types': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
    settings: { react: { version: 'detect' } },
  },
];
