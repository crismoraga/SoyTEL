// Configuración de la conexión en vivo. Se puede cambiar sin tocar código con variables EXPO_PUBLIC_* al compilar.

const DEFAULT_BROKERS = [
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://broker.emqx.io:8084/mqtt',
  'wss://test.mosquitto.org:8081',
];

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const configured = list(process.env.EXPO_PUBLIC_MQTT_URLS);

// Brokers MQTT sobre WebSocket seguro, en orden de preferencia (el código de la ruta indica cuál usar).
export const brokerUrls: string[] = configured.length > 0 ? configured : DEFAULT_BROKERS;

export const brokerAuth = {
  username: process.env.EXPO_PUBLIC_MQTT_USERNAME || undefined,
  password: process.env.EXPO_PUBLIC_MQTT_PASSWORD || undefined,
};

// Dirección pública de la versión web: la usa el QR del stand para unirse sin instalar nada.
export const webAppUrl = (process.env.EXPO_PUBLIC_WEB_URL || 'https://soytel.vercel.app').replace(/\/+$/, '');

// API de cuentas y ranking (funciones de Vercel junto a la versión web).
export const apiBaseUrl = (process.env.EXPO_PUBLIC_API_URL || `${webAppUrl}/api/v1`).replace(/\/+$/, '');

// Enlace de descarga de la app Android (APK de producción).
export const androidDownloadUrl = process.env.EXPO_PUBLIC_ANDROID_URL || 'https://github.com/crismoraga/SoyTEL/releases/latest';
