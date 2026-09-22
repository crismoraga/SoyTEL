jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const MockIcon = (props: Record<string, unknown>) => React.createElement('Icon', props);
  return { Ionicons: MockIcon };
});
