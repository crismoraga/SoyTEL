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
    // Las fuentes web (.woff2) se cargan como recursos, igual que las imágenes.
    files: ['src/theme/fontAssets.web.ts'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    // Los mocks de Jest se declaran con require() dentro de jest.mock.
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
]);
