# SoyTEL

App de Ingeniería Civil Telemática (USM) para descubrir la carrera jugando: microjuegos, una carrera sin fin, desafíos sin reloj, una ruta en vivo por los laboratorios y Rutix, la mascota que acompaña y explica. Funciona en Android, iOS y web ([soytel.vercel.app](https://soytel.vercel.app)).

Versión actual: **3.0.0**.

## Qué incluye

- **Ráfaga TEL**: 6 microjuegos al azar de un set de 22, con 3 vidas. Cada ronda muestra cómo se juega y una pista de Rutix, parte cuando la persona toca y termina con lo que se aprendió. Tiene pausa y un **desafío diario** con bono.
- **TEL Runner**: carrera sin fin por la «autopista de datos». Se juntan paquetes, se esquivan virus y se saltan cables sueltos. Con los paquetes se desbloquean siete personajes telemáticos (router, fibra óptica, satélite, dron, la nube…), cada uno con un dato real y una ventaja.
- **Desafíos sin reloj**: Conecta la red (girar cables), Binario y Mensaje cifrado, por niveles.
- **Ruta Telemática en vivo**: stand → sala B215 → sala B213 → pasillo. El stand crea la ruta, el grupo entra con un código de 6 caracteres o un QR, juega seis juegos de los proyectos de la carrera y cierra con una trivia y un podio. Sigue funcionando si se cae un servidor, si un teléfono pierde la señal o si alguien recarga la página. También se puede practicar cada juego por separado.
- **Quién quiere ser Telemático**, **práctica por área** e **historia «La señal perdida»** (5 capítulos).
- **Rutix**: 15 expresiones, 7 poses y guardarropa. Da pistas en los juegos, mira el reloj y reacciona; en su pantalla se le puede tocar, chocar la mano, pedir chistes, hacerlo bailar o responder su «¿verdadero o falso?».
- **Guía de inicio y tutoriales**: Inicio sugiere los primeros seis pasos; cada juego abre un «Cómo se juega» la primera vez y lo deja a mano en el botón de ayuda.
- **Cuenta opcional y ranking global**: solo pide un alias. Curso, colegio y contacto son opcionales, con consentimiento (y de un adulto para 7.º y 8.º básico). El progreso se recupera con un código.
- **Carrera**: áreas, malla interactiva y enlaces a admisión.
- **31 logros**, avisos, perfil con historial y **ajustes**: tema claro u oscuro, ritmo de los juegos (tranquilo, normal o rápido), nivel de animaciones, vibración y Rutix en los juegos.

## Stack

- Expo SDK 57, React Native 0.86 (nueva arquitectura), React 19.2 con React Compiler y Expo Router 57 (rutas tipadas)
- TypeScript 6 estricto, Reanimated 4.5 y `react-native-svg`
- Datos locales en AsyncStorage; credenciales selladas en `src/security/vault.ts`
- Ruta en vivo: MQTT sobre WebSocket con mensajes cifrados y firmados (`src/realtime`, `src/route`); el protocolo está en [docs/RUTA-PROTOCOLO.md](docs/RUTA-PROTOCOLO.md)
- Cuentas y ranking: funciones de Vercel (`api/v1/*`) sobre Postgres en Neon
- Pruebas: Jest 29 con jest-expo, Postgres real en memoria (PGlite) para la API, servidores MQTT locales (aedes) para la ruta y Chrome (puppeteer-core) para el recorrido en navegador

## Ejecutar

```powershell
npm install
npm run start        # Expo: escanear el QR, o `a` / `i` / `w`
npm run web          # solo web
```

## Validación

```powershell
npm run check        # tipos de la app y de la API, lint y todas las pruebas
npx expo-doctor
npm run e2e:web      # la ruta completa en Chrome, contra servidores MQTT locales
npm run smoke:brokers   # opcional: los servidores MQTT públicos de verdad
```

Qué cubre cada una:

- `npm run check`: pruebas unitarias y de componentes, la API contra Postgres real (PGlite, sin red) y la ruta en vivo contra servidores MQTT locales. No omite ninguna prueba. Al 2026-10-07 son 33 suites.
- `npm run e2e:web`: compila la web con la política de seguridad de producción y juega una ruta con un stand, cuatro teléfonos y una segunda pantalla, con recargas, una segunda pestaña y la caída de un servidor.
- `npm run smoke:brokers`: depende de la red y de servidores de terceros; por eso no forma parte de `check`.

GitHub Actions ejecuta `check`, Expo Doctor, la compilación web y `e2e:web` en cada push (`.github/workflows/ci.yml`).

## Publicar

```powershell
npm run build:web                                  # web estática en dist/web, con sus comprobaciones
npm run db:migrate -- --target production --dry-run   # migraciones pendientes (scripts/db/migrations)
npm run deploy:web -- --preview                    # Vercel: vista previa (o --production --confirm)
npm run android:release                            # APK firmado en dist/android/SoyTEL-<versión>.apk
npm run android:test-apk                           # APK de prueba, con la llave de depuración
```

El orden, los requisitos, las variables de entorno, la firma de Android y cómo volver atrás están en [docs/PRODUCCION.md](docs/PRODUCCION.md). La revisión de avisos de dependencias está en [docs/DEPENDENCIAS.md](docs/DEPENDENCIAS.md). Ningún secreto vive en el repositorio.

## Diseño

El sistema de diseño está en Claude Design: [SoyTEL Design System](https://claude.ai/artifact/GHwKfGt8Z2dzrpKqhRfqJZ). Se genera desde el código de la app:

```powershell
npm run design:export                                  # SVG y hoja de contacto en dist/design
npm run design:system -- <carpeta>                     # project/** y uploads/**
npm run design:system -- <carpeta> --index ids.json    # además, el índice con los ids de los activos subidos
```

Tokens (`src/theme`): los colores de marca son fijos; los de superficie cambian con el tema. Sobre una superficie del tema se escribe con `ink`, `inkSoft` o `inkAccent`; sobre un relleno de marca, con `primary` o `secondary`. El tema se aplica al arrancar (`index.js` → `src/theme/boot.ts`), antes de crear los estilos.

## Estructura

```text
app/                     Rutas (Expo Router): pestañas, juegos, ruta, cuenta, ajustes
api/                     API de cuentas y ranking (funciones de Vercel)
plugins/                 Config plugins de Android (firma de release, medición de texto)
scripts/                 Compilación, publicación, migraciones (scripts/db) y sistema de diseño
src/account/             Cuenta, reglas de alias y cliente de la API
src/components/          UI base, gráficos (Rutix, medallas, ilustraciones) y feedback
src/data/                Preguntas, logros, historia, malla, frases y juegos de Rutix
src/features/burst/      Ráfaga: motor, catálogo, guías y 22 microjuegos
src/features/runner/     TEL Runner: simulación pura, personajes y pantalla de juego
src/features/puzzles/    Desafíos sin reloj
src/features/stations/   Juegos de la ruta
src/features/tutorial/   Tutoriales «Cómo se juega»
src/features/coach/      Burbuja de Rutix y hoja de pausa
src/graphics/            Arte SVG declarativo (íconos, Rutix, personajes, patrones)
src/realtime/ src/route/ Ruta en vivo: MQTT, cifrado, motor del stand y de participantes
src/storage/             Persistencia local
src/theme/               Tokens y temas
tests/                   Pruebas (unitarias, componentes, API con Postgres, ruta con MQTT local)
docs/                    Producción, protocolo de la ruta, dependencias y auditorías
```
