# Encargo de implementación: SoyTEL, multijugador consistente y corrección integral

## Mandato y contexto que debes conservar

Este encargo pertenece a la conversación EXISTENTE de Claude Code en Visual Studio Code sobre TELAPP/SoyTEL. Continúa esa conversación con todo su contexto: no abras otra sesión, no uses fork ni borres el historial. El usuario exige **Claude Opus 5.5 y esfuerzo MAX**, no otro modelo ni fallback. El selector de esta misma conversación ya se comprobó en Max. Si un límite de cuota impide seguir, informa del bloqueo, guarda un checkpoint útil y no cambies de modelo silenciosamente.

El objetivo imperativo es que **el multijugador funcione de forma fiable en tiempo real y todos los participantes y pantallas del stand converjan al mismo estado**, corrigiendo bugs. No interpretes “perfecto” como una promesa imposible bajo cualquier partición de red: tradúcelo a invariantes, SLO medidos, recuperación explícita y ausencia de éxito falso. Las ampliaciones visuales o nuevas mecánicas van después de la fiabilidad, integridad y pruebas.

Trabaja en el workspace TELAPP de esta sesión. La aplicación se llama SoyTEL, no existe una carpeta SOYTEL que debas localizar. Baseline auditado: `9eeda63ca123ee69eaefec8f671ffebc6956ae8a`, versión 3.0.0, rama `feat/sdk57-ruta-multijugador`, origin `https://github.com/crismoraga/SoyTEL.git`. upstream es otro repositorio y **no es el destino autorizado de push**. Revisa el estado real al empezar: no pierdas cambios posteriores ni archivos del usuario. Los únicos archivos añadidos por la auditoría al workspace son los documentos de `docs/audits/hermes-9eeda63/`.

Se creó un worktree separado para análisis/validaciones, pero **no debes sustituir esta conversación ni trabajar accidentalmente en ese worktree**. Hay un test audit-only allí que demuestra tres bugs; no lo copies con sus expectativas de comportamiento defectuoso como si fueran tests de aceptación.

### Avance previo que debes preservar, sin darlo por validado nuevamente

Tu conversación ya contiene el trabajo SDK57, MQTT cifrado y firmado, Android text/keyboard fixes, TEL Runner y siete personajes, Parejas TEL, expansión de microjuegos, tutoriales, ritmo sin apuro, pausa, Rutix y misiones, arte y kit de marca. Mantén marca, navegación, modo individual/offline local y todas las funciones existentes. No deshagas este progreso con una reescritura masiva. Los mensajes históricos que afirman publicación, APK o pruebas manuales son contexto histórico, no evidencia actual de que el mismo artefacto siga funcionando.

La auditoría actual comprobó de forma independiente: `npm run check` limpio (194 tests aprobados, 3 omitidos; 20 suites aprobadas y 1 omitida), instalación limpia, export web de producción y Expo Doctor 21/21. **Los 3 tests omitidos son MQTT opt-in, no Postgres**; no hay integración DB real verificada. La cobertura reportada por archivos cargados por Jest fue 66.44% statements, 57.11% branches, 61.24% functions y 68.51% lines; no equivale a todo el código. `npm audit --omit=dev` reportó 63 paquetes afectados (47 high,16 moderate), gran parte transitiva de toolchain. No ejecutes `npm audit fix --force`, no bajes Expo57 a Expo44/RN0.72 por una sugerencia automática.

## Documentos obligatorios y método

