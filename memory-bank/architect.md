# Arquitectura de SoyTEL

Resumen al 2026-10-07 (versión 3.0.0). El detalle vive junto al código: [README](../README.md), [docs/PRODUCCION.md](../docs/PRODUCCION.md) y [docs/RUTA-PROTOCOLO.md](../docs/RUTA-PROTOCOLO.md).

- **App**: Expo SDK 57, React Native 0.86 y Expo Router. Un solo código para Android, iOS y web.
- **Datos locales**: AsyncStorage, con un candado por clave para las escrituras (`src/storage`). Las credenciales van selladas en `src/security/vault.ts`.
- **Juegos**: cada modo tiene su lógica pura y su pantalla (`src/features/*`). Los juegos de la ruta usan un reloj que se puede detener (`src/features/stations/kit.tsx`).
- **Ruta en vivo**: el stand es la única autoridad y publica el estado completo, cifrado y firmado, por MQTT sobre WebSocket en varios servidores a la vez. Los teléfonos mandan acciones con confirmación y las guardan hasta recibirla (`src/route`, `src/realtime`).
- **Cuentas y ranking**: funciones de Vercel (`api/v1`) sobre Postgres en Neon. Cada cambio es una sola sentencia SQL condicionada por el token. Migraciones versionadas en `scripts/db/migrations`.
- **Publicación**: scripts de `scripts/` con comprobaciones antes de compilar o publicar. Nada se publica solo.
