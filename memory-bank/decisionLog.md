> **Histórico.** Notas de trabajo de versiones anteriores de SoyTEL. No describen el estado actual: para eso están el [README](../README.md), [docs/PRODUCCION.md](../docs/PRODUCCION.md) y [docs/RUTA-PROTOCOLO.md](../docs/RUTA-PROTOCOLO.md).

# Decision Log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-09-21 | Usar Expo SDK 54 + Expo Router + TypeScript | Base multiplataforma Android/iOS con navegación simple y tipado estricto. |
| 2026-09-21 | Implementar progreso local-first con AsyncStorage | Permite probar y retener usuarios sin exigir registro ni conexión. |
| 2026-09-21 | Mantener Recorrido como demo local con ID | Entrega jugabilidad inmediata y deja una frontera clara para Supabase Realtime. |
| 2026-09-21 | Omitir soporte web por conflicto React DOM | El objetivo es móvil; evitar una dependencia opcional previene inestabilidad de peers. |
| 2026-09-21 | Usar Jest 29 + jest-expo | Son las versiones recomendadas por Expo SDK 54 y validan reglas puras. |
| 2026-09-29 | Arte como SVG declarativo en código (`src/graphics/`) | Los PNG de marca son RGB sin alfa y no sirven como sprites; las formas como datos se renderizan en la app, se animan y se exportan al sistema de diseño desde una sola fuente. |
| 2026-09-29 | Reanimated para animaciones de UI y juegos | Corre en el hilo de UI (60 fps) y ya era dependencia de Expo SDK 54. |
| 2026-09-29 | Montserrat + Nunito Sans vía @expo-google-fonts | Tipografía de marca coherente entre plataformas; `setFontsLoaded` evita mezclar fuentes personalizadas con `fontWeight`. |
| 2026-09-29 | Navegación por pestañas (Inicio, Juegos, Carrera, Logros, Buzón) | Acceso directo a los modos en sesiones cortas; las pantallas de juego quedan como rutas a pantalla completa. |
| 2026-09-29 | Evaluar logros con una única función pura | Facilita probarlos y evita condiciones repartidas por las pantallas. |
| 2026-09-29 | Microjuegos de arrastre con PanResponder y modo táctil alternativo | Evita dependencias extra de gestos y mantiene accesibilidad para quien no puede arrastrar. |
| 2026-09-29 | Usar export web solo para QA visual automatizada | react-native-web ya estaba instalado; permite revisar pantallas con Chrome headless sin emulador. El objetivo sigue siendo móvil. |
| 2026-09-29 | Sistema de diseño en Claude Design generado por script | `scripts/build-design-system.js` deriva tokens, componentes y activos del código, así el sistema no se desalinea de la app. |
