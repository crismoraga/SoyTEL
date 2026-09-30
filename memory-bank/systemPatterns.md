# System Patterns

## Architectural Patterns

- Expo Router por rutas: `app/(tabs)/` agrupa las pestañas y cada modo de juego es una ruta a pantalla completa en `app/`.
- Local-first: `src/storage/` encapsula AsyncStorage (perfil, historia, buzón, carrera, ajustes); las pantallas no conocen claves.
- Contenido como datos: preguntas, logros, capítulos, estaciones, áreas y tips viven en `src/data/`.
- Arte como datos: `src/graphics/` describe formas SVG (`Drawing`/`Shape`) que usan tanto `ShapeLayer` en la app como los scripts de exportación.
- Lógica pura y testeada: XP y niveles (`src/lib/progression.ts`), logros (`src/lib/achievements.ts`), misiones y lógica de microjuegos (`src/features/burst/logic.ts`).

## Design Patterns

- Design system: `Screen`, `AppHeader`, `TelText`, `TelCard`, `TelButton`, `Chips`, `Blocks`, `Quiz`, `Sheet` y `TabBar` usan los tokens de `src/theme/`.
- Microjuegos enchufables: cada juego recibe `MicroGameProps` (`durationSeconds`, `active`, `level`, `onAnswer`) y se registra en `catalog.ts` y `registry.tsx`.
- Stores reactivos con `useSyncExternalStore` para ajustes y buzón; un bus de eventos (`src/lib/events.ts`) dispara toasts globales.
- `recordGameResult` guarda la sesión, evalúa logros y devuelve un `GameOutcome` que la pantalla usa para celebrar.

## Common Idioms

- Todas las pantallas de juego tienen fases de intro, juego, feedback y final (reducers en Ráfaga).
- Cargas con skeletons y `useFocusData`; explicaciones largas con `useScrollToEnd` para que el feedback quede visible.
- Íconos solo con `TelIcon` (el color se hereda vía `currentColor`).
- IDs de recorrido usan seis caracteres sin 0/1 para reducir errores de lectura.
