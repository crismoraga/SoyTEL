// Config plugin: firma los builds de release de Android con la llave de SoyTEL.
// Las credenciales NO viven en el repositorio: se leen de ~/.gradle/gradle.properties
// (SOYTEL_UPLOAD_STORE_FILE, SOYTEL_UPLOAD_STORE_PASSWORD, SOYTEL_UPLOAD_KEY_ALIAS, SOYTEL_UPLOAD_KEY_PASSWORD).
// Si faltan, Gradle usa la firma de depuración para no romper builds locales.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// soytel-release-signing';

function addSigning(gradle) {
  if (gradle.includes(MARKER)) return gradle;
  const releaseConfig = `
        release { ${MARKER}
            if (project.hasProperty('SOYTEL_UPLOAD_STORE_FILE')) {
                storeFile file(SOYTEL_UPLOAD_STORE_FILE)
                storePassword SOYTEL_UPLOAD_STORE_PASSWORD
                keyAlias SOYTEL_UPLOAD_KEY_ALIAS
                keyPassword SOYTEL_UPLOAD_KEY_PASSWORD
            }
        }`;
  let next = gradle.replace(/signingConfigs\s*\{/, (match) => `${match}${releaseConfig}`);
  // En buildTypes.release, cambia la firma de depuración por la de release cuando existe la llave.
  next = next.replace(
    /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/,
    `$1signingConfig project.hasProperty('SOYTEL_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`,
  );
  return next;
}

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = addSigning(mod.modResults.contents);
    return mod;
  });
};
