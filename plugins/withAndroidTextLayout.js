// Desde Android 15 (apps con targetSdk 35 o más) un TextView calcula su ancho con el borde real de
// los glifos (useBoundsForWidth). React Native mide el texto con el avance de cada letra, así que
// algunas etiquetas que calzaban justas al medir perdían su última palabra al dibujarse
// ("Visitar a Rutix" se veía "Visitar a"). Este plugin deja el cálculo clásico en el estilo por
// defecto de los TextView de la app, para que medir y dibujar usen la misma regla.
const { AndroidConfig, withAndroidStyles } = require('expo/config-plugins');

const STYLE_NAME = 'SoyTelTextView';

module.exports = function withAndroidTextLayout(config) {
  return withAndroidStyles(config, (mod) => {
    const resources = mod.modResults.resources;
    resources.style = resources.style ?? [];
    if (!resources.style.some((style) => style.$.name === STYLE_NAME)) {
      resources.style.push({
        $: { name: STYLE_NAME, parent: 'Widget.AppCompat.TextView' },
        item: [
          { $: { name: 'android:useBoundsForWidth' }, _: 'false' },
          { $: { name: 'android:shiftDrawingOffsetForStartOverhang' }, _: 'false' },
        ],
      });
    }
    mod.modResults = AndroidConfig.Styles.assignStylesValue(mod.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: 'android:textViewStyle',
      value: `@style/${STYLE_NAME}`,
    });
    return mod;
  });
};
