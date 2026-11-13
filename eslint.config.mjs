import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '_bmad/**', '_bmad-output/**', '.claude/**', '.wrangler/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['backend/**/*.ts', 'shared/**/*.ts', 'scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['frontend/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Regla de seguridad del proyecto: el frontend nunca habla con la IA directamente.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@anthropic-ai/*', 'openai', 'dotenv'], message: 'Prohibido en el frontend: la IA y los secretos viven solo en Express.' },
          ],
        },
      ],
    },
  },
  {
    files: ['backend/src/**/*.ts'],
    ignores: ['backend/src/logger.ts'],
    rules: { 'no-console': 'error' },
  },
);
