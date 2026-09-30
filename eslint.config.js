// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', '.vercel/*'],
  },
  {
    // Scripts de Node (CommonJS) para exportar diseño, servir la web y compilar.
    files: ['scripts/**/*.js', 'server/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { __dirname: 'readonly', __filename: 'readonly', require: 'readonly', module: 'writable', process: 'readonly', console: 'readonly' },
    },
  },
  {
    // Los mocks de Jest se declaran con require() dentro de jest.mock.
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
]);
