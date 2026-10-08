// Fuentes de la versión web: WOFF2 con solo los caracteres que la app puede mostrar (157 kB entre las
// siete, contra 1,4 MB de las TTF completas que usan Android e iOS). Se generan con
// `python scripts/build-web-fonts.py`; la compilación web comprueba que estén al día.
export const fontAssets = {
  Montserrat_600SemiBold: require('../../assets/fonts-web/Montserrat_600SemiBold.woff2'),
  Montserrat_700Bold: require('../../assets/fonts-web/Montserrat_700Bold.woff2'),
  Montserrat_800ExtraBold: require('../../assets/fonts-web/Montserrat_800ExtraBold.woff2'),
  NunitoSans_400Regular: require('../../assets/fonts-web/NunitoSans_400Regular.woff2'),
  NunitoSans_600SemiBold: require('../../assets/fonts-web/NunitoSans_600SemiBold.woff2'),
  NunitoSans_700Bold: require('../../assets/fonts-web/NunitoSans_700Bold.woff2'),
  NunitoSans_800ExtraBold: require('../../assets/fonts-web/NunitoSans_800ExtraBold.woff2'),
};