1. Lee `docs/audits/hermes-9eeda63/AUDITORIA.md` completo, por partes si hace falta, y `hallazgos.json`. Contienen **90 observaciones** con IDs, archivo:línea, escenario, impacto, arreglo propuesto y aceptación. Hay solapamientos y algunas hipótesis de política; no equivalen a 90 CVEs ni 90 reproducciones. `cobertura.json` distingue inventario de lectura: 449 archivos tracked inventariados, incluyendo metadata NO APP y assets binarios, no una falsa lectura línea a línea de todos.
2. Antes de cambiar nada, captura branch/HEAD/status, remotos y baseline. Verifica cada hallazgo contra el código vigente y reproduce los problemas de riesgo alto. Cambia la prioridad de ejecución de todos los RT a crítica para el producto, aunque su severidad técnica original sea P2/P3.
3. Crea `SEGUIMIENTO.md` con una fila textual o lista por TODOS los IDs: confirmado/reproducido, corregido, descartado con evidencia, o bloqueado con causa y próxima acción. Vincula archivo/test/commit. No ocultes pendientes bajo “todo listo”.
4. Aplica RED-GREEN-REFACTOR para defectos: añade la regresión que falla en el baseline, implementa el mínimo arreglo correcto, y prueba de nuevo. No relajes tests, elimines assertions ni pongas skips para hacer pasar check. Usa mocks solo para aislar fallos; no presentes un mock como ejecución SQL/MQTT real.
5. Trabaja por cambios coherentes: primero transporte/protocolo/state, luego durabilidad/UI, luego progreso/cuentas y resto. Mantén la arquitectura de simulación pura y las fronteras UI/red/storage claras. Actualiza tipos y validación runtime conjuntamente. Si migras protocolo, documenta compatibilidad y rechazo útil de clientes viejos.
6. Una recomendación puede refutarse: aporta evidencia, test y motivo; no copies ciegamente una propuesta de diseño. Algunas garantías requieren backend/broker propio y no se obtienen solo con retries o criptografía cliente.

## A. Multijugador: invariantes obligatorias

- **Autoridad única:** exactamente un driver vigente por sesión/epoch; todos los observers reciben el estado auténtico actual, no una copia estática. Un lease obsoleto no puede escribir/persistir/publicar ni borrar un lease nuevo. Cachea/serializa aperturas concurrentes de HostManager también en native.
- **Convergencia:** sesión/epoch, revisión, fase, estación, jugadores, checkedIn, resultados, respuesta aceptada y ranking coinciden tras drenar los mensajes válidos. Cada snapshot es validado antes de renderizar. Nunca aceptar regresiones silenciosas o un estado firmado de otra sesión.
- **Monotonicidad independiente del reloj:** usa IDs de acción estables, contador por sesión persistido o handshake de reanudación con high-water mark, y orden de publicación firmado. `Date.now()` no es un contador de protocolo. Rechaza números no finitos, fracciones, negativos y fuera de safe integer.
- **ACK de aplicación:** PUBACK MQTT no prueba que el host haya aplicado o guardado la acción. Distingue encolada, enviada, aceptada durable, rechazada con motivo y expirada. Reintento/reorder/replay no debe duplicar score, answer, checkin, resultado local ni recompensa. Un high-water mark simple no debe perder una acción genuina entregada fuera de orden: conserva eventId y respuesta idempotente por acción, o reordena explícitamente.
- **Durabilidad:** si muestras confirmación definitiva, la mutación crítica y su dedup/ACK deben sobrevivir a muerte/reinicio del host. Serializa guarda/ACK y trata fallos de storage. Pending crítico debe sobrevivir a restart del cliente o declarar claramente que no se confirmó; no borrarlo silenciosamente.
- **Identidad y anti-replay:** vínculo autenticado clientId/topic/epoch/challenge en JOIN, prueba de posesión fresca e idempotencia de reintentos. Un ciphertext observado no crea clones ni ocupa plazas nuevas, no renueva presencia para siempre ni revive una identidad expulsada. Mantén pinning por QR/fingerprint y detección de impostor; no elimines firmas Ed25519 para resolver problemas de sync.
- **Disponibilidad distinta de autoridad:** preserva las llaves pinned mientras buscas brokers. Hello conocido no elimina un deadline global de join/welcome. CONNACK no es ready de la aplicación: valida SUBACK y fallos ACL. Broker inaccesible/ruta extinta debe terminar en error recuperable acotado, no spinner infinito.
- **Retained:** coalesce state/hello offline por topic; no reenvíes snapshots antiguos después del actual al reconectar. Dup/replay no renueva liveness ni mueve el reloj. Resuelve frescura inicial y resync sin confiar ciegamente en hora local. Limpia retained al finalizar/expirar cuando proceda.
- **Clock:** el host decide los deadlines; usa reloj monotónico para elapsed local y sincronización estimada con incertidumbre/delay. No recalcules offset con un replay. Late answers y pause/background tienen política explícita y justa. No afirmar sincronización física de relojes al milisegundo sobre red pública.
- **Liveness/lifecycle:** reconectar en foreground/foco, detectar stale, backoff con jitter y límites, liberar listeners/timers/sockets, impedir tormentas de joins/snapshots y cupos fantasma. Resume auth debe reparar jugador ausente o rechazar con causa, nunca joined sin me indefinido.
- **Transiciones de juego:** al pasar B213→hall→quiz, resolver el proyecto activo de forma explícita y exactamente una vez, incluso banner/pausa/summary. No desmontarlo y perder score. No permitir acción incompatible de una fase vieja ni silenciosamente convertir fallo de envío en 0 puntos.
- **Seguridad de frontera:** allowlist real de game/action/phase; mapas seguros; límites de payload/paquetes/colas; validar bases64, longitudes de claves y firmas. Rechazar `__proto__`, `constructor`, arrays/null y tipos incorrectos. Crypto válido no implica datos estructuralmente válidos.
- **Confidencialidad:** shared key no otorga firma de host. Kick detiene acciones; si prometes revocar lectura futura, debes rotar epoch/key y distribuir solo a miembros válidos. Si no lo implementas, documenta ese límite. Nunca embebas credenciales MQTT administrativas en EXPO_PUBLIC_*.

