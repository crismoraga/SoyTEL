import { Platform } from 'react-native';
import defaultBrokers from './brokers.json';

// Configuración de la conexión en vivo. Se puede cambiar sin tocar código con variables EXPO_PUBLIC_* al compilar.
//
// OJO: todo lo que empieza con EXPO_PUBLIC_ queda DENTRO de la app (web y APK) y cualquiera puede
// leerlo. Aquí solo van datos públicos. Un usuario y clave de broker puestos aquí son, en la práctica,
// públicos: úsalos solo si esa credencial tiene permisos mínimos (los tópicos de la ruta) y nunca una
// credencial de administración. Ver docs/PRODUCCION.md.

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const configured = list(process.env.EXPO_PUBLIC_MQTT_URLS);

// Brokers MQTT sobre WebSocket seguro. El stand se conecta a todos; el código de la ruta indica por
// cuál parten los teléfonos. La lista por defecto vive en brokers.json (también la usa la política de
// seguridad de la web, que solo permite conectar a estos servidores).
export const brokerUrls: string[] = configured.length > 0 ? configured : defaultBrokers;

export const brokerAuth = {
  username: process.env.EXPO_PUBLIC_MQTT_USERNAME || undefined,
  password: process.env.EXPO_PUBLIC_MQTT_PASSWORD || undefined,
};

// Origen de la página cuando la app corre en el navegador.
const pageOrigin = Platform.OS === 'web' ? (globalThis as { location?: { origin?: string } }).location?.origin : undefined;

// Dirección pública de la versión web: la usa el QR del stand para unirse sin instalar nada.
// En la web es el mismo sitio donde está abierta la app (producción, una vista previa o un dominio propio).
export const webAppUrl = (process.env.EXPO_PUBLIC_WEB_URL || pageOrigin || 'https://soytel.vercel.app').replace(/\/+$/, '');

// API de cuentas y ranking (funciones de Vercel junto a la versión web). En la web se usa la del mismo
// sitio: una vista previa nunca escribe en la base de datos de producción.
export const apiBaseUrl = (process.env.EXPO_PUBLIC_API_URL || (pageOrigin ? `${pageOrigin}/api/v1` : `${webAppUrl}/api/v1`)).replace(/\/+$/, '');

// Enlace de descarga de la app Android (APK de producción).
export const androidDownloadUrl = process.env.EXPO_PUBLIC_ANDROID_URL || 'https://github.com/crismoraga/SoyTEL/releases/latest';
