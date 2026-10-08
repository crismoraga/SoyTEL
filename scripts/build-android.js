// Compila el APK de Android.
//
//   npm run android:release     APK de producción. Exige la llave de release (ver docs/PRODUCCION.md),
//                               pasa antes por `npm run check` y solo entrega el archivo si su
//                               certificado NO es el de depuración.
//   npm run android:test-apk    APK de prueba firmado con la llave de depuración, con otro nombre
//                               (SoyTEL-<versión>-prueba.apk). No es para publicar.
//
// Variables:
//   ANDROID_ARCHS               arquitecturas, separadas por coma (por defecto arm64-v8a,armeabi-v7a)
//   SOYTEL_UPLOAD_CERT_SHA256   huella SHA-256 esperada del certificado de release (si se define, debe calzar)
//
// Requisitos: Android SDK (ANDROID_HOME) y JDK 17.
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildEnv, describePublicConfig, publicConfigProblem } = require('./public-config');

const root = path.resolve(__dirname, '..');
const ALLOWED_ARCHS = ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'];

// Lista de arquitecturas válida o un error: nada que venga del entorno llega tal cual a un comando.
function parseArchitectures(raw) {
  const list = String(raw ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (list.length === 0) throw new Error(`ANDROID_ARCHS está vacío. Valores permitidos: ${ALLOWED_ARCHS.join(', ')}.`);
  const unknown = list.filter((item) => !ALLOWED_ARCHS.includes(item));
  if (unknown.length) throw new Error(`ANDROID_ARCHS tiene valores no permitidos (${unknown.map((item) => JSON.stringify(item)).join(', ')}). Permitidos: ${ALLOWED_ARCHS.join(', ')}.`);
  return [...new Set(list)];
}

// Lee la salida de `apksigner verify --print-certs`.
function parseCertificate(output) {
  const dn = /Signer #1 certificate DN:\s*(.+)/.exec(output);
  const sha = /Signer #1 certificate SHA-256 digest:\s*([0-9a-fA-F]+)/.exec(output);
  if (!dn || !sha) return null;
  return { dn: dn[1].trim(), sha256: sha[1].toLowerCase() };
}

function isDebugCertificate(certificate) {
  return /CN=Android Debug/i.test(certificate.dn);
}

function normalizeFingerprint(value) {
  return String(value ?? '')
    .replace(/[^0-9a-fA-F]/g, '')
    .toLowerCase();
}

// Motivo por el que el APK no se puede entregar con ese certificado (null si está bien).
function certificateProblem(certificate, { debugSigning, expectedSha256 }) {
  if (!certificate) return 'No se pudo leer el certificado del APK.';
  if (debugSigning) return isDebugCertificate(certificate) ? null : 'Se pidió un APK de prueba pero no quedó firmado con la llave de depuración.';
  if (isDebugCertificate(certificate)) return 'El APK quedó firmado con la llave de depuración: no es un APK de producción.';
  const expected = normalizeFingerprint(expectedSha256);
  if (expected && expected !== certificate.sha256) return 'El certificado del APK no es el esperado (SOYTEL_UPLOAD_CERT_SHA256).';
  return null;
}

function gradleArguments(architectures, debugSigning) {
  return ['assembleRelease', `-PreactNativeArchitectures=${architectures.join(',')}`, ...(debugSigning ? ['-PsoytelAllowDebugSigning=true'] : []), '--no-daemon'];
}

function run(file, args, cwd) {
  console.log(`\n> ${path.basename(file)} ${args.join(' ')}`);
  execFileSync(file, args, { cwd, stdio: 'inherit', env: buildEnv() });
}

// Cómo se lanza una herramienta que vive en `directory` (gradlew, apksigner). En Windows son archivos
// .bat y necesitan cmd.exe: se llaman desde su carpeta con la ruta explícita `.\`, porque un equipo con
// NoDefaultCurrentDirectoryInExePath no busca programas en la carpeta actual. Los argumentos ya están
// validados (arquitecturas de una lista cerrada, rutas propias), así que no hay texto libre.
function toolCommand(directory, name, args, platform = process.platform) {
  if (platform === 'win32') return { file: 'cmd.exe', args: ['/d', '/c', `.\\${name}`, ...args] };
  return { file: path.join(directory, name), args };
}

function runTool(directory, name, args, capture = false) {
  const command = toolCommand(directory, name, args);
  if (!capture) console.log(`\n> ${name} ${args.join(' ')}`);
  return execFileSync(command.file, command.args, { cwd: directory, stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit', env: buildEnv() });
}

function findApksigner() {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk');
  const tools = path.join(sdk, 'build-tools');
  if (!fs.existsSync(tools)) throw new Error('No se encontró el Android SDK (define ANDROID_HOME).');
  const versions = fs
    .readdirSync(tools)
    .filter((name) => /^\d+\.\d+\.\d+/.test(name))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  for (const version of versions) {
    const name = process.platform === 'win32' ? 'apksigner.bat' : 'apksigner';
    if (fs.existsSync(path.join(tools, version, name))) return { directory: path.join(tools, version), name };
  }
  throw new Error('No se encontró apksigner en build-tools del Android SDK.');
}

function gitState() {
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim().length > 0;
    return { commit, dirty };
  } catch {
    return { commit: null, dirty: null };
  }
}

function main() {
  const debugSigning = process.argv.includes('--debug-signing');
  const architectures = parseArchitectures(process.env.ANDROID_ARCHS || 'arm64-v8a,armeabi-v7a');
  const configProblem = publicConfigProblem();
  if (configProblem) throw new Error(configProblem);
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
  const before = gitState();

  // 0. Un APK de producción solo sale de un árbol que pasa las comprobaciones.
  if (!debugSigning) {
    if (before.dirty) throw new Error('Hay cambios sin confirmar: el APK de producción se compila desde un commit.');
    execFileSync(process.platform === 'win32' ? 'cmd.exe' : 'npm', process.platform === 'win32' ? ['/d', '/c', 'npm', 'run', 'check'] : ['run', 'check'], { cwd: root, stdio: 'inherit' });
  }

  // 1. Proyecto nativo limpio (prebuild reescribe los scripts de package.json: se restauran).
  const pkgFile = path.join(root, 'package.json');
  const pkgBefore = fs.readFileSync(pkgFile, 'utf8');
  try {
    run(process.execPath, [path.join(root, 'node_modules', 'expo', 'bin', 'cli'), 'prebuild', '-p', 'android', '--clean', '--no-install'], root);
  } finally {
    fs.writeFileSync(pkgFile, pkgBefore);
  }

  // 2. APK de release. La firma la pone el plugin withAndroidReleaseSigning, que detiene el build si falta la llave.
  const androidDir = path.join(root, 'android');
  runTool(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew', gradleArguments(architectures, debugSigning));

  // 3. El certificado se comprueba antes de entregar el archivo.
  const apk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
  const apksigner = findApksigner();
  const certificate = parseCertificate(runTool(apksigner.directory, apksigner.name, ['verify', '--print-certs', apk], true).toString());
  const problem = certificateProblem(certificate, { debugSigning, expectedSha256: process.env.SOYTEL_UPLOAD_CERT_SHA256 });
  if (problem) throw new Error(`${problem} No se generó el APK final.`);

  // 4. Copia, huella y de dónde salió.
  const outDir = path.join(root, 'dist', 'android');
  fs.mkdirSync(outDir, { recursive: true });
  const target = path.join(outDir, `SoyTEL-${app.version}${debugSigning ? '-prueba' : ''}.apk`);
  fs.copyFileSync(apk, target);
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
  const manifest = {
    file: path.basename(target),
    version: app.version,
    versionCode: app.android?.versionCode ?? null,
    signing: debugSigning ? 'depuración (APK de prueba, no publicar)' : 'release',
    certificateSha256: certificate.sha256,
    sha256,
    bytes: fs.statSync(target).size,
    architectures,
    commit: before.commit,
    dirty: before.dirty,
    node: process.version,
    builtAt: new Date().toISOString(),
    publicConfig: describePublicConfig(),
  };
  fs.writeFileSync(`${target}.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\nAPK listo: ${target}\nTamaño: ${(manifest.bytes / 1048576).toFixed(1)} MB\nSHA-256: ${sha256}\nCertificado (SHA-256): ${certificate.sha256}\nFirma: ${manifest.signing}`);
}

module.exports = { certificateProblem, gradleArguments, isDebugCertificate, parseArchitectures, parseCertificate, toolCommand };

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`\n✖ ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
