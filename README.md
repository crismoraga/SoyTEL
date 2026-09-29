# SoyTEL

Aplicación móvil Expo/React Native para descubrir Ingeniería Civil Telemática (USM) mediante sesiones lúdicas de 15–20 minutos.

## Experiencia incluida

- **Bienvenida y onboarding**: splash de marca, tres láminas ilustradas y elección de alias, sin cuentas ni correos.
- **Pestañas**: Inicio (misión sugerida, Telix y dato del día), Juegos, Carrera, Logros y Buzón.
- **Ráfaga TEL**: 6 microjuegos al azar de un set de 12, con 3 vidas y rondas cada vez más cortas. Desde la colección se puede practicar un microjuego en modo enfoque (3 rondas).
- **Quién quiere ser Telemático**: escalera de 10 preguntas (100 → 32.000 pts), comodines 50:50, «Pregúntale a Telix» y «Público», opción de plantarse y zona segura en la pregunta 5.
- **Práctica libre**: preguntas por área con explicación inmediata.
- **Historia «La señal perdida»**: 5 capítulos con mapa del campus, diálogos con Telix y un reto por capítulo con desbloqueo progresivo.
- **Recorrido conjunto**: crear o unirse con un ID de seis caracteres, 5 estaciones con retos y podio local demostrativo.
- **Telix**: mascota tipo Tamagotchi con 9 expresiones animadas, ánimo que decae por inactividad y 3 interacciones diarias.
- **Logros**: 14 medallas por tier (bronce, plata, oro y platino) con detalle, pista y progreso.
- **Buzón y avisos**: mensajes diarios de Telix, avisos de logros y toasts globales.
- **Carrera**: 6 áreas de la carrera y enlaces a admisión USM.
- **Perfil**: XP, niveles con título, rachas, historial, alias editable, hápticos y borrado de datos.

## Microjuegos de Ráfaga TEL

| Microjuego | Mecánica | Área |
| --- | --- | --- |
| Conecta la red | Elige el equipo que falta | Redes |
| Señal limpia | Compara medios de transmisión | Telecomunicaciones |
| ¿Ping o no ping? | Lee la salida de la terminal | Redes |
| Crimpado RJ45 | Completa el orden T568B | Hardware |
| Firewall | Clasifica tráfico legítimo y malicioso | Seguridad |
| Sintoniza la antena | Detén la aguja en la zona verde | Telecomunicaciones |
| Ruta de paquetes | Memoriza y repite la secuencia | Redes |
| Congestión de red | Envía 12 paquetes a tiempo | Redes |
| Conecta el cable | Arrastra cada cable a su puerto | Hardware |
| Atrapa el paquete | Toca los sanos, evita los infectados | Seguridad |
| Wi-Fi Boost | Arrastra el router hasta la señal completa | Telecomunicaciones |
| Contraseña fuerte | Arma una contraseña «Muy fuerte» | Seguridad |

## Sistema visual

Todo el arte está hecho en código: formas declarativas en `src/graphics/` que se renderizan con `react-native-svg` y se animan con Reanimated. Los mismos datos se exportan a SVG para el sistema de diseño.

- **Íconos**: 95 íconos de línea (`TelIcon`), que heredan el color del texto.
- **Medallas**: 35 glifos en 4 tiers más una variante crema, con estados desbloqueado, en progreso y bloqueado (`Medallion`).
- **Telix**: 9 expresiones y 4 poses, con respiración, parpadeo y ondas de señal (`Telix`).
- **Ilustraciones**: 10 escenas en tono claro y oscuro, además del mapa del campus (`Illustration`).
- **Fondos**: cielo estrellado, malla de red, ondas de señal y órbitas (`BrandBackdrop`).
- **Carga y feedback**: `SignalSpinner`, `OrbitSpinner`, `DotsLoader`, `Skeleton*`, `ProgressBar`, `SegmentedProgress`, `ProgressRing`, `Celebration` y `ToastHost`.
- **Tipografía**: Montserrat para títulos y Nunito Sans para texto (`@expo-google-fonts`).
- **Tokens**: colores, tiers, tipografía, espaciado, radios, sombras y movimiento en `src/theme/`.

El sistema de diseño vive en Claude Design: [SoyTEL Design System](https://claude.ai/artifact/GHwKfGt8Z2dzrpKqhRfqJZ). Es privado; su dueño debe compartirlo para que otros lo vean.

## Stack

- Expo SDK 54, React Native 0.81 (nueva arquitectura) y Expo Router 6 con rutas tipadas
- TypeScript estricto
- `react-native-svg` y Reanimated 4
- AsyncStorage (local-first)
- Jest 29, jest-expo y Testing Library

## Ejecutar

```powershell
npm install
npm run start
```

Después escanea el código QR con Expo Go en Android/iOS o usa:

```powershell
npm run android
npm run ios
npm run web
```

## Validación

```powershell
npm run typecheck
npm run lint
npm run test:ci
npx expo-doctor
```

Estado actual: TypeScript y lint limpios, 79 pruebas en verde (10 suites) y Expo Doctor 18/18.

## Diseño

```powershell
npm run design:export              # SVG y hoja de contacto en dist/design
npm run design:system -- <carpeta> # archivos del sistema de diseño para Claude Design
```

`design:system` escribe `project/**` (tokens, componentes, fuentes y guías) y `uploads/**` (178 activos). Después de subir los activos, ejecuta `npm run design:system -- <carpeta> --index ids.json` para generar `project/design-system.json`.

## Estructura

```text
app/                    Rutas Expo Router
app/(tabs)/             Inicio, Juegos, Carrera, Logros y Buzón
src/components/         UI SoyTEL (botones, tarjetas, cabeceras, hojas, chips)
src/components/graphics Telix, medallas, ilustraciones y fondos
src/components/feedback Spinners, skeletons, progreso, celebración y toasts
src/graphics/           Arte SVG declarativo (íconos, Telix, medallas, patrones)
src/data/               Preguntas, logros, historia, recorrido, carrera y tips
src/features/burst/     Motor, catálogo, lógica y 12 microjuegos de Ráfaga TEL
src/lib/                Progresión, logros, misiones, eventos y hápticos
src/storage/            Persistencia local (perfil, historia, buzón, ajustes)
src/theme/              Tokens de color, tipografía, espaciado y efectos
scripts/                Exportación SVG y generación del sistema de diseño
tests/                  Pruebas unitarias y de componentes
assets/brand/           Ícono, splash y fotos optimizadas
assets/                 Material de marca original
```

## Próximo paso online

El modo Recorrido ya tiene flujo local completo. Para sincronización real entre dispositivos, conectar el adaptador de servicios a Supabase Realtime con:

- Sesiones por código de recorrido.
- Participantes por alias.
- Checkpoints y puntuaciones autoritativas.
- Expiración de recorridos.
- Reconexión y prevención de duplicados.

No se guardan datos personales innecesarios en esta iteración.
