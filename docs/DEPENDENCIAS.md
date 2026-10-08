# Dependencias: avisos de seguridad

Revisión del 2026-10-07 sobre el commit `826d2cc` (`package-lock.json` sin cambios desde `7a6fee9`).

`npm audit` marca **95 paquetes del árbol** (1 crítico, 70 altos, 24 moderados). Ese número cuenta cada paquete que depende de algo afectado; los avisos distintos son **42, en 13 paquetes**. El árbol instalado tiene 1539 paquetes (857 de producción según npm, 660 de desarrollo, 136 opcionales).

Lo que npm llama «producción» (`--omit=dev`, 61 paquetes marcados) incluye la CLI de Expo, que compila la app pero no viaja dentro de ella. Por eso cada aviso se clasifica por dónde corre el código:

- **App**: lo que llega al teléfono o al navegador.
- **API**: las funciones de `api/`. Su única dependencia en ejecución es `@neondatabase/serverless`, y ningún paquete afectado cuelga de ella.
- **Compilación**: CLI de Expo, `prebuild` y CLI de Vercel. Corren en el equipo de quien publica o en CI.
- **Pruebas**: Jest y ESLint.

## Resultado

Ningún aviso es explotable en la app ni en la API publicadas. Un solo paquete afectado llega al bundle (`decode-uri-component`) y su función vulnerable no se llama. No se aplicó ningún cambio de versiones.

`npm audit fix --force` **no se ejecuta**: lo que propone es bajar a Expo 44, React Native 0.72 y Vercel CLI 54.

## Detalle

| Paquete (versión instalada) | Llega por | Alcance | Avisos | Qué necesitaría un atacante | Decisión |
| --- | --- | --- | --- | --- | --- |
| `decode-uri-component` 0.2.2 | `expo-router` → `query-string` | **App** (está en el bundle web y en el APK) | GHSA-vcc3-ghjq-m6fr (moderado, bloqueo por CPU) | Que la app decodifique con `queryString.parse` un texto con `%` malformado. expo-router solo usa `queryString.stringify`; su llamada a `parse` está comentada (`node_modules/expo-router/build/fork/getStateFromPath.js:538`). | Aceptado. La versión corregida (0.5.0) es solo ESM y `query-string` 7 la carga con `require`: forzarla rompería el enrutador. Revisar al subir `expo-router`. |
| `node-forge` 1.4.0 | `expo` → `@expo/cli` | Compilación | GHSA-86w9-cpqp-85rv (alto) | Que la CLI verifique una firma RSA falsificada de una actualización OTA. La app no usa `expo-updates` ni firma de código. | Aceptado; se corrige al actualizar Expo. |
| `js-yaml` 3.15.2 y 4.1.1 | `babel-plugin-istanbul` → `@istanbuljs/load-nyc-config`; `vercel` → `@vercel/python-analysis` | Pruebas y compilación | GHSA-h67p-54hq-rp68, GHSA-52cp-r559-cp3m, GHSA-5p4m-2wfm-xmqj, GHSA-2883-xcg3-v3hh (bloqueo por CPU) | Dejar un YAML preparado dentro del repositorio. Quien puede hacerlo ya puede ejecutar código en la compilación. | Aceptado. |
| `sprintf-js` 1.0.3 | `js-yaml` 3 → `argparse` | Pruebas | GHSA-hp3w-g68c-fv3c (moderado) | Controlar el formato que `argparse` imprime. No hay entrada externa. | Aceptado. |
| `braces` 3.0.3 | `jest` → `micromatch` | Pruebas | GHSA-vfj7-8cjw-p6xm (alto) | Controlar los patrones de archivos de la configuración de Jest. | Aceptado. |
| `minimatch` | `eslint`, `eslint-config-expo`, `babel-plugin-istanbul` | Pruebas | GHSA-3ppc-4f35-3m26, GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74 (altos, expresiones regulares lentas) | Controlar los patrones de archivos de ESLint o de cobertura. | Aceptado. |
| `ajv` 6.15.0 y 8.6.3 | `eslint`; `vercel` → `@vercel/static-config` | Pruebas y compilación | GHSA-2g4f-4pwh-qvx6 (moderado) | Entregar un esquema con la opción `$data`. Los esquemas son de las propias herramientas. | Aceptado. |
| `uuid` 7.0.3 | `expo-splash-screen` → `@expo/config-plugins` → `xcode` | Compilación (proyecto de iOS) | GHSA-w5hq-g745-h8pq (moderado) | Llamar a `v3`, `v5` o `v6` con un búfer propio. `xcode` solo genera identificadores `v4`. | Aceptado. |
| `undici` 5.28.4 y 5.29.0 | `vercel`; `vercel` → `@vercel/node` | Compilación y publicación | 15 avisos (5 altos): GHSA-vrm6-8vpv-qv8q, GHSA-v9p9-hfj2-hcw8, GHSA-vxpw-j846-p89q, GHSA-2mjp-6q6p-2qxm, GHSA-g9mf-h72j-4rw9 y otros | Que la CLI de Vercel hable con un servidor malicioso o con un intermediario que rompa TLS. Solo se conecta a la API de Vercel. | Aceptado. La CLI está fijada en 62.7.0; npm no ofrece una versión posterior sin estos avisos. |
| `@fastify/busboy` 2.1.1 | `vercel` → `@vercel/node` → `undici` | Compilación y publicación | GHSA-x8mw-p69m-v3mx (alto), GHSA-gxm5-99cw-xjw9 | Lo mismo que `undici`. | Aceptado. |
| `tar` 7.5.11 | `vercel` → `@vercel/nft` → `@mapbox/node-pre-gyp`; `vercel` → `@vercel/container` | Compilación y publicación | 6 avisos, entre ellos el único crítico (GHSA-23hp-3jrh-7fpw, bloqueo al descomprimir) | Que la CLI descomprima un archivo preparado: binarios de un paquete nativo de Node o una imagen de contenedor. El proyecto no usa ninguno de los dos. | Aceptado. |
| `smol-toml` 1.5.2 | `vercel` (análisis de proyectos Python, Rust y contenedores) | Compilación | GHSA-7w5x-hrqm-74c2 (alto), GHSA-v3rj-xjv7-4jmq, GHSA-r4xh-jqrq-34v2 | Dejar un TOML preparado en el repositorio. | Aceptado. |
| `path-to-regexp` 6.1.0 y 8.3.0 | `vercel` → constructores de Node, Express, Hono y Remix | Compilación (`vercel dev` y marcos que no se usan) | GHSA-9wv6-86v2-598j, GHSA-j3q9-mxjg-w52f (altos), GHSA-27v5-c462-wpq7 | Definir rutas con patrones preparados. Las rutas las define el proyecto. | Aceptado. |

## Cómo se comprobó

```powershell
npm audit --json                 # avisos y paquetes marcados
npm audit --omit=dev --json      # el subconjunto que npm llama producción
npm ls <paquete> --all           # por dónde llega cada uno
npm run build:web                # y buscar el paquete en dist/web/_expo/static/js
```

En el bundle web aparecen `query-string` y `decode-uri-component`. No aparecen `js-yaml`, `node-forge`, `undici`, `busboy`, `tar`, `smol-toml`, `path-to-regexp` ni `micromatch`.

## Cuándo revisar de nuevo

Quien mantiene el repositorio repite esta revisión al actualizar Expo (SDK 58) o la CLI de Vercel, y antes de cada versión que se publique. Una actualización se acepta si pasa `npm ci`, `npm run check`, `npm run build:web`, `npm run e2e:web` y una compilación del APK.
