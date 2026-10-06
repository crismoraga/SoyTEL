# Producción

Cómo publicar SoyTEL. Los secretos nunca van en el repositorio: viven en Vercel, en `~/.soytel/` y en `~/.gradle/gradle.properties`.

## Web y API (Vercel)

```powershell
npm run check
npm run deploy:web
```

`deploy:web` compila la web (`dist/web`) y las funciones de `api/v1/*`, y las publica en producción. Si el paso de subida responde «Not authorized», repite solo ese paso: `npx vercel@latest deploy --prebuilt --prod --yes`.

Comprobación rápida: `https://soytel.vercel.app/api/v1/health` debe responder `{"ok":true,"db":true}`.

Variables de entorno del proyecto en Vercel:

| Variable | Para qué |
| --- | --- |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Postgres en Neon (con y sin pool) |
| `SOYTEL_PEPPER` | Sal secreta de los tokens y códigos de recuperación |
| `SOYTEL_DATA_KEY` | Clave AES-256-GCM de los datos de contacto |
| `SOYTEL_ADMIN_KEY` | Clave de `api/v1/admin/players` (cabecera `x-admin-key`) |
| `SOYTEL_ALLOWED_ORIGINS` | Orígenes web permitidos, separados por coma |

El esquema está en `scripts/db/schema.sql` y se aplica con `npm run db:migrate` (lee `DATABASE_URL_UNPOOLED`).

## Android

Requisitos: Android SDK, JDK 17 y la llave de firma. En `~/.gradle/gradle.properties`:

```properties
SOYTEL_UPLOAD_STORE_FILE=<ruta al .jks>
SOYTEL_UPLOAD_STORE_PASSWORD=<clave>
SOYTEL_UPLOAD_KEY_ALIAS=<alias>
SOYTEL_UPLOAD_KEY_PASSWORD=<clave>
```

```powershell
npm run android:release
```

Genera el proyecto nativo limpio (`expo prebuild --clean`) y deja `dist/android/SoyTEL-<versión>.apk` para arm64 y armv7, con su SHA-256. Sin las cuatro propiedades, Gradle firma con la llave de depuración.

Para probar en un emulador x86_64: `ANDROID_ARCHS=x86_64 node scripts/build-android.js` (un APK arm no arranca ahí).

Antes de publicar una versión nueva, sube `version` en `package.json` y `app.json`, y `android.versionCode` e `ios.buildNumber` en `app.json`.

### Config plugins propios

- `plugins/withAndroidReleaseSigning.js`: firma el build de release con la llave anterior.
- `plugins/withAndroidTextLayout.js`: desde Android 15, un `TextView` mide su ancho con el borde real de los glifos y React Native lo mide con el avance de cada letra; algunas etiquetas perdían su última palabra. El plugin fija el cálculo clásico en el estilo por defecto de los `TextView`.

## Ruta en vivo

Los mensajes viajan cifrados y firmados por brokers MQTT públicos (`src/realtime/config.ts`). Para usar un broker propio, define las variables `EXPO_PUBLIC_*` que lee ese archivo antes de compilar.

## Sistema de diseño (Claude Design)

1. `npm run design:system -- <carpeta>`
2. Subir los archivos nuevos o cambiados de `<carpeta>/uploads/<Grupo>/` al almacén del artifact (lotes de 25 como máximo).
3. Escribir `ids.json` como `{"Grupo/archivo.svg": "<id>"}`; los ids de los activos que no cambiaron siguen valiendo.
4. `npm run design:system -- <carpeta> --index ids.json`
5. Publicar `project/design-system.json` junto con el resto de `project/**`.

## Lista antes de publicar

- [ ] `npm run check` y `npx expo-doctor` sin errores.
- [ ] Probar en un teléfono Android: código de la ruta (teclado), formulario de cuenta con el teclado abierto, cambio de tema, una Ráfaga, TEL Runner y un desafío sin reloj.
- [ ] Web publicada y `/api/v1/health` en verde.
- [ ] APK firmado con la llave de release (no la de depuración).
