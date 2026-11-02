import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'dev-dist/', 'node_modules/', 'coverage/', 'playwright-report/', 'test-results/', '*.min.js', '.specify/', '.claude/', 'eslint.config.js', 'scripts/'] },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/cube/**', 'src/solver/**'],
    rules: {
      'no-restricted-globals': ['error', { name: 'window', message: 'Domain code must not touch the DOM.' }, { name: 'document', message: 'Domain code must not touch the DOM.' }],
    },
  },
);
