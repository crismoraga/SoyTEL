module.exports = function (api) {
  api.cache(true);

  // babel-preset-expo agrega automáticamente el plugin de react-native-worklets/Reanimated.
  return {
    presets: ['babel-preset-expo'],
  };
};