### Defectos concretos a resolver (ver evidencia ampliada)

RT-01 allowlist y ranking; RT-02 replay/same-rev/clock; RT-03 JOIN replay y cupos; RT-04 join sin deadline después de pin; RT-05 CONNACK/outbox/inflight; RT-06 confirmación no durable y resume sin jugador; RT-07 split-brain/aperturas/lease; RT-08 leave/cambio de ruta offline/cupos; RT-09 pérdida silenciosa de pending y éxito falso UI; RT-10 deep links con arrays/tokens normalizados erróneamente; RT-11 contador por reloj; RT-12 schemas/buffer límites; RT-13 podio y premio local transaccional; RT-14 quiet zone/alternativa accesible QR; RT-15 SUBACK/ready; RT-16 loading atrapado por persistencia y doble submit; RT-17 revocación lectura/kick; RT-18 proyecto vivo al avanzar; RT-19 observer del stand.

Tres reproducciones del coordinador:
- Dos game IDs inexistentes dieron 2000 puntos (RT-01).
- Replay auténtico misma revisión retrocedió hostNow 8495 ms con reloj virtual (RT-02).
- Orden capturado de PUBLISH al reconnect fue NEW, NEW, OLD (RT-05).
Las regresiones corregidas deben exigir IDs rechazados, replay sin efecto y último retained NEW sin nueva publicación duplicada por el propio replay loop.

## B. Matriz de pruebas multijugador, no negociable

Crea un harness determinista con HostController y al menos tres MemberController reales, cifrado/firma reales, reloj virtual e inyección de almacenamiento y transporte. No basta LocalBus síncrono con entrega perfecta. El transporte debe permitir drop/delay/duplicate/reorder por destinatario, retained viejo, cierres abruptos, broker change y ACK perdidos. Incluye observer de segundo stand. Guarda trace saneado con session/epoch/rev/eventId/ACK/phase, sin llaves/token/contactos.

