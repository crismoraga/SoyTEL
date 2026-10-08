// Config plugin: firma los builds de release de Android con la llave de SoyTEL.
//
// Las credenciales NO viven en el repositorio: se leen de ~/.gradle/gradle.properties
// (SOYTEL_UPLOAD_STORE_FILE, SOYTEL_UPLOAD_STORE_PASSWORD, SOYTEL_UPLOAD_KEY_ALIAS, SOYTEL_UPLOAD_KEY_PASSWORD).
//
// Falla cerrado: si falta (o está vacía) cualquiera de las cuatro, un build de release se detiene con
// un mensaje claro en vez de salir firmado con la llave de depuración. La única excepción es pedirlo
// de forma explícita con -PsoytelAllowDebugSigning=true (lo hace `npm run android:test-apk`, que además
// nombra el archivo como APK de prueba).
//
// Si la plantilla de Gradle de Expo cambia y alguno de los tres puntos de inserción no calza
// exactamente una vez, el plugin falla en el prebuild: nunca deja pasar un build sin la protección.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// soytel-release-signing';
const KEYS = ['SOYTEL_UPLOAD_STORE_FILE', 'SOYTEL_UPLOAD_STORE_PASSWORD', 'SOYTEL_UPLOAD_KEY_ALIAS', 'SOYTEL_UPLOAD_KEY_PASSWORD'];

const GUARD = `${MARKER}: la firma de release exige las cuatro propiedades SOYTEL_UPLOAD_*.
def soytelSigningKeys = [${KEYS.map((key) => `'${key}'`).join(', ')}]
def soytelMissingKeys = soytelSigningKeys.findAll { !project.hasProperty(it) || project.property(it).toString().trim().isEmpty() }
def soytelDebugSigningAllowed = (project.findProperty('soytelAllowDebugSigning') ?: 'false').toString() == 'true'
gradle.taskGraph.whenReady { graph ->
    def soytelReleaseTask = graph.allTasks.any { it.path.startsWith(project.path + ':') && it.name ==~ /(assemble|bundle|package|install).*Release.*/ }
    if (soytelReleaseTask && !soytelMissingKeys.isEmpty() && !soytelDebugSigningAllowed) {
        throw new GradleException("SoyTEL: la firma de release esta incompleta (falta: " + soytelMissingKeys.join(', ') + "). Define las cuatro propiedades SOYTEL_UPLOAD_* en ~/.gradle/gradle.properties. Para un APK de prueba firmado con la llave de depuracion usa: npm run android:test-apk")
    }
}

`;

const RELEASE_CONFIG = `
        release { ${MARKER}
            if (soytelMissingKeys.isEmpty()) {
                storeFile file(SOYTEL_UPLOAD_STORE_FILE)
                storePassword SOYTEL_UPLOAD_STORE_PASSWORD
                keyAlias SOYTEL_UPLOAD_KEY_ALIAS
                keyPassword SOYTEL_UPLOAD_KEY_PASSWORD
            }
        }`;

function replaceOnce(source, pattern, replacement, what) {
  const matches = source.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`));
  if (!matches || matches.length !== 1) {
    throw new Error(`withAndroidReleaseSigning: la plantilla de Gradle cambió (${what}: se esperaba 1 coincidencia y hay ${matches ? matches.length : 0}). Revisa el plugin antes de compilar.`);
  }
  return source.replace(pattern, replacement);
}

function addSigning(gradle) {
  if (gradle.includes(MARKER)) return gradle;
  let next = replaceOnce(gradle, /^android\s*\{/m, (match) => `${GUARD}${match}`, 'bloque android');
  next = replaceOnce(next, /signingConfigs\s*\{/, (match) => `${match}${RELEASE_CONFIG}`, 'bloque signingConfigs');
  // En buildTypes.release: la llave de release; la de depuración solo si se pidió de forma explícita
  // (sin las cuatro propiedades y sin ese permiso, el build ya se detuvo arriba).
  next = replaceOnce(
    next,
    /(buildTypes\s*\{[\s\S]*?\brelease\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/,
    '$1signingConfig soytelMissingKeys.isEmpty() ? signingConfigs.release : signingConfigs.debug',
    'firma de buildTypes.release',
  );
  return next;
}

function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = addSigning(mod.modResults.contents);
    return mod;
  });
}

module.exports = withAndroidReleaseSigning;
module.exports.addSigning = addSigning;
module.exports.SIGNING_KEYS = KEYS;
