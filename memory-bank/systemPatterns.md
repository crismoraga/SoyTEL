# System Patterns

## Architectural Patterns

- Expo Router por rutas: `app/` contiene cada pantalla jugable como ruta declarativa.
- Local-first: `src/storage/profile.ts` encapsula AsyncStorage y las reglas de persistencia.
- Contenido como datos: preguntas y logros viven en `src/data/`, separados de la UI.
- Lógica pura: XP, niveles e IDs de recorrido están en `src/lib/progression.ts` y tienen tests.

## Design Patterns

- Design system mínimo: `Screen`, `TelText`, `TelCard` y `TelButton` estandarizan color, tipografía, targets táctiles y estados.
- Repositorio local: las pantallas no conocen claves de AsyncStorage directamente.
- Estado por pantalla: cada juego mantiene su ciclo local y entrega un `GameResult` al repositorio.

## Common Idioms

- Todas las pantallas incluyen estados de inicio, juego, feedback o final.
- Los resultados se guardan al completar una sesión; no se bloquea el juego por red.
- IDs de recorrido usan seis caracteres sin 0/1 para reducir errores de lectura.