Ejecuta TODOS estos escenarios con invariantes y aserciones explícitas:
1. Ruta completa host+3 miembros+observer: lobby, checkin B215, countdown, juego, resultados, B213, proyectos, hall, trivia y podio; mismo ranking y scores.
2. Código manual y QR pinned, late join permitido/prohibido por fase y welcome duplicado.
3. Duplicar score/checkin/answer, reordenar acciones diferentes y perder el ACK; una sola aplicación y misma respuesta idempotente.
4. Reordenar snapshots entre miembros; jamás retroceden rev/epoch ni estado y al sanar convergen.
5. Replay exacto y replay misma rev con now antiguo; no refrescan lastStateAt ni desplazan offset.
6. Host offline prolongado, varios estados en outbox e inflight, reconnect; retained final es el vigente.
7. Miembro pierde conectividad antes/después del envío y antes del ACK; recuperación sin éxito falso ni doble score.
8. Host cambia broker antes del welcome después de hello; miembro busca preservando pin y termina éxito/error en plazo.
9. Broker acepta CONNECT pero deniega SUBSCRIBE; ready no se anuncia y hay diagnóstico/fallback.
10. Matar host inmediatamente después de welcome, score y answer confirmados; restart conserva lo durable y resume repara identidad.
11. Matar/restaurar miembro con pending; replay seguro y exactamente un efecto, o fallo explícito cuando la fase expiró.
12. Dos host opens simultáneos, dos pestañas sin Web Locks, steal/takeover y owner obsoleto que release/persiste tarde; una autoridad y observer actualizado.
13. Salir offline y cambiar de sala: abandono/TTL/reintentos no agotan cupos ni crean fantasmas.
14. Join replay bajo otro topic, replay después de leave/kick, spam de reservas y payloads inválidos; identidad y cupos protegidos.
15. Clock skew ±5 minutos, cambio de hora hacia atrás y restart; contador monotónico, deadlines justos y no bloqueo de sesión.
16. Suspender/reanudar web/Android, pantalla bloqueada, foco y timers throttled; resync y cleanup sin recursos huérfanos. No simules nativo y lo llames prueba física.
17. Advance B213→hall→quiz durante banner/etapa/summary/pausa: finalización acordada, score ACK y ausencia de pérdida/doble callback.
18. Podio montado dos veces y storage falla entre pasos; un resultado y una recompensa, reintento tras fallo.
19. Capacity/load: al menos 10 clientes en la prueba extendida y el límite configurado cuando viable; medir tráfico, cola, memoria y p95 de convergencia sin falsos claims de capacidad ilimitada.
20. Deep links inválidos/repetidos, incompatible protocol, host expira y retained histórico, kick/rekey si aplica; error útil, sin crash ni downgrade silencioso de seguridad.

Añade pruebas MQTT real en broker/local namespace aislado (Mosquitto/Aedes o equivalente con WS) y al menos host+3 clientes, incluidas caída/reconexión y permisos. No publiques la campaña de fault injection en topics productivos ni uses usuarios reales. Si Docker/emulador/broker no están disponibles, usa una alternativa local permitida o registra bloqueado; no sustituir por outputs ficticios. E2E web con varias sesiones independientes bajo CSP real: UI host/member/observer, checkins y podio. Android físico/emulador y iOS se prueban según disponibilidad, con limitaciones explícitas.

Define el presupuesto de sincronización antes de medir: como objetivo inicial en transporte local/nominal, p95 de actualización ≤500 ms, y convergencia completa ≤2 s desde transporte/autoridad recuperados y backlog drenado. Revisa estos objetivos si el entorno real requiere otro contrato; documenta números medidos, latencia de red, fase y tamaño del grupo. Durante partición no mostrar consistencia instantánea ni confirmar lo no durable.

## C. Resto de bugs: completa el ledger de todas las áreas

Después del core multiplayer, arregla todos los P1 y cubre los P2/P3 viables. Los detalles y tests de aceptación están en cada ID del informe; no omitas un área:

### Progreso/recompensas y cuentas

