# SoyTEL

App de Ingeniería Civil Telemática (USM) para descubrir la carrera jugando: microjuegos, una carrera sin fin, desafíos sin reloj, una ruta en vivo por los laboratorios y Rutix, la mascota que acompaña y explica. Funciona en Android, iOS y web ([soytel.vercel.app](https://soytel.vercel.app)).

Versión actual: **3.0.0**.

## Qué incluye

- **Ráfaga TEL**: 6 microjuegos al azar de un set de 18, con 3 vidas. Cada ronda muestra cómo se juega y una pista de Rutix, parte cuando la persona toca y termina con lo que se aprendió. Tiene pausa y un **desafío diario** con bono.
- **TEL Runner**: carrera sin fin por la «autopista de datos». Se juntan paquetes, se esquivan virus y se saltan cables sueltos. Con los paquetes se desbloquean siete personajes telemáticos (router, fibra óptica, satélite, dron, la nube…), cada uno con un dato real y una ventaja.
- **Desafíos sin reloj**: Conecta la red (girar cables), Binario y Mensaje cifrado, por niveles.
- **Ruta Telemática en vivo**: stand → sala B215 → sala B213 → pasillo. El stand crea la ruta, el grupo entra con un código de 6 caracteres o un QR, juega seis juegos de los proyectos de la carrera y cierra con una trivia y un podio. También se puede practicar cada juego por separado.
- **Quién quiere ser Telemático**, **práctica por área** e **historia «La señal perdida»** (5 capítulos).
- **Rutix**: 15 expresiones, 7 poses y guardarropa. Da pistas en los juegos, mira el reloj y reacciona; en su pantalla se le puede tocar, chocar la mano, pedir chistes, hacerlo bailar o responder su «¿verdadero o falso?».
- **Guía de inicio y tutoriales**: Inicio sugiere los primeros seis pasos; cada juego abre un «Cómo se juega» la primera vez y lo deja a mano en el botón de ayuda.
- **Cuenta opcional y ranking global**: solo pide un alias. Curso, colegio y contacto son opcionales, con consentimiento (y de un adulto para 7.º y 8.º básico). El progreso se recupera con un código.
- **Carrera**: áreas, malla interactiva y enlaces a admisión.
- **26 logros**, avisos, perfil con historial y **ajustes**: tema claro u oscuro, ritmo de los juegos (tranquilo, normal o rápido), nivel de animaciones, vibración y Rutix en los juegos.

## Stack

- Expo SDK 57, React Native 0.86 (nueva arquitectura), React 19.2 con React Compiler y Expo Router 57 (rutas tipadas)
- TypeScript 6 estricto, Reanimated 4.5 y `react-native-svg`
- Datos locales en AsyncStorage; credenciales selladas en `src/security/vault.ts`
- Ruta en vivo: MQTT sobre WebSocket con mensajes cifrados y firmados (`src/realtime`, `src/route`)
- Cuentas y ranking: funciones de Vercel (`api/v1/*`) sobre Postgres en Neon
- Jest 29 con jest-expo

## Ejecutar

```powershell
npm install
npm run start        # Expo: escanear el QR, o `a` / `i` / `w`
npm run web          # solo web
```

## Validación

```powershell
npm run check        # typecheck de la app y de la API, lint y pruebas
npx expo-doctor
```

Estado: TypeScript y lint limpios; 180 pruebas en verde (20 suites, una se omite sin base de datos).

## Publicar

```powershell
npm run build:web          # web estática en dist/web
npm run deploy:web         # Vercel (producción)
npm run android:release    # APK firmado en dist/android/SoyTEL-<versión>.apk
npm run db:migrate         # esquema de Postgres (scripts/db/schema.sql)
```

Los requisitos, las variables de entorno y la firma de Android están en [docs/PRODUCCION.md](docs/PRODUCCION.md). Ningún secreto vive en el repositorio.

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
scripts/                 Builds, migración de la base de datos y sistema de diseño
src/account/             Cuenta, reglas de alias y cliente de la API
src/components/          UI base, gráficos (Rutix, medallas, ilustraciones) y feedback
src/data/                Preguntas, logros, historia, malla, frases y juegos de Rutix
src/features/burst/      Ráfaga: motor, catálogo, guías y 18 microjuegos
src/features/runner/     TEL Runner: simulación pura, personajes y pantalla de juego
src/features/puzzles/    Desafíos sin reloj
src/features/stations/   Juegos de la ruta
src/features/tutorial/   Tutoriales «Cómo se juega»
src/features/coach/      Burbuja de Rutix y hoja de pausa
src/graphics/            Arte SVG declarativo (íconos, Rutix, personajes, patrones)
src/realtime/ src/route/ Ruta en vivo: MQTT, cifrado, motor del stand y de participantes
src/storage/             Persistencia local
src/theme/               Tokens y temas
tests/                   Pruebas unitarias y de componentes
```
