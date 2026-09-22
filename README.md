# SoyTEL

Aplicación móvil Expo/React Native para aprender Ingeniería Civil Telemática mediante sesiones lúdicas de 15–20 minutos.

## Experiencia incluida

- **Onboarding**: tres láminas de bienvenida y elección de alias, sin cuentas ni correos.
- **Ráfaga TEL**: 6 microretos al azar de un set de 8 (trivia, sintonía por timing, memoria de secuencias y tap-race), con timer, puntaje y hápticos.
- **Quién quiere ser Telemático**: trivia progresiva de 10 preguntas con comodín 50:50, puntaje y explicaciones.
- **Historia: La señal perdida**: 3 capítulos narrativos con Telix, diálogos y retos por área (redes, teleco, seguridad) con desbloqueo progresivo.
- **Recorrido conjunto**: creación o unión mediante ID de seis caracteres, checkpoints y ranking local demostrativo.
- **Telix**: mascota Tamagotchi ligera con ánimo que decae por inactividad, límite de 3 interacciones diarias y logro por 7 días de cuidado.
- **Logros**: sala de trofeos con medallas por tier (bronce/plata/oro/platino) y barras de progreso.
- **Perfil**: XP, niveles, rachas, historial, alias editable, ajuste de hápticos y borrado de datos.

## Stack

- Expo SDK 54
- React Native 0.81
- Expo Router
- TypeScript estricto
- AsyncStorage para persistencia local
- Jest + jest-expo para pruebas

## Ejecutar

```powershell
npm install
npm run start
```

Después escanea el código QR con Expo Go en Android/iOS o usa:

```powershell
npm run android
npm run ios
```

## Validación

```powershell
npm run typecheck
npm run test:ci
```

Estado actual: lint limpio, TypeScript en verde, 16 pruebas pasando y Expo Doctor 18/18.

## Estructura

```text
app/                  Rutas Expo Router (juegos, historia, perfil)
src/components/       Sistema UI SoyTEL
src/data/             Preguntas, logros y capítulos de historia
src/features/burst/   Motor y microjuegos de Ráfaga TEL
src/lib/              Progresión, IDs y feedback háptico
src/storage/          Persistencia local (perfil, historia, ajustes)
src/theme/            Colores, tipografía, espaciado
tests/                Pruebas unitarias
assets/               Identidad visual y material de marca
```

## Próximo paso online

El modo Recorrido ya tiene flujo local completo. Para sincronización real entre dispositivos, conectar el adaptador de servicios a Supabase Realtime con:

- Sesiones por código de recorrido.
- Participantes por alias.
- Checkpoints y puntuaciones autoritativas.
- Expiración de recorridos.
- Reconexión y prevención de duplicados.

No se guardan datos personales innecesarios en esta iteración.