- UXS-01/05, BE-04: cola/mutex por store, generation/epoch de sesión, reset barrier y abort/drain de operaciones; escritores viejos no resucitan datos ni cruzan A→B. Varias partidas simultáneas no pierden XP/historial.
- UXS-03, RT-13, GAME-01/02/03/04: transacción/ledger de premios con IDs únicos; no marcar reclamado/recorded antes de entregar durable; doble tap/reentrada/doble montaje no multiplica XP; un guardado viejo no desmonta partida nueva.
- UXS-02: decaimiento de Rutix aplicado exactamente una vez; guardar alias no repite 80→62→44.
- BE-01: estado efectivo y regla SQL de consentimiento al cambiar curso/contacto, incluidos PATCH concurrentes; no mantener contacto de 7b/8b sin autorización requerida. BE-19 es política de edad desconocida, no inventes una obligación legal: usa minimización de datos y documenta/consulta una decisión real si cambia conducta sensible.
- BE-02/03/10: presupuesto de XP persistente/atómico, burst no renovado por solicitud, monotonicidad bajo concurrencia, catálogo de logros y límite global. Un backend que confía en scores client-side no puede certificar anti-cheat total: separa verificables/no verificables si corresponde.
- BE-05/06: no éxito persistente falso con vault efímero; no perder cuenta tras INSERT+fallo de rank/transport/storage; idempotencia segura del alta y código de recuperación entregable. Conserva ciphertext recuperable ante fallos transitorios.
- BE-07/15/16: auth/mutación y revocación coherentes, recuperación single-flight, política explícita de rotación del código comprometido sin dejar al usuario atrapado.
- BE-08/09/18/20: restaurar estadísticas/racha con fechas válidas, dirty during sync y retry/backoff, identityDirty protegido, timeout que cubra lectura completa de cuerpo.
- BE-11/12/13/14/17: presupuesto y cache de lecturas, límite real de bytes streaming, UUID/limit validados, export paginado explícito, fallo de decrypt observable sin exponer datos.

### Juegos/aprendizaje

- GAME-05/06: lifecycle y pausa detienen el reloj y la finalización según política en modos individuales; las fases compartidas no pueden pausar de forma incoherente por un solo cliente.
- GAME-07: semillas de Atrapa el paquete generan suficientes objetivos alcanzables; prueba múltiples seeds y extremos.
- GAME-08/09/10/11/12/13/14: curva IA coherente con óptimo visual, XP mostrado igual al otorgado, lectura de feedback no descarta proyectos, pistas no dan accuracy perfecta, score máximo consistente, textos de envíos y duración real.
- GAME-15: Wi-Fi abierta no equivale a que HTTPS/E2E se puedan leer sin más; explicación precisa, sin enseñar falsedades por simplificación.

### UX, tema y accesibilidad

UXS-04/07/08/09: hydration no pisa cambios recientes; inbox serializado; validación de estructuras persistidas, migración/defaults seguros; hook focus latest-wins y errores visibles. UXS-06: agregados de progreso independientes de historial recortado a 200. UXS-10: tutorial Rutix no depende de invitación ausente. UXS-11/12/14: una fuente de verdad del tema, escucha sistema y tabs, persistencia con rollback/error. UXS-13/15/16/17/19: contraste medido claro/oscuro, font scaling 200%, hojas desplazables con acciones alcanzables en 320x320, radios/tabs correctos, teclado/foco/TalkBack/NVDA/VoiceOver donde disponible, minimal motion aplicado también al wrapper/baile. UXS-18: día lógico único y refresh medianoche/foreground con DST/timezones; migración conservadora.

### Publicación, CI y mantenimiento

REL-01/02: release Android falla cerrado si falta firma y se verifica certificado antes de etiquetar APK; no distribuir debug como release. CI `npm ci`, check, build web, nuevos tests multi-client y presupuesto; scripts release gated. No cambies protecciones remotas del repositorio sin permiso específico.
REL-03/05/06: pruebas handlers/SQL en Postgres efímero, migraciones explícitas por entorno versionadas/transaccionales y rollback; nunca leer fallback production ni ejecutar migraciones reales para esta tarea.
REL-04/09/10: secretos públicos vs privados, ACL/tokens cliente temporales si backend lo permite, CSP allowlist coordinada con brokers/API/preview. Preview no escribe a DB productiva.
REL-07/08/11/12: triage advisories con alcance/runtime/toolchain, versiones build fijadas, medición bundle/fonts/startup y optimización segura; no borrar originales/diseño sin trazabilidad.
REL-13/14/15/16/17: PWA/offline contrato explícito o shell seguro sin cachear API privada; docs y memory-bank actualizados, HTML parsing/assertions metadata, brand PNG real o modo HTML-only explícito, arquitecturas validadas y comandos no concatenados con input libre.

