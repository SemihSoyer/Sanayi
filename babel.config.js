module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Diğer Babel eklentileriniz varsa buraya eklenebilir.
      // ÖNEMLİ: react-native-reanimated/plugin her zaman en sonda olmalıdır.
      'react-native-reanimated/plugin',
    ],
  };
};
