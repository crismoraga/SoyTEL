# Producción

Cómo publicar SoyTEL. Ningún comando de este documento se ejecuta solo: los lanza quien publica.

Una versión se publica en este orden: **comprobaciones → base de datos → web y API → APK**. La ruta en vivo usa el protocolo v3, que no conversa con el v2 de la versión 2.x: la web y el APK de una misma versión se publican juntos, el mismo día.

Los secretos nunca van en el repositorio. Viven en Vercel, en `~/.soytel/` y en `~/.gradle/gradle.properties`.

## 1. Comprobaciones

Requisitos: Node 24.15.0 (`.nvmrc`), npm 10 y Chrome. Instalar con `npm ci`.

```powershell
npm run check        # tipos de la app y de la API, lint y todas las pruebas
npx expo-doctor
npm run e2e:web      # la ruta completa en navegadores reales, con la política de seguridad de producción
```

`e2e:web` compila la web contra dos servidores MQTT locales y juega una ruta con un stand, cuatro teléfonos y una segunda pantalla. Deja capturas y medidas en `dist/e2e-artifacts`. Si Chrome no está en la ruta habitual, define `CHROME_PATH`.

GitHub Actions (`.github/workflows/ci.yml`) repite estas comprobaciones en cada push y pull request. No publica nada.

`npm run smoke:brokers` prueba los servidores MQTT públicos de verdad. Es opcional, depende de la red y no forma parte de `check`.

## 2. Configuración

### Secretos del servidor (variables del proyecto en Vercel)

| Variable | Para qué |
| --- | --- |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Postgres en Neon, con y sin pool |
| `SOYTEL_PEPPER` | Sal secreta de los tokens y los códigos de recuperación |
| `SOYTEL_DATA_KEY` | Llave AES-256-GCM de los datos de contacto (32 bytes en base64) |
| `SOYTEL_DATA_KEY_PREVIOUS` | Llaves anteriores, separadas por coma. Solo se usan para leer |
| `SOYTEL_ADMIN_KEY` | Llave de `api/v1/admin/players` (cabecera `x-admin-key`) |
| `SOYTEL_ALLOWED_ORIGINS` | Orígenes web permitidos, separados por coma |

### Configuración pública (queda dentro de la app)

Todo lo que empieza con `EXPO_PUBLIC_` se copia en la web y en el APK, y cualquiera puede leerlo. Nunca pongas ahí una contraseña con permisos de administración.

| Variable | Valor por defecto |
| --- | --- |
| `EXPO_PUBLIC_MQTT_URLS` | Los tres servidores de `src/realtime/brokers.json` |
| `EXPO_PUBLIC_MQTT_USERNAME`, `EXPO_PUBLIC_MQTT_PASSWORD` | Sin credenciales |
| `EXPO_PUBLIC_WEB_URL` | `https://soytel.vercel.app` (en la web, el origen de la página) |
| `EXPO_PUBLIC_API_URL` | `<web>/api/v1` |
| `EXPO_PUBLIC_ANDROID_URL` | La página de versiones del repositorio |

Reglas que las compilaciones hacen cumplir:

- Si defines usuario o contraseña de MQTT, declara `SOYTEL_PUBLIC_MQTT_CREDENTIALS=low-privilege`. Es la confirmación de que esa cuenta solo puede publicar y leer bajo `soytel/r2/#`.
- Ninguna variable pública puede valer lo mismo que un secreto del servidor, y el resultado se revisa buscando esos valores.
- Si cambias los servidores MQTT, actualiza la política de seguridad con `npm run csp:write` y confirma `vercel.json`. `build:web` se detiene si no coinciden.
- Las compilaciones **no leen archivos `.env`**. Las variables públicas se definen en la terminal o en CI. Lo que se usó queda anotado en `dist/web/build.json` y en el `.json` que acompaña al APK.

## 3. Base de datos

Las migraciones están en `scripts/db/migrations` y se aplican en orden, cada una en una transacción, con su huella en la tabla `schema_migrations`. El destino es siempre explícito y la URL se toma del entorno de quien ejecuta.

```powershell
$env:DATABASE_URL_UNPOOLED = "<url de la base>"
npm run db:migrate -- --target production --dry-run            # muestra el destino y lo pendiente; no escribe
npm run db:migrate -- --target production --confirm <id>       # <id> es el endpoint que mostró el dry-run
```

Para una base de prueba: `--target preview` (sin `--confirm`).

La migración `0002_account_integrity` agrega dos columnas con valor por defecto, un índice y una regla: una fila nueva o editada solo puede guardar un contacto si tiene curso, consentimiento y, en 7.º y 8.º básico, autorización de un adulto. **No modifica filas existentes.**

- Aplica la migración y publica la API enseguida. Entre ambos pasos, la API anterior rechaza los registros con contacto que no cumplen la regla.
- Las cuentas antiguas que no cumplen la regla quedan como están. Su contacto no sale en la exportación (`contactWithheld`). Qué hacer con ellas lo decide la persona responsable de privacidad.
- Exigir el curso para guardar un contacto es una decisión conservadora de esta versión. Si la política oficial es otra, cambia `contactPolicyProblem` en `src/account/rules.ts` y la regla de la migración.

## 4. Web y API

```powershell
npm run deploy:web -- --preview                  # vista previa con URL propia
npm run deploy:web -- --production --confirm     # producción
```

El comando exige un árbol sin cambios, ejecuta `npm run check` y `npm run e2e:web`, y publica con la CLI de Vercel fijada en `package.json`. Vercel compila con `npm run verify:web`, que repite las comprobaciones.

