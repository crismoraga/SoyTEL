jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// El mock oficial de worklets 0.10 permite ejecutar Reanimated 4.5 fuera del runtime nativo.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
