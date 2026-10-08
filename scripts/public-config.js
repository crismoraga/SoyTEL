// Configuración pública de una compilación.
//
// Todo lo que empieza con EXPO_PUBLIC_ queda DENTRO de la web y del APK: cualquiera puede leerlo.
// Este módulo evita los dos errores posibles al compilar:
//   1. Poner ahí una credencial sin haberlo decidido (un usuario y clave de broker).
//   2. Que un secreto del servidor termine dentro de lo que se publica.
const fs = require('fs');
const path = require('path');

// Secretos que solo debe conocer el servidor. Si su valor aparece en un artefacto, no se publica.
const SERVER_SECRETS = ['DATABASE_URL', 'DATABASE_URL_UNPOOLED', 'SOYTEL_PEPPER', 'SOYTEL_DATA_KEY', 'SOYTEL_DATA_KEY_PREVIOUS', 'SOYTEL_ADMIN_KEY', 'VERCEL_TOKEN'];

// Motivo por el que no se puede compilar con esta configuración (null si está bien).
function publicConfigProblem(env = process.env) {
  if ((env.EXPO_PUBLIC_MQTT_PASSWORD || env.EXPO_PUBLIC_MQTT_USERNAME) && env.SOYTEL_PUBLIC_MQTT_CREDENTIALS !== 'low-privilege') {
    return [
      'EXPO_PUBLIC_MQTT_USERNAME / EXPO_PUBLIC_MQTT_PASSWORD quedan dentro de la app y cualquiera puede leerlos.',
      'Úsalos solo si esa credencial tiene permisos mínimos (los tópicos soytel/r2/# y nada más) y nunca es de administración.',
      'Para confirmar que es así, compila con SOYTEL_PUBLIC_MQTT_CREDENTIALS=low-privilege.',
    ].join(' ');
  }
  for (const [name, value] of Object.entries(env)) {
    if (name.startsWith('EXPO_PUBLIC_') && typeof value === 'string' && value.length >= 12 && SERVER_SECRETS.some((secret) => env[secret] && env[secret] === value)) {
      return `${name} tiene el mismo valor que un secreto del servidor. Las variables EXPO_PUBLIC_* son públicas.`;
    }
  }
  return null;
}

function* files(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* files(full);
    else yield full;
  }
}

// Busca en los archivos de texto de `directory` el valor de cada secreto del servidor presente en el
// entorno. Devuelve [{ secret, file }] con el NOMBRE del secreto, nunca su valor.
function findLeakedSecrets(directory, env = process.env) {
  const secrets = SERVER_SECRETS.map((name) => [name, env[name]]).filter(([, value]) => typeof value === 'string' && value.length >= 12);
  if (secrets.length === 0) return [];
  const leaks = [];
  for (const file of files(directory)) {
    if (!/\.(js|html|json|css|map|txt|webmanifest)$/i.test(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const [name, value] of secrets) {
      if (text.includes(value)) leaks.push({ secret: name, file: path.relative(directory, file) });
    }
  }
  return leaks;
}

// Lo público de la compilación, para dejarlo anotado junto al artefacto (sin credenciales).
function describePublicConfig(env = process.env) {
  const brokers = (env.EXPO_PUBLIC_MQTT_URLS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return {
    brokers: brokers.length ? brokers : require('../src/realtime/brokers.json'),
    webUrl: env.EXPO_PUBLIC_WEB_URL || null,
    apiUrl: env.EXPO_PUBLIC_API_URL || null,
    mqttCredentials: Boolean(env.EXPO_PUBLIC_MQTT_USERNAME || env.EXPO_PUBLIC_MQTT_PASSWORD),
  };
}

// Entorno de los procesos que compilan (CLI de Expo, Gradle). EXPO_NO_DOTENV evita que la CLI de Expo
// cargue archivos .env: en la carpeta del proyecto suele quedar .env.production.local (de `vercel env pull`)
// con los secretos del servidor, y una compilación de la app no los necesita. La configuración pública
// (EXPO_PUBLIC_*) viene del entorno de quien compila y queda anotada en el manifiesto de la compilación.
function buildEnv(env = process.env) {
  return { ...env, CI: '1', NODE_ENV: 'production', EXPO_NO_DOTENV: '1' };
}

module.exports = { buildEnv, describePublicConfig, findLeakedSecrets, publicConfigProblem, SERVER_SECRETS };
