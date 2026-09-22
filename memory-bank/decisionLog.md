# Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-21 | Usar Expo SDK 54 + Expo Router + TypeScript | Base multiplataforma Android/iOS con navegación simple y tipado estricto. |
| 2026-09-21 | Implementar progreso local-first con AsyncStorage | Permite probar y retener usuarios sin exigir registro ni conexión. |
| 2026-09-21 | Mantener Recorrido como demo local con ID | Entrega jugabilidad inmediata y deja una frontera clara para Supabase Realtime. |
| 2026-09-21 | Omitir soporte web por conflicto React DOM | El objetivo es móvil; evitar una dependencia opcional previene inestabilidad de peers. |
| 2026-09-21 | Usar Jest 29 + jest-expo | Son las versiones recomendadas por Expo SDK 54 y validan reglas puras. |