Después de publicar, `https://soytel.vercel.app/api/v1/health` debe responder 200 con `"ok": true`. Si responde 503, el campo `problems` dice qué falta: `database`, `pepper`, `data_key` o `data_key_mismatch`.

## 5. Android

Requisitos: Android SDK, JDK 17 y la llave de firma. En `~/.gradle/gradle.properties`:

```properties
SOYTEL_UPLOAD_STORE_FILE=<ruta al .jks>
SOYTEL_UPLOAD_STORE_PASSWORD=<clave>
SOYTEL_UPLOAD_KEY_ALIAS=<alias>
SOYTEL_UPLOAD_KEY_PASSWORD=<clave>
```

```powershell
npm run android:release     # APK de producción
npm run android:test-apk    # APK de prueba, firmado con la llave de depuración
```

`android:release` exige un árbol sin cambios, ejecuta `npm run check`, genera el proyecto nativo limpio y compila para arm64 y armv7. Deja `dist/android/SoyTEL-<versión>.apk` y un `.apk.json` con el commit, la huella del archivo y la del certificado.

- Si falta alguna de las cuatro propiedades, Gradle se detiene. Nunca firma un APK de producción con la llave de depuración.
- Antes de entregar el archivo se lee su certificado con `apksigner`. Si defines `SOYTEL_UPLOAD_CERT_SHA256`, además debe coincidir con esa huella.
- El APK de prueba se llama `SoyTEL-<versión>-prueba.apk`. No es para publicar.
- Para un emulador x86_64: `$env:ANDROID_ARCHS = "x86_64"` antes del comando. Solo se aceptan `arm64-v8a`, `armeabi-v7a`, `x86` y `x86_64`.

Antes de una versión nueva, sube `version` en `package.json` y `app.json`, y `android.versionCode` e `ios.buildNumber` en `app.json`.

Config plugins propios:

- `plugins/withAndroidReleaseSigning.js`: firma el APK de producción con la llave anterior y detiene Gradle si falta.
- `plugins/withAndroidTextLayout.js`: desde Android 15, algunas etiquetas perdían su última palabra por cómo se mide el texto. El plugin fija el cálculo clásico.

## Cambiar la llave de los datos de contacto

1. Genera una llave nueva de 32 bytes en base64.
2. En Vercel, mueve la llave actual a `SOYTEL_DATA_KEY_PREVIOUS` y pon la nueva en `SOYTEL_DATA_KEY`.
3. Publica. Los datos antiguos se siguen leyendo y lo nuevo se cifra con la llave nueva.
4. `/api/v1/health` responde `data_key_mismatch` si algún dato guardado ya no se puede leer.

## Ruta en vivo

Los mensajes viajan cifrados y firmados por servidores MQTT. El stand se conecta a todos a la vez y cada teléfono usa el primero que le entrega la ruta, así que la caída de uno no detiene el juego. El protocolo está en [RUTA-PROTOCOLO.md](RUTA-PROTOCOLO.md).

Con los servidores públicos por defecto, una acción tardó entre 0,5 y 0,9 s en verse en todas las pantallas desde Chile (una medición). En las pruebas con servidores locales tarda menos de 0,2 s. Para una feria se recomienda un servidor propio y cercano, con una cuenta de bajo privilegio.

## Sin conexión

La web se puede instalar (tiene manifiesto e iconos) pero **no funciona sin conexión**: no hay service worker y abrirla requiere red. Una vez cargada, los juegos individuales no usan la red. El APK abre y juega sin conexión; la cuenta, el ranking y la ruta en vivo avisan cuando falta red.

## Volver atrás

- **Web y API**: en Vercel, promueve el despliegue anterior. Es inmediato y no borra nada.
- **Base de datos**: las migraciones solo agregan. No se revierten: la API anterior funciona sobre la base migrada, salvo que rechaza los registros con contacto que no cumplen la regla nueva.
- **APK**: conserva el APK anterior. Un teléfono con la app 2.x no puede entrar a una ruta creada con la 3.x: la pantalla del stand avisa que hay un teléfono con una versión antigua, y ese teléfono tiene que actualizar.

## Lista antes de publicar

- [ ] `npm run check`, `npx expo-doctor` y `npm run e2e:web` sin errores.
- [ ] Migraciones al día en producción (`--dry-run` no lista pendientes).
- [ ] Web publicada y `/api/v1/health` con `"ok": true`.
- [ ] APK firmado con la llave de producción, instalado en un teléfono Android real: entrar a una ruta por QR y por código, formulario de cuenta con el teclado abierto, cambio de tema, una Ráfaga, TEL Runner y un desafío sin reloj.
- [ ] Una ruta de prueba con el stand en la web publicada y dos teléfonos con el APK nuevo.

## Sistema de diseño (Claude Design)

1. `npm run design:system -- <carpeta>`
2. Subir los archivos nuevos o cambiados de `<carpeta>/uploads/<Grupo>/` al almacén del artifact (lotes de 25 como máximo).
3. Escribir `ids.json` como `{"Grupo/archivo.svg": "<id>"}`; los ids de los activos que no cambiaron siguen valiendo.
4. `npm run design:system -- <carpeta> --index ids.json`
5. Publicar `project/design-system.json` junto con el resto de `project/**`.

`npm run brand:kit` genera las piezas de marca en PNG y necesita Chrome; `-- --html-only` deja solo el índice HTML. Si no puede generar las imágenes, termina con error.
