// Compila el APK de producción firmado (release) para Android.
// Requisitos: Android SDK + JDK 17 y la llave en ~/.gradle/gradle.properties (ver README).
// Uso: npm run android:release   →   dist/android/SoyTEL-<versión>.apk
const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkgFile = path.join(root, 'package.json');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
const architectures = process.env.ANDROID_ARCHS || 'arm64-v8a,armeabi-v7a';

function run(command, cwd) {
  console.log(`\n> ${command}`);
  execSync(command, { cwd, stdio: 'inherit', env: { ...process.env, CI: '1', NODE_ENV: 'production' } });
}

// 1. Proyecto nativo limpio (prebuild reescribe los scripts de package.json: se restauran).
const pkgBefore = fs.readFileSync(pkgFile, 'utf8');
try {
  run('npx expo prebuild -p android --clean --no-install', root);
} finally {
  fs.writeFileSync(pkgFile, pkgBefore);
}

// 2. En Windows, una letra de unidad corta evita rutas de más de 260 caracteres en CMake/Ninja.
let buildRoot = root;
let drive = null;
if (process.platform === 'win32') {
  for (const letter of ['S', 'T', 'U', 'V', 'W']) {
    try {
      execSync(`subst ${letter}: "${root}"`, { stdio: 'ignore' });
      drive = `${letter}:`;
      buildRoot = `${drive}\\`;
      break;
    } catch {
      // Letra ocupada: probar la siguiente.
    }
  }
}

try {
  const gradlew = process.platform === 'win32' ? `"${path.join(buildRoot, 'android', 'gradlew.bat')}"` : './gradlew';
  run(`${gradlew} assembleRelease -PreactNativeArchitectures=${architectures} --no-daemon`, path.join(buildRoot, 'android'));
} finally {
  if (drive) execSync(`subst ${drive} /D`, { stdio: 'ignore' });
}

// 3. Copia y huella del APK.
const apk = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const outDir = path.join(root, 'dist', 'android');
fs.mkdirSync(outDir, { recursive: true });
const target = path.join(outDir, `SoyTEL-${app.version}.apk`);
fs.copyFileSync(apk, target);
const hash = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
console.log(`\nAPK listo: ${target}\nTamaño: ${(fs.statSync(target).size / 1048576).toFixed(1)} MB\nSHA-256: ${hash}`);
