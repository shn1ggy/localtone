import globals from 'globals';
export default [
  { ignores: ['node_modules/**', 'dist/**', 'Localtone-data/**', 'local-data/**', 'test/**'] },
  {
    files: [
      '*.cjs',
      '*.mjs',
      'src/**/*.cjs',
      'src/**/*.mjs',
      'scripts/**/*.cjs',
      'scripts/**/*.mjs',
      'app/**/*.js',
      'build/**/*.cjs',
      'build/**/*.mjs',
    ],
    languageOptions: { ecmaVersion: 'latest', globals: { ...globals.browser, ...globals.node } },
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
      'no-unreachable': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-undef': 'error',
    },
  },
];
