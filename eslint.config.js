import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // The rules engine must be deterministic (GDD §11.8): no ambient randomness or clocks.
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use state.rng (engine/src/rng.ts).' },
        { object: 'Date', property: 'now', message: 'The engine must not read the clock.' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'performance', message: 'The engine must not read the clock.' },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "NewExpression[callee.name='Date']", message: 'The engine must not read the clock.' },
      ],
    },
  },
);