## D. Expansiones permitidas solo después de fiabilidad

No agregues arbitrariamente más juegos antes de cerrar bugs. Prioriza mejoras que ayuden a operar la ruta: panel de conectividad/readiness y última revisión, acciones de reintento con motivo, indicador honesto pending/confirmado, observer útil, diagnóstico exportable sin PII/claves, aviso de reconexión y reglas de entrada/avance explicadas. Para aprendizaje, feedback correcto, guía accesible y dificultad ajustada medible, no castigos por lag. Añade extensiones acotadas solo con sus tests y sin dispersar arquitectura; propuestas grandes quedan documentadas con dependencias/costo y decisión, no como stubs que aparentan funcionar.

## E. Seguridad del encargo

Autorizado: código, tests, documentación, dependencias compatibles, builds/pruebas locales aisladas, commits y push normal al origin indicado. **No autorizado por este encargo:** deploy productivo/manual, migración de DB real, emails/contactos a usuarios, cambios de facturación, exfiltración, publicación de secretos, force-push, borrar trabajo del usuario, reset/clean destructivo, alterar otro proyecto o modificar permisos para evadir controles. No cambies el modo de permisos ya establecido solo para facilitarte el trabajo. Si una prueba requiere secretos, usa vault/config segura sin imprimir valores y pide intervención para un bloqueo real.

## F. Gates de salida, revisión independiente y GitHub

1. `npm run check`, build web y Expo Doctor deben pasar. Nuevas regresiones/fault injection pasan sin tolerar bugs; no contar los audit-only baseline probes como tests correctivos.
2. Integración MQTT aislada y E2E multi-sesión prueban convergencia real y los fallos prioritarios. No llamar “multijugador verificado” si solo pasan tests puros. Postgres/native/capacidad no disponibles se declaran bloqueados y la publicación de esa garantía queda pendiente.
3. Obtén revisión de contexto fresco de un agente que NO haya implementado las modificaciones. Debe inspeccionar diff completo por archivos, auth/consent, idempotencia, reorder/retry, persistencia, compatibilidad y tests. Corrige errores de lógica/seguridad y revalida. Registra la revisión y sus límites, no auto-certifiques con adjetivos.
4. Revisa diff/estado; stagea explícitamente solo archivos de esta tarea, incluidas auditoría y seguimiento. No `git add -A` si pudiera incluir .env, APKs, claves o cambios ajenos. Convencional commits separados por causa/área, descriptivos; nunca etiquetar verified sin evidencia real de revisión.
5. Haz commit y luego push normal de la rama de trabajo actual a **origin/crismoraga/SoyTEL**, no upstream; respeta posibles cambios de branch hechos por el usuario. No force-push ni merge a main de forma automática. Si conflicto remoto, fetch/compara y resuelve sin pisar trabajo ajeno, o informa el bloqueo.
6. Verifica cada push con `git ls-remote origin refs/heads/<rama>` y/o `gh api repos/crismoraga/SoyTEL/commits/<sha>`: el SHA remoto exacto debe igualar el local esperado. Comprueba CI real si existe; no declarar verde un job que no terminó o no se ejecutó.
7. Entrega `RESULTADOS.md`: commits/URLs y branch, bugs corregidos por ID, tests reales con comandos y conteos, escenarios multiplayer/SLO medidos, revisión independiente, pendientes por ID/causa, compatibilidad/migración y forma de rollback no destructivo. No basta “mejoré la app”.

Empieza ahora por la revisión del estado y los documentos, construye los tests de fallo del multijugador y procede a implementar. No te detengas en un plan, un checklist genérico o un prompt: el encargo es código probado, documentación honesta y commit/push verificados, con multijugador primero.
