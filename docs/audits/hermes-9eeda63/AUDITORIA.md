# SoyTEL: auditoría de robustez y plan de mejora

Baseline: `9eeda63ca123ee69eaefec8f671ffebc6956ae8a`, aplicación 3.0.0, rama `feat/sdk57-ruta-multijugador`, remoto de trabajo `crismoraga/SoyTEL`.

## Prioridad del usuario

Multijugador en tiempo real, sincronización entre todos los participantes y pantallas del stand, reconexión y corrección de bugs. Las ampliaciones visuales/funcionales no pueden desplazar ese objetivo. La implementación debe hacerse en la conversación existente de Claude Code, Opus 5.5 y esfuerzo MAX, conservando el contexto previo.

## Resumen y alcance

- 90 observaciones identificadas por ID: 16 P1, 60 P2 y 14 P3. No son 90 vulnerabilidades independientes ni todos bugs reproducidos: incluyen mejoras, hipótesis de política y solapamientos.
- Se inventariaron los 449 archivos tracked. El inventario agregado y las lecturas adicionales alcanzan 449. La clasificación de 154 archivos de agentes en `.github` NO APP y de assets binarios no equivale a revisión línea a línea ni a inspección visual. Los informes por área contienen límites de lectura completa/parcial.
- Se excluyeron secretos, `.env`, directorios de dependencias/build de la auditoría de fuente; se inspeccionaron dependencias específicas solo cuando ayudaron a verificar un comportamiento. No se probaron bases de datos productivas, ni se desplegó, ni se ejecutaron migraciones.

## Verificación ejecutada por el coordinador

- `npm run check`: TypeScript app y API, lint correctos; 194 tests aprobados, 3 omitidos; 20 suites aprobadas, 1 omitida.
- Los tres skips son MQTT opt-in (`tests/live-broker.test.ts`), **NO integración Postgres**. No existe cobertura de integración DB real verificada en el baseline.
- `npm ci` en worktree aislado: instalación completada.
- `npm run build:web`: export de producción completado.
- `npx --yes expo-doctor`: 21/21 controles.
- Cobertura de archivos cargados por Jest: statements 66.44%, branches 57.11%, functions 61.24%, lines 68.51%. No equivale a cobertura total del proyecto.
- `npm audit --omit=dev`: 63 paquetes afectados, 47 high y 16 moderate, 0 critical. Incluye toolchain transitivo y sugerencias incompatibles; no usar `npm audit fix --force` ni presentar el conteo como fallas productivas explotables.
- Prueba autenticada sin herramientas confirmó `canonicalModel=claude-opus-5-5`, firstParty. El selector de la sesión existente fue cambiado de Extra high a Max y leído de nuevo con captura/OCR. No se sustituyó el modelo.

### Reproducciones independientes de multijugador

Tres pruebas de auditoría en el worktree aislado ejecutadas por el coordinador, resultado real 3/3:

1. RT-01: dos IDs de juegos inventados añadieron **2000 puntos** al total del jugador.
2. RT-02: replay de un snapshot auténtico de igual revisión hizo retroceder `hostNow()` **8495 ms** en el reloj virtual del test.
3. RT-05: al recibir CONNACK con cola offline y callback de publicación fresca, el orden capturado fue **NEW, NEW, OLD**, dejando el payload antiguo al final.

Estos tests pasan porque **reproducen los defects del baseline**, no porque validen correcciones. Convertirlos en regresiones con expectativas contrarias después de fijar cada bug; no incorporarlos tal cual a la suite final.

## Orden de ejecución

1. Resolver y probar RT-01 a RT-19 con prioridad de convergencia, autoridad única, ACK durable, monotonicidad, failover y lifecycle. Mantener o migrar el protocolo con rechazo explícito de versiones incompatibles.
2. Resolver P1 de integridad de progreso, recompensas, consentimiento, cuentas y publicación. Una pérdida de datos o puntaje no se compensa con una pantalla bonita.
3. P2 de errores, accesibilidad, persistencia, contenido y build; luego P3 y expansiones acotadas.
4. No eliminar ni reinterpretar observaciones por intuición: reproducir, arreglar o justificar descarte con evidencia. Requerir ledger por ID y pruebas.

## Solapamientos que deben unificarse en la implementación

- BE-04 y UXS-05: generaciones de sesión/reset y escrituras tardías; comparten una causa pero cubren identidades y stores distintos.
- UXS-01, GAME-03, GAME-04, RT-13: serialización/idempotencia de resultados y premios, con distintas entradas UI/route.
- UXS-03, GAME-01, GAME-02: reclamo de recompensas y diario; no asumir que un arreglo del contador cubre todos los caminos.
- BE-02, BE-03, BE-10, RT-01: integridad del ranking en API y sala; son fronteras y presupuestos distintos.
- RT-02, RT-05, RT-06, RT-11, RT-19: monotonicidad, retained, durabilidad, contador de acciones y observers.
- REL-04, REL-09, REL-10: configuración pública, ACL y política de conexión; no confundir cifrado de mensajes con autorización MQTT.

## Límites pendientes

Las pruebas multi-cliente bajo fallos, broker MQTT aislado real, E2E web, Postgres efímero y verificación física Android/iOS todavía deben realizarse. No se garantiza consistencia instantánea durante particiones ni confidencialidad frente a un exmiembro que conserva una shared key sin rotación. Se deben declarar SLO medidos y semántica de recuperación, no prometer “perfecto” sin condiciones.

## Observaciones completas


# Área: backend

## BE-01 [P1] Cambiar solamente el curso permite conservar contacto de 7°/8° sin autorización de apoderado

Confianza original del revisor: confirmado estático. 

### Evidencia
- `api/_lib/players.ts:83`: grade se valida independientemente.
- `api/_lib/players.ts:96`: La autorización solo se comprueba si se toca contact/contactConsent/guardianConsent.
- `api/v1/me.ts:19`: Valida sobre la fila leída previamente; UPDATE posterior por id.
- `scripts/db/schema.sql:31`: La única restricción de consentimiento no contempla curso ni guardian_consent.
- `api/v1/admin/players.ts:28`: La exportación selecciona todo contact_consent sin comprobar tutor.

### Escenario
Crear con grade=4m, contacto autorizado y guardianConsent=false; PATCH /me {"grade":"7b"}. La respuesta de validación es ok con solo grade; quedan contacto y consentimiento previos. Variante concurrente: PATCH de curso y PATCH de contacto validan ambos contra el curso anterior.

### Impacto
Persistencia y exportación de datos de contacto de alumnos a quienes la propia política requiere tutor. El formulario normal envía todo, pero no protege la API frente al PATCH parcial.

### Corrección propuesta
Validar el estado efectivo completo en cualquier cambio de curso/contacto; exigir tutor o borrar contacto al pasar a curso protegido. Aplicar la invariancia en una operación atómica y restricción SQL para evitar TOCTOU.

### Aceptación
Registro sin tutor en 7b/8b falla; cambio 4m→7b/8b con contacto existente no deja contacto no autorizado; prueba con dos PATCH simultáneos mantiene invariancia; admin no exporta filas inconsistentes.

## BE-02 [P1] La franquicia de XP se renueva por cada sync: el anti-cheat se elude sin jugar

Confianza original del revisor: confirmado estático. 

### Evidencia
- `src/account/rules.ts:166`: Alta permite 6000 XP; cada allowedXp agrega 400 más 3/seg.
- `api/v1/sync.ts:21`: El cálculo se rehace usando el XP anterior en cada solicitud.
- `api/v1/sync.ts:14`: Se permiten 30 sync por 60 segundos.
- `api/v1/sync.ts:23`: Enviar exactamente allowed no añade flag.
- `api/v1/players.ts:20`: El XP inicial enviado por cliente solo se topa, no se verifica.

### Escenario
Obtener una cuenta con 6000 XP declarados y enviar repetidamente progress.xp=XP_actual+400, con resto de métricas plausible. Incluso con elapsedSeconds=0 cada solicitud suma 400 y no se marca. Cálculo aislado: 30 solicitudes suman 12000 XP, final 18000; el tiempo transcurrido suma además.

### Impacto
Ranking manipulable desde un cliente/API sin evidencia de partidas; límite de velocidad efectivo dominado por frecuencia de llamadas, no por juego. flags no corrige este recorrido.

### Corrección propuesta
Usar presupuesto persistente tipo token-bucket con burst único y recarga temporal, consumido atómicamente. Para premios/invitaciones basados en puntaje, aceptar resultados verificables/idempotentes o separar XP no verificado del competitivo; revisar importación inicial.

### Aceptación
Variar frecuencia de sync no modifica el máximo aceptable por el mismo intervalo; 30 llamadas inmediatas consumen una sola franquicia. Un resultado repetido no suma. Política de XP importado documentada y cubierta.

## BE-03 [P1] Dos sync concurrentes pueden bajar el XP pese al contrato monotónico

Confianza original del revisor: confirmado estático. 

### Evidencia
- `api/v1/sync.ts:12`: requirePlayer lee una instantánea fuera del UPDATE.
- `api/v1/sync.ts:22`: Math.max usa la instantánea leída.
- `api/v1/sync.ts:27`: UPDATE asigna xp=$1 y level=$2, sin greatest/CAS/lock.
- `api/_lib/db.ts:17`: Cada query es una llamada independiente.

### Escenario
Dos peticiones válidas leen xp=1000; una calcula 1400 y otra 1100. Si el UPDATE de 1100 llega último, la BD termina con 1100. El rate-limit permite ambas. No se ejecutó Postgres: es un interleaving deducido del código.

### Impacto
Pérdida de progreso ya confirmado, nivel regresivo y ranking incorrecto. También elapsed/flags se calcula sobre filas obsoletas.

### Corrección propuesta
Consumir presupuesto y actualizar progreso en transacción con bloqueo de fila o UPDATE atómico/CAS que derive XP y nivel del estado actual. No basta greatest(xp,$1) si level y presupuesto quedan inconsistentes.

### Aceptación
Prueba de integración con barrera después de ambas lecturas y orden invertido de commits: XP nunca baja y level corresponde al XP final; presupuesto anti-cheat no se duplica.

## BE-04 [P1] Respuestas y escrituras tardías atraviesan logout, borrado local y cambio de cuenta

Confianza original del revisor: confirmado estático. 

### Evidencia
- `src/account/store.ts:204`: forgetAccount borra stored y timer, no cancela solicitudes ni escrituras.
- `src/account/store.ts:217`: refreshAccount usa el token previo y al volver mezcla con stored global actual.
- `src/account/store.ts:163`: editAccount hace la misma mezcla con respuesta antigua.
- `src/account/store.ts:246`: syncProgress pendiente al volver sustituye player/rank del stored actual.
- `src/account/store.ts:99`: persist guarda en vault sin barrera de generación/serialización.
- `src/security/vault.ts:155`: setItem se ejecuta después de await sealText.
- `src/storage/reset.ts:23`: Borrado local no drena escrituras ya iniciadas.

### Escenario
A inicia sync/PATCH/refresh. Antes de la respuesta se recupera B; cuando responde A se guarda token de B con player/contact/rank de A. Alternativa: logout deja stored=null, una respuesta tardía reconstruye datos parciales y los persiste; o persist(A) ya cifrando completa setItem después de removeItem de logout y restaura la sesión completa en disco.

### Impacto
Datos de cuenta A visibles o persistidos bajo B; sesión que reaparece al reiniciar después de cerrar/borrar; carreras pueden sobrescribir revocación local y consentimiento visible. No implica acceso a terceros sin usar el dispositivo compartido.

### Corrección propuesta
Introducir epoch de sesión y capturar token/id al iniciar cada operación; descartar respuestas de otra generación; abortar/drain solicitudes y serializar persist/remove. Cambio de identidad de cuenta debe invalidar operaciones previas y caches.

### Aceptación
Con promesas diferidas: respuesta A tras logout no restaura datos; A→B no sustituye player de B ni token; setItem antiguo posterior al borrado se impide; reinicio tras reset permanece guest; 401 tardío de A no expira B.

## BE-05 [P1] Fallback a llave en memoria escribe cuentas persistentes que se pierden al reiniciar

Confianza original del revisor: confirmado estático. 

### Evidencia
- `src/security/vault.ts:119`: Fallo/ausencia de SecureStore o IndexedDB cae a memory.
- `src/security/vault.ts:124`: Se genera una llave efímera sin comunicar degradación.
- `src/security/vault.ts:155`: Se escribe igualmente cifrado a AsyncStorage persistente.
- `src/security/vault.ts:169`: Con nueva llave la lectura devuelve null.
- `src/account/store.ts:147`: Alta adopta sin comprobar vaultKind y puede presentar éxito.

### Escenario
SecureStore/IndexedDB no está disponible al crear o recuperar cuenta, o falla transitoriamente al iniciar. Se guarda sv1 con llave de sesión y se considera cuenta registrada. En el siguiente proceso la llave cambia (o se recupera el proveedor anterior) y el registro ya no es descifrable. Un fallo temporal puede causar nuevas escrituras ilegibles con proveedor definitivo.

### Impacto
Pérdida de token y código guardado; cuentas huérfanas si no se copió el código; datos remotos persisten aunque el cliente aparenta invitado. Pruebas actuales solo hacen round-trip en el mismo runtime.

### Corrección propuesta
No persistir secretos con llave efímera de forma silenciosa. Distinguir modo sesión, avisar/confirmar y garantizar respaldo del código antes del éxito; ante proveedor temporalmente bloqueado preservar ciphertext, ofrecer reintento, no reemplazarlo. Preferible fallar el alta persistente antes de producir cuenta remota.

### Aceptación
Pruebas memory→reinicio, proveedor temporalmente rechazado→recuperado, y SecureStore/IndexedDB denegados: ningún éxito duradero falso ni sobrescritura de ciphertext recuperable; UI informa y conserva vía de recuperación.

## BE-06 [P1] El alta confirma INSERT antes de operaciones falibles: una respuesta perdida deja cuenta inaccesible

Confianza original del revisor: confirmado estático. 

### Evidencia
- `api/v1/players.ts:39`: INSERT returning * confirma por HTTP separado.
- `api/v1/players.ts:41`: rankOf se ejecuta después del INSERT antes de entregar token y recoveryCode.
- `api/_lib/http.ts:85`: Error posterior se devuelve como 500 genérico.
- `src/account/store.ts:146`: updateIdentity y persist pueden fallar después de recibir las credenciales.
- `src/account/api.ts:99`: Timeout/desconexión de POST se presenta como offline, sin idempotencia.

### Escenario
Inyectar error en rankOf después de INSERT. La cuenta ya existe pero el cliente recibe 500 sin secretos (la BD solo almacena hashes). Reintentar crea otra. Igual ocurre si se pierde la respuesta; o updateIdentity/persist falla antes de mostrar el código aunque el servidor confirmó.

### Impacto
Cuenta/contacto consentido quedan almacenados sin que el dueño pueda recuperar o borrar fácilmente; registros y ranking duplicados; rotulación de error no distingue commit desconocido.

### Corrección propuesta
Hacer rank accesorio y no condicionar entrega de credenciales a su disponibilidad; adoptar/persistir secretos antes de tareas locales opcionales. Implementar clave idempotente por intento de alta y reentrega segura de resultado (p.ej. secretos generados del lado cliente con esquema seguro o registro temporal cifrado) para fallo de transporte.

### Aceptación
Simular INSERT exitoso + rank rechazado, escritura local fallida y respuesta perdida: un reintento no crea segunda fila, el usuario recibe/recupera la misma cuenta y su código, y puede eliminar sus datos.

## BE-07 [P2] La revocación de token no se verifica al aplicar PATCH/sync/DELETE

Confianza original del revisor: confirmado estático. 

### Evidencia
- `api/_lib/auth.ts:8`: Autenticación y selección de fila preceden a la mutación.
- `api/v1/recover.ts:17`: Recuperación rota token_hash.
- `api/v1/me.ts:25`: PATCH actualiza solo por id.
- `api/v1/me.ts:35`: DELETE elimina solo por id.
- `api/v1/sync.ts:37`: sync actualiza solo por id.

### Escenario
Pausar una petición del dispositivo A después de requirePlayer; recuperar en B (rota token), después continuar PATCH/DELETE de A. La operación usa id y se ejecuta con sesión revocada. El alcance es la petición que ya pasó auth, no peticiones nuevas con token antiguo.

### Impacto
El aviso de desconectar el dispositivo anterior no impide mutaciones en vuelo; una eliminación o nueva escritura de contacto puede ocurrir después del cambio de control. La aceptabilidad depende del contrato de revocación.

### Corrección propuesta
Predicar mutaciones también por hash del token autenticado, o serializar auth y mutación mediante transacción; manejar fila ausente como 401/conflicto, no 500. Definir semántica explícita para solicitudes en vuelo.

### Aceptación
Barrera auth(A)→recover(B)→DELETE/PATCH/sync(A): si se exige revocación inmediata, A recibe 401 y no cambia la fila. Una petición autenticada con B funciona.

## BE-08 [P2] Recuperar no restaura racha/rutas/mejor ruta y el primer sync borra la racha remota

Confianza original del revisor: confirmado estático. 

### Evidencia
- `src/account/store.ts:154`: restoreAccount llama mergeAccountProgress.
- `src/storage/profile.ts:234`: La mezcla solo contempla alias/avatar/xp/games/achievements.
- `src/storage/profile.ts:226`: streak se toma de streakDays local; rutas/mejor ruta del historial local.
- `api/v1/sync.ts:30`: streak=$4 sustituye la racha remota incondicionalmente.
- `src/account/store.ts:156`: Se agenda sync 300ms tras recuperar.

### Escenario
Cuenta remota con streak=50, bestRoute>0 y routes>0 recuperada en instalación limpia con racha=0 e historial vacío. Se preservan XP/games/logros, no el resto. El primer sync envía streak=0 y la BD pierde 50; las rutas no bajan en BD por greatest pero no vuelven al resumen local.

### Impacto
Recuperación incompleta y pérdida remota de racha, aunque se ofrece recuperar progreso. Métricas y logros dependientes de historia pueden divergir.

### Corrección propuesta
Definir qué progreso se recupera y persistir la totalidad necesaria, con fechas de actividad/racha para no usar max ciegamente. Mantener estadísticas agregadas de rutas independientes del historial limitado; evitar overwrite inicial con valores por defecto.

### Aceptación
Recuperar en limpio racha/rutas/mejor ruta conocidos, ejecutar sync: se mantienen los valores válidos; racha expiraba de acuerdo a fechas reales y no por defaults de instalación; resumen local muestra los agregados remotos.

## BE-09 [P2] Eventos durante un sync en curso pueden quedarse sin sincronizar ni reintento

Confianza original del revisor: confirmado estático. 

### Evidencia
- `src/account/store.ts:226`: scheduleSync usa un solo timer y lo consume.
- `src/account/store.ts:236`: syncNow retorna si syncing=true sin marcar trabajo pendiente.
- `src/account/store.ts:245`: El progreso se captura una vez.
- `src/account/store.ts:252`: finally solo quita syncing; no reprograma cambios o errores.

### Escenario
Sync lento captura progreso P1; una partida produce P2 y agenda timer. Si el timer vence antes de acabar el primer sync, el segundo syncNow retorna porque syncing=true. Tras completar P1 no hay nueva agenda; P2 no se envía hasta otro evento, reinicio o botón manual. Errores offline tampoco tienen retry propio.

### Impacto
Ranking queda obsoleto tras la última partida y tras conectividad recuperada sin nuevo evento; progreso local existe pero el usuario puede cerrar y cambiar de dispositivo antes de subirlo.

### Corrección propuesta
Marcar dirty/pending durante sync y en fallos recuperables; al completar ejecutar otro sync si la revisión local cambió, con backoff y recuperación de conectividad. No hacer bucles inmediatos ante 429/401.

### Aceptación
Con red diferida y evento entre captura y final, se envía P2 aunque no ocurran más eventos; offline→online reintenta; 401 no provoca retry infinito.

## BE-10 [P2] Logros arbitrarios y unión no acotada permiten crecimiento permanente de una fila

Confianza original del revisor: confirmado estático. 

### Evidencia
- `api/_lib/players.ts:139`: Solo valida regexp, deduplica y limita 64 por payload, no catálogo.
- `api/v1/sync.ts:33`: La unión de logros de la fila y payload no tiene límite global.
- `api/v1/players.ts:35`: Alta también acepta esos identificadores.
- `scripts/db/schema.sql:23`: No hay restricción al tamaño del array.
- `src/account/api.ts:81`: Las respuestas tienen timeout por fetch sin límite de tamaño del JSON.

### Escenario
Cada sync envía 64 IDs sintácticamente válidos nuevos (invented-0-0, etc.). Tres lotes distintos dejan 192 entradas por cálculo aislado y la unión sigue creciendo aunque cada solicitud cabe bajo el límite. Puede reclamar IDs reales como route-champion sin evidencia.

### Impacto
Amplificación de almacenamiento/CPU/respuestas y logros competitivos falsos; la cuenta crece permanentemente y toda lectura ownerView serializa el array.

### Corrección propuesta
Validar contra catálogo compartido, acotar unión total a su tamaño y derivar los logros verificables de eventos válidos. Distinguir logros solo locales/no verificados; limpiar datos históricos ajenos al catálogo.

### Aceptación
IDs desconocidos rechazados/ignorados; el array nunca supera catálogo aunque lleguen lotes distintos; logros competitivos requieren evidencia o quedan marcados no verificados.

## BE-11 [P2] Lecturas públicas y de cuenta consultan BD sin límite de aplicación

Confianza original del revisor: confirmado estático. 

### Evidencia
- `api/v1/leaderboard.ts:19`: GET sin auth dispara top y count; con token además findPlayer/rank.
- `api/v1/health.ts:7`: Cada petición pública hace select 1.
- `api/v1/me.ts:7`: GET ejecuta lookup/ranking sin rate-limit; PATCH y DELETE tampoco lo aplican.
- `api/_lib/http.ts:32`: no-store impide caché HTTP compartida por defecto.
- `api/_lib/security.ts:63`: Los límites existentes solo se llaman desde alta/recover/sync/admin.

### Escenario
Un cliente solicita /leaderboard o /health repetidamente, incluso sin cuenta. No hay admisión/caché a nivel de código: cada GET hace consultas reales; un token válido añade counts de ranking. No se probó carga ni se inspeccionó un WAF externo.

### Impacto
Camino verificable de amplificación de consultas/costo y potencial degradación; no se afirma DoS efectivo en producción ni ausencia de protección externa.

### Corrección propuesta
Caché breve de top/totales sin identidad, presupuesto de lectura por IP confiable/account y protección edge; health público cacheado/ligero y readiness DB restringido. Moderar PATCH para evitar abuso sin bloquear redes de un stand.

### Aceptación
Con DB mock contar consultas: ráfaga de GET anónimos no hace una consulta por solicitud sin límite; cache global no incluye me/token; validar admisión también en PATCH/DELETE y despliegue edge.

## BE-12 [P3] readJson limita caracteres, no bytes, y solo después de cargar el cuerpo completo

Confianza original del revisor: confirmado estático. 

### Evidencia
- `api/_lib/http.ts:49`: Se anuncia limitBytes=4096.
- `api/_lib/http.ts:54`: request.text lee todo antes de la comprobación.
- `api/_lib/http.ts:58`: text.length cuenta unidades UTF-16, no UTF-8.

### Escenario
POST sin Content-Length con {school: "ñ" repetido 3000}: cálculo aislado 3013 caracteres y 6013 bytes; pasa el control de tamaño. Un stream más grande sin Content-Length se materializa antes de ser rechazado. El límite duro de la plataforma no se inspeccionó.

### Impacto
El contrato de 4KB no se cumple y no limita memoria durante la lectura. No se afirma un agotamiento práctico sin conocer límite de Vercel.

### Corrección propuesta
Leer stream con contador de bytes, cancelar al superar tope, validar Content-Type y objeto plano según endpoint. Diferenciar 413 de JSON inválido 400; aplicar límite de plataforma como defensa adicional.

### Aceptación
Cuerpo UTF-8 de más de4096 bytes rechazado aunque tenga menos caracteres; stream sin longitud se cancela al límite; array/no JSON tiene error definido.

## BE-13 [P3] Campos POST de UUID y límite del ranking llegan malformados a SQL

Confianza original del revisor: confirmado estático. 

### Evidencia
- `api/v1/admin/players.ts:68`: Regex [0-9a-f-]{36} permite guiones en cualquier posición, incluso 36 guiones.
- `api/v1/leaderboard.ts:17`: Number(limit) se topa pero no fuerza entero.
- `api/v1/leaderboard.ts:21`: LIMIT recibe ese parámetro.
- `api/_lib/http.ts:85`: El error SQL acaba como 500.

### Escenario
Admin autenticado envía id="------------------------------------" o GET público /leaderboard?limit=5.5. Pasa validación de aplicación; UUID inválido / parámetro no entero no representan entradas válidas para esas consultas. La respuesta exacta de PostgreSQL no se ejecutó.

### Impacto
Errores de usuario convierten peticiones en fallos internos y consultas innecesarias; ruido operativo. No es inyección SQL porque se parametriza.

### Corrección propuesta
Regex UUID con grupos y versión/variante apropiados o validador; limit entero finito con política explícita (rechazar o floor). Responder 400/422 antes de DB.

### Aceptación
Mock de query no se invoca para UUID malformado o fracciones no permitidas; formato correcto, enteros y límites negativos/grandes/Infinity se comportan según contrato.

## BE-14 [P2] La exportación de contactos se corta a 5000 sin indicar que faltan jugadores

Confianza original del revisor: confirmado estático. 

### Evidencia
- `api/v1/admin/players.ts:28`: SELECT tiene limit5000 sin cursor.
- `api/v1/admin/players.ts:60`: count informa solo filas entregadas, sin total/hasMore.
- `api/v1/admin/players.ts:51`: CSV no indica truncamiento ni permite paginar.

### Escenario
Cuando hay más de5000 jugadores elegibles, GET JSON/CSV muestra los primeros por XP; los demás, incluyendo quienes consintieron contacto, quedan fuera sin señal de exportación parcial.

### Impacto
Exportación operativamente incompleta y sesgada por XP; el conteo es correcto para el lote pero no permite conocer la omisión. Escenario de volumen, no volumen actual confirmado.

### Corrección propuesta
Paginación por cursor estable y total/hasMore, o export streaming completo con límites visibles. Mostrar si el CSV es parcial y permitir continuación.

### Aceptación
Con5001 filas elegibles, se obtienen todas sin duplicados/omisiones o se declara truncamiento y cursor; retiro de consentimiento durante export respeta política de snapshot.

## BE-15 [P2] Recuperación admite submissions paralelos desde Enter y puede adoptar un token ya revocado

Confianza original del revisor: confirmado estático. 

### Evidencia
- `app/cuenta/recuperar.tsx:35`: submit solo comprueba valid, no loading ni mutex.
- `app/cuenta/recuperar.tsx:91`: onSubmitEditing sigue llamando submit aun con botón loading.
- `src/account/store.ts:152`: restoreAccount no serializa intentos.
- `api/v1/recover.ts:17`: Cada intento rota token aun con mismo código.
- `src/account/store.ts:155`: La respuesta que adopta última gana localmente.

### Escenario
Presionar Enter dos veces en el campo o recuperar desde dos contextos casi simultáneos. Las rotaciones R1/R2 dejan R2 vigente; si la respuesta/local merge de R1 completa última, cliente adopta R1 y enseguida aparece expired. También puede haber resultado local de una cuenta mezclado con otro intento.

### Impacto
Flujo ofrece éxito de recuperación y luego sesión inválida; agota intentos y produce carreras adicionales. No necesita adivinar código ni DB comprometida.

### Corrección propuesta
Mutex/ref para submit y en store; invalidar intentos previos por generación; recuperación idempotente por intento y contrato para concurrencia entre dispositivos. Deshabilitar envío por teclado mientras loading.

### Aceptación
Doble Enter genera una sola petición; respuesta retrasada del intento anterior nunca reemplaza token nuevo; concurrencia de recuperación muestra conflicto/resolución, no éxito con token inútil.

## BE-16 [P2] Un código de recuperación expuesto sigue tomando control después de cada recuperación legítima

Confianza original del revisor: confirmado estático. 

### Evidencia
- `api/v1/recover.ts:17`: Solo se rota token_hash, no recovery_hash.
- `api/v1/me.ts:13`: PATCH no expone regeneración de recovery_hash.
- `src/features/account/RecoveryCodeCard.tsx:20`: El código se trata como acceso permanente y se recomienda guardar foto.
- `src/features/account/RecoveryCodeCard.tsx:28`: Copiar lo deja en portapapeles general.

### Escenario
El usuario detecta que su foto/portapapeles/código quedó expuesto y recupera su cuenta para desconectar a quien lo usó. El mismo código antiguo sigue autenticando y obteniendo ownerView (contacto incluido); la API no permite revocarlo, salvo eliminar cuenta.

### Impacto
No hay remediación del compromiso de la credencial raíz manteniendo cuenta/progreso. No se afirma fuga real ni que copiar sea por sí solo vulnerabilidad; el defecto es que exposición conocida no puede revocarse.

### Corrección propuesta
Ofrecer regeneración autenticada y confirmada de código con invalidez atómica del anterior; considerar rotación en recuperación y entrega segura/idempotente del nuevo secreto. Advertir y permitir ocultar código; tratar clipboard como acción consciente.

### Aceptación
Después de regeneración, código antiguo devuelve not_found/unauthorized y nuevo funciona; la entrega fallida no bloquea al dueño ni crea credencial irrecuperable; no se registra código en logs.

## BE-17 [P2] Descifrado de contacto falla silenciosamente y health sigue verde con llave incorrecta

Confianza original del revisor: confirmado estático. 

### Evidencia
- `api/_lib/security.ts:32`: Clave ausente o incorrecta falla al cifrar.
- `api/_lib/security.ts:50`: Cualquier fallo al descifrar se convierte en null.
- `api/_lib/players.ts:171`: ownerView conserva contactConsent pero presenta contacto null.
- `api/v1/admin/players.ts:37`: Export imprime null sin distinguir corrupción/configuración.
- `api/v1/health.ts:7`: health solo comprueba select1.

### Escenario
Despliegue accidental con SOYTEL_DATA_KEY incorrecta/no configurada: health devuelve ok; contacto ya guardado no aparece en owner/admin, nuevas altas con contacto fallan. En una edición nueva el formulario parte wantsContact=true pero contactValue vacío. No se leyeron llaves de despliegue.

### Impacto
Pérdida aparente de contactos y exportación incompleta sin diagnóstico; consentimiento=true/contact=null ambiguo. Una rotación no planificada impide recuperar los datos.

### Corrección propuesta
Validación fail-fast de configuración y readiness para operaciones sensibles; identificar versión de llave y errores de descifrado sin revelar PII. No presentar corrupción como ausencia; implementar rotación con keyring y migración verificable.

### Aceptación
Llave ausente/incorrecta produce alerta/readiness no verde y error controlado del contacto, no falso null silencioso; rotación descifra antiguas y nuevas filas; logs contienen solo metadata segura.

## BE-18 [P2] Editar alias offline puede perder identityDirty frente a un PATCH/sync anterior

Confianza original del revisor: confirmado estático. 

### Evidencia
- `src/account/store.ts:177`: Identidad local cambia antes de request.
- `src/account/store.ts:183`: Fallo offline solo marca un boolean identityDirty.
- `src/account/store.ts:164`: Cualquier respuesta de editAccount pone identityDirty=false.
- `src/account/store.ts:243`: sync de identidad también limpia el boolean sin revisión.
- `app/profile.tsx:233`: Guardar alias no tiene loading/mutex.

### Escenario
Edición A de alias queda pendiente. Edición B posterior escribe alias local nuevo, falla offline y deja identityDirty=true. Cuando respuesta de A llega, pone false y actualiza identidad al alias A; o un sync de identidad anterior pone false mientras el local ya cambió. No hay revisión ni cola.

### Impacto
Cambios del usuario perdidos o perfil local distinto del ranking sin reparación automática. Misma familia de carreras que BE-04, pero ocurre sin cambio de sesión y exige revisión por campo/operación.

### Corrección propuesta
Cola de mutaciones o número de revisión de identidad; solo limpiar dirty si la revisión enviada sigue vigente, no sobrescribir draft más nuevo con respuesta vieja. Serializar setIdentity y guardar junto a revisión.

### Aceptación
Con A pendiente y B offline, al volver la red el alias B prevalece y se sincroniza; respuesta antigua no limpia dirty de B; pruebas para alias y avatar simultáneos.

## BE-19 [P2] Curso omitido permite contacto sin tutor: la política para edad desconocida queda abierta

Confianza original del revisor: hipótesis. 

### Evidencia
- `src/features/account/AccountForm.tsx:49`: Prefiero no decir selecciona grade=null.
- `src/features/account/AccountForm.tsx:74`: Tutor solo se requiere si needsGuardianConsent devuelve true.
- `src/account/rules.ts:29`: needsGuardianConsent(null) devuelve false.
- `api/_lib/players.ts:100`: API usa grade nulo cuando el alta lo omite.
- `app/privacidad.tsx:50`: El aviso requiere autorización para 7°/8°, no describe la excepción de curso no declarado.

### Escenario
Un alumno de7°/8° elige Prefiero no decir (default del formulario) y activa invitaciones: UI/API aceptan contacto con guardianConsent=false. El código cumple una política basada únicamente en curso declarado, pero no prueba edad. Se requiere confirmar si la organización acepta este riesgo o pretende cubrir a todos los menores.

### Impacto
Posibilidad de eludir la intención de autorización parental con el flujo normal. No se emite conclusión legal ni se afirma que todo contacto de edad desconocida sea ilícito.

### Corrección propuesta
Definir política de edad desconocida con responsable de privacidad. Si se debe proteger a menores, preguntar una franja mínima de edad/confirmación o requerir tutor para contacto sin curso, manteniendo juego anónimo disponible; no inferir edad exacta del curso.

### Aceptación
Casos grade=null/omitido/otro y curso conocido tienen comportamiento explícito, documentado y aprobado; si política protege edad desconocida, contacto no se guarda sin la autorización definida.

## BE-20 [P2] Timeout HTTP termina al recibir cabeceras: JSON lento puede dejar operaciones colgadas

Confianza original del revisor: confirmado estático. 

### Evidencia
- `src/account/api.ts:85`: Abort timer controla fetch.
- `src/account/api.ts:100`: finally cancela timer tan pronto fetch devuelve Response.
- `src/account/api.ts:105`: response.json se espera fuera del tiempo límite.
- `src/account/store.ts:253`: syncing solo se libera cuando termina ese await.

### Escenario
En web, responder con headers200 y comenzar un JSON sin cerrar el stream. fetch resuelve, se limpia el timer12s y response.json queda esperando indefinidamente. También ocurre con desconexión que no finaliza el body a tiempo.

### Impacto
Botón de alta/recuperación o estado syncing puede quedar ocupado sin timeout; llamadas siguientes se bloquean. El límite declarado12s no cubre la operación completa.

### Corrección propuesta
Mantener abort timer hasta consumir/validar body y finalizar request; finally envolviendo ambos pasos. Distinguir abort/JSON inválido de error de dominio, y acotar respuesta si el contrato lo requiere.

### Aceptación
Fetch mock devuelve Response con stream de JSON que no cierra; request rechaza como timeout al límite y libera loading/syncing; JSON completo normal se procesa sin timer residual.

### Limitaciones originales de la subauditoría
- Solo snapshot inmutable indicada como HEAD9eeda63; no se inspeccionó ni modificó proyecto original, git, .env, credenciales, cuentas, servicios remotos o BD real.
- Baseline suministrado por coordinador:194 tests pass,3 skipped,20 suites pass/1 skipped, tipos/lint limpios. No se volvió a ejecutar npm run check; snapshot no tiene node_modules/typescript y no se instaló nada.
- Intento de harness aislado Node con carga TypeScript en memoria falló por quoting bash (exit2); intento por subprocess fue bloqueado por aprobación pendiente. No se reintentó ni se eludió ese control. No hay resultados runtime del harness y ningún finding se etiqueta reproducido.
- Cálculos/modelos aislados ejecutados en Python: franquicia30x400=12000,6000→18000;3x64=192; JSONUTF8 3013 caracteres/6013 bytes. Son comprobaciones del modelo, no ejecución de endpoints ni PostgreSQL.
- Carreras de DB descritas como interleavings estáticos; faltan pruebas con aislamiento real de Postgres/Neon, barreras, bloqueo y read-after-write. No se inventaron resultados SQL.
- No se ejecutó SecureStore/Keychain/Keystore real, IndexedDB entre pestañas, modo privado, ni UI web/Android/iOS. No se validaron CSP efectiva, CORS y protección edge de un despliegue.
- Confianza en clientIp depende de cómo Vercel normaliza x-forwarded-for/x-real-ip; no se pudo comprobar spoofing y no se reporta bypass confirmado de rate-limit por cabecera.
- No se evaluó cumplimiento legal, identidad verificable del apoderado, retención real de backups/logs/CSV exportado, rotación de secretos externa o controles de administrador más allá del código.
- La llave WebCrypto no exportable protege extracción del material, no uso por JS del mismo origen: un script autorizado que obtiene CryptoKey puede llamar decrypt. No se halló/cerró una cadena XSS aquí y esto no se reporta como vulnerabilidad autónoma.
- route/** y juegos no se auditaron exhaustivamente en este informe: solo dependencias comunes de cifrado/progreso. La promesa de datos solo locales sin cuenta debe revisarse también contra el flujo MQTT compartido por otro auditor.
- Pruebas relacionadas examinadas completas: tests/api.test.ts, tests/account.test.ts, tests/security.test.ts, tests/storage.test.ts y setup. Búsqueda en tests no halló tests de handlers/auth/rateLimit/transacciones/recover concurrency; no equivale a ausencia de cualquier cobertura indirecta.

# Área: realtime

## RT-01 [P1] Un participante puede sumar juegos inventados sin límite al ranking

Confianza original del revisor: confirmado estático. Reproducción adicional independiente por coordinador: CONFIRMADA. 

### Evidencia
- `src/route/host.ts:418`: Tras autenticar token y secuencia, se castea action sin validar su unión discriminada.
- `src/route/engine.ts:297`: acceptsScore acepta cualquier game distinto de red-b215 en projects/checkin hall; falta allowlist de pillarIds.
- `src/route/engine.ts:326`: La deduplicación solo consulta player.games[action.game], por lo que cada clave nueva es un juego distinto.
- `src/route/engine.ts:338`: Se inserta una clave arbitraria en games con hasta 1000 puntos.
- `src/route/engine.ts:100`: playerTotal suma TODOS los valores de games, incluyendo juegos ajenos al catálogo.
- `tests/route-engine.test.ts:141`: El test existente deduplica un game válido; no cubre IDs desconocidos ni payloads fuera del tipo TS.

### Escenario
Un miembro legítimo, dueño de su sessionKey/token, publica scores cifrados con game="extra-1", "extra-2", etc. durante B213, con secuencias crecientes. Las claves extra no participan en el cálculo de previous de scoreEarliest, así que después del mínimo de apertura se pueden enviar juntas. No necesita falsificar firma del host ni conocer tokens de otros.

### Impacto
Inflación arbitraria del puntaje y del ranking de la ruta; crecimiento de estado/snapshots y coste de publicación. El tope de 1000 por juego no limita el total de claves. No se afirma inflación ilimitada de XP: calculateGameXp tiene su propio tope.

### Corrección propuesta
Validar PlayerAction en frontera de red, exigir game en {red-b215,...pillarIds}; usar estructuras sin prototipo para mapas indexados por IDs y limitar claves/total según catálogo.

### Aceptación
Scores con game desconocido, ausente, objeto, __proto__ y constructor no mutan estado ni lanzan excepción; juegos válidos conservan idempotencia y límites. En proyectos, múltiples IDs inventados nunca incrementan total.

## RT-02 [P2] Estados firmados pueden reproducirse con igual revisión y retrasar reloj/failover

Confianza original del revisor: confirmado estático. Reproducción adicional independiente por coordinador: CONFIRMADA. 

### Evidencia
- `src/route/member.ts:474`: Solo rechaza si rev Y now son menores: misma revisión y now antiguo se aceptan.
- `src/route/member.ts:475`: Cada aceptación actualiza lastStateAt incluso si es repetición exacta.
- `src/route/member.ts:476`: offset se recalcula usando now del ciphertext reproducido.
- `src/route/member.ts:343`: El cambio de broker depende de tiempo desde el último estado aceptado.
- `src/route/host.ts:369`: El estado se publica retenido; los heartbeats mantienen rev y aumentan now.

### Escenario
Un observador del broker captura un state opaco auténtico y lo republica en el mismo topic. Si el miembro permanece en esa revisión, el replay exacto se acepta indefinidamente, renueva lastStateAt y hace que hostNow vuelva a la hora capturada. Tras restaurar sin snapshot previo también acepta un retained antiguo sin evaluar edad. Un host restaurado con rev menor pero now mayor se acepta por el mismo AND.

### Impacto
Reloj/cuentas regresivas atrasados, presencia falsa y detección de host caído anulada para ese miembro; estados antiguos retenidos influyen al reabrir. No permite inventar puntajes ni estados: la firma Ed25519 y el cifrado siguen siendo necesarios.

### Corrección propuesta
Añadir epoch/session ID firmado y número de publicación estrictamente monótono; rechazar duplicados sin refrescar liveness. Definir política explícita para rollback/host restart, y frescura inicial sin depender ciegamente del reloj local.

### Aceptación
Replays de mismo rev/now y mismo rev con now anterior no cambian snapshot, offset ni lastStateAt. Rev menor no retrocede silenciosamente: requiere nuevo epoch autenticado/resync. Retained histórico no mantiene un host ausente en línea. Ejecutar con host y al menos tres miembros reales, claves reales, reloj virtual y transporte simulado con entrega programable por destinatario; registrar trace de paquetes/ACK y comprobar invariantes, no solo status joined.

## RT-03 [P2] Replay de join permite clonar participantes y renovar su presencia desde el broker

Confianza original del revisor: confirmado estático. 

### Evidencia
- `src/route/protocol.ts:71`: JoinRequest contiene alias/avatar, pero no clientId, challenge, timestamp ni session/epoch.
- `src/route/host.ts:386`: El clientId proviene del topic, no del plaintext autenticado.
- `src/route/host.ts:395`: Solo exige poder abrir el box y alias string; no verifica replay ni unión a topic.
- `src/route/engine.ts:127`: Repetir el saludo existente refresca lastSeen sin un heartbeat con token.
- `src/route/engine.ts:130`: Las altas ocupan cupo aunque el miembro no continúe el handshake.

### Escenario
Un tercero que solo observa MQTT copia un join cifrado válido. Lo publica en /join/ con distintos IDs alfanuméricos para crear clones, o repite el mismo ID para mantener presencia; también puede recrear un jugador después de leave. El plaintext no vincula el ID al topic. Los DM quedan cifrados a la clave original: el observador no obtiene las credenciales.

### Impacto
Cupos agotados y bloqueo de checkins/avance por participantes fantasma; presencia renovable sin token. Es DoS/replay real sin romper NaCl, no takeover del participante ni lectura de DM.

### Corrección propuesta
Incluir clientId y epoch/challenge del host en el box y comprobarlos contra el topic; completar alta tras prueba de posesión fresca, cachear/deduplicar request IDs y aplicar rate limits/expiración de reservas. Reintentos legítimos deben ser idempotentes.

### Aceptación
El mismo join no crea jugadores bajo otros topics ni refresca lastSeen indefinidamente. Replay tras leave no revive la identidad sin challenge nuevo. Sesenta copias de un ciphertext no consumen sesenta plazas; retries normales siguen funcionando. Ejecutar con host y al menos tres miembros reales, claves reales, reloj virtual y transporte simulado con entrega programable por destinatario; registrar trace de paquetes/ACK y comprobar invariantes, no solo status joined.

## RT-04 [P2] La unión queda sin timeout ni búsqueda de broker después de aceptar hello

Confianza original del revisor: confirmado estático. 

### Evidencia
- `src/route/member.ts:330`: Rota brokers y llega a not-found únicamente cuando credentials.hostBox está vacío.
- `src/route/member.ts:340`: Con hostBox fijado reenvía join indefinidamente.
- `src/route/member.ts:326`: No considera unido al miembro hasta tener sessionKey.
- `src/route/member.ts:343`: El detector STALE que rota brokers solo se activa con sessionKey.
- `src/route/member.ts:411`: pin fija hostBox y hostSign, sin validar edad de hello.at.
- `src/route/protocol.ts:105`: openHello verifica firma autocontenida pero no vigencia de hello.at.

### Escenario
El miembro recibe el hello retenido, pero el host se apaga o migra de broker antes del welcome. También ocurre al introducir un código de una ruta abandonada cuyo hello sigue retenido. Con hostBox ya fijado, no entra al timeout de descubrimiento ni al failover de miembros unidos.

### Impacto
Pantalla Buscando la ruta… permanente y reintentos/colas sin un resultado not-found útil. El pin correcto protege contra otro host, pero se convierte en un bloqueo de recuperación.

### Corrección propuesta
Separar identidad pinned de disponibilidad del broker; establecer deadline global para JOIN/DM y buscar otros brokers preservando las claves pinned. Validar freshness del hello firmado y limpiar retained al cerrar/expirar.

### Aceptación
Con hello válido y ningún welcome, la UI sale a un error recuperable en tiempo acotado. Si host cambia de broker antes del welcome, el miembro lo encuentra sin aceptar claves distintas. Hello de ruta extinta no causa espera ilimitada. Ejecutar con host y al menos tres miembros reales, claves reales, reloj virtual y transporte simulado con entrega programable por destinatario; registrar trace de paquetes/ACK y comprobar invariantes, no solo status joined.

## RT-05 [P2] CONNACK publica estado nuevo antes de vaciar estados retenidos antiguos

Confianza original del revisor: confirmado estático. Reproducción adicional independiente por coordinador: CONFIRMADA. 

### Evidencia
- `src/realtime/mqttClient.ts:218`: setStatus(online) invoca sincrónicamente el callback del host antes de replay de inflight/outbox.
- `src/route/host.ts:315`: onLinkStatus(online) publica inmediatamente hello y state actuales.
- `src/realtime/mqttClient.ts:224`: Después de ese callback se reenvía inflight (incluidas publicaciones recién emitidas) y luego outbox.
- `src/realtime/mqttClient.ts:142`: Durante offline acumula publicaciones sin coalescer retain por topic.
- `src/route/host.ts:219`: El host sigue publicando state cada cinco segundos durante la desconexión.

### Escenario
Tras una caída hay state antiguos en outbox. Al recibir CONNACK, el host envía el snapshot fresco desde onStatus; después MQTT reenvía pendientes antiguos, con retain=true, y deja al final uno viejo como retained. Un callback que publica se incorpora también al mapa inflight que se recorre inmediatamente.

### Impacto
Retained retrocede hasta el siguiente heartbeat, ráfagas redundantes y posible regresión de reloj/estado al reconectar o hacer join tardío. Las revisiones ayudan parcialmente a clientes existentes, pero no al recién abierto y no con rev iguales (RT-02).

### Corrección propuesta
Reordenar handshake: preparar/reanudar transporte y cola antes de notificar disponibilidad de aplicación, evitando incluir nuevas publicaciones en el snapshot de replay. Coalescer state/hello retenidos por topic y publicar solo el snapshot actual tras reconectar.

### Aceptación
Con outbox old y onStatus que publica new, el último PUBLISH retained en wire es new, no old; new no se reenvía por haber sido creado dentro del callback. Probar offline prolongado, reconexión y nuevo miembro leyendo retained. Ejecutar con host y al menos tres miembros reales, claves reales, reloj virtual y transporte simulado con entrega programable por destinatario; registrar trace de paquetes/ACK y comprobar invariantes, no solo status joined.

## RT-06 [P2] Welcome/scores confirmados no son durables y el miembro restaurado no repara altas perdidas

Confianza original del revisor: confirmado estático. 

### Evidencia
- `src/route/host.ts:405`: Se envía welcome y state antes de completar persistencia de la alta.
- `src/route/host.ts:373`: saveHost se retrasa 800 ms y se lanza con void; no hay confirmación durable.
- `src/route/member.ts:481`: Un snapshot que refleja score elimina la acción pendiente.
- `src/route/member.ts:161`: restore conserva sessionKey/token y conecta sin un nuevo JOIN de recuperación.
- `src/route/member.ts:382`: Con hostSign y sessionKey conocidos no vuelve a sendJoin al recibir hello.
- `src/route/member.ts:478`: Acepta status joined aunque su ID ya no exista en snap.players.
- `app/ruta/juego.tsx:67`: Sin view.me vuelve a ConnectingView incluso si status es joined.

### Escenario
El host muere dentro de la ventana de persistencia, después de que el teléfono guardó welcome o eliminó su pendiente por score reflejado. Al reiniciar desde el record anterior se pierde el jugador/score. Si se perdió el alta, el miembro conserva la sesión y manda solo acciones que el host ignora porque player no existe.

### Impacto
Pérdida de puntuación ya confirmada o participante permanentemente en Conectando… tras host restart; heartbeat publicado no repara el registro. También explica el riesgo de tomar control desde un record todavía atrasado.

### Corrección propuesta
Persistir eventos críticos antes de confirmar la aceptación, o usar log durable con ACK de aplicación. Añadir handshake de reanudación/autenticación y resync cuando una sesión restaurada no encuentra su ID; persistir acciones pendientes hasta ACK durable.

### Aceptación
Matar/restaurar host inmediatamente después de welcome y score no pierde acciones confirmadas. Miembro con sessionKey cuyo ID falta obtiene reanudación segura o rechazo explícito, nunca estado joined sin me indefinido. Ejecutar con host y al menos tres miembros reales, claves reales, reloj virtual y transporte simulado con entrega programable por destinatario; registrar trace de paquetes/ACK y comprobar invariantes, no solo status joined.

## RT-07 [P2] La exclusión del host tiene carreras en aperturas concurrentes y fallback de lease

Confianza original del revisor: confirmado estático. 

### Evidencia
- `src/route/storage.ts:128`: Web Locks se usa cuando existe; la carrera solo afecta navegadores sin esa API.
- `src/route/storage.ts:167`: El fallback lee lease y escribe en pasos separados sin CAS ni verificación posterior.
- `src/route/storage.ts:171`: La pérdida de control solo se detecta en el intervalo posterior de cinco segundos.
- `src/route/storage.ts:182`: release elimina lease sin comprobar que todavía pertenezca al owner.
- `src/route/host.ts:185`: Cada controller que recibe lock empieza a conducir/publicar inmediatamente.
- `src/route/hostManager.ts:16`: open comprueba controllers antes de await loadHost; no cachea una promesa in-flight y dos llamadas simultáneas pueden crear dos controllers.
- `src/route/storage.ts:164`: En native el lock es no-op: se confía en que HostManager ya evitó duplicados.
- `src/route/host.ts:65`: OWNER es único por módulo, no por controller; duplicados dentro del proceso comparten owner en fallback.

### Escenario
Dos pestañas sin navigator.locks leen simultáneamente lease vacío/vencido y ambas obtienen lock. Conducen desde sus records durante el intervalo de renovación. Si una pestaña libera antes de detectar que otra ganó, puede borrar la concesión ajena. Además, dos open(code) simultáneos dentro del mismo proceso pueden pasar la comprobación de controllers antes de await loadHost. Native concede ambos locks; en fallback comparten OWNER y ni siquiera se expulsan entre sí. Una instancia sobrescribe la referencia del Map mientras la otra queda ejecutándose fuera del manager.

### Impacto
Split-brain temporal, estados distintos firmados por las mismas claves y escrituras que pisan avances/puntajes. No es un ataque de un usuario externo del broker: requiere las pestañas del mismo origen/dispositivo con el record del host. En el caso intra-proceso puede quedar un controller/timers huérfano permanente que stopAll/nudgeAll no alcanzan.

### Corrección propuesta
Usar arbitraje atómico de IndexedDB/BroadcastChannel con fencing token persistente; verificar ownership antes de cada escritura/publicación y de borrar lease. Si no puede garantizar exclusividad, deshabilitar escritura de host en ese navegador. Serializar/cachear la promesa de apertura por code y transferir controllers de forma explícita, también en native.

### Aceptación
Forzar dos acquisitions concurrentes sin Web Locks concede solo un writer. release de un owner obsoleto no borra lease nuevo; pruebas cubren steal, pestaña congelada, renovación tardía y fencing de saves. Dos open simultáneos en Android/iOS o fallback devuelven la misma instancia y dejan un solo juego de timers; stopAll realmente detiene todas las instancias. Ejecutar con host y al menos tres miembros reales, claves reales, reloj virtual y transporte simulado con entrega programable por destinatario; registrar trace de paquetes/ACK y comprobar invariantes, no solo status joined.

## RT-08 [P2] Salir offline o cambiar de ruta deja jugadores/cupos huérfanos

Confianza original del revisor: confirmado estático. 

### Evidencia
- `src/route/member.ts:223`: leave envía la acción y cierra inmediatamente; no espera ACK de aplicación.
- `src/realtime/mqttClient.ts:142`: El leave offline se agrega a una cola solo en memoria.
- `src/route/link.ts:75`: stop cierra y descarta el MqttClient, con su cola/inflight.
- `src/route/member.ts:171`: join empieza con leave(false), sin notificar salida de la ruta anterior.
- `src/route/engine.ts:130`: El cupo se calcula con jugadores no kicked, incluidos offline indefinidos.
- `src/route/engine.ts:105`: offline solo cambia presencia; no elimina ni libera cupo.

### Escenario
El teléfono pulsa Salir sin red: se encola leave y se destruye el transporte antes de poder entregarlo. O el usuario vuelve al landing e inicia otra ruta: join hace leave(false) y deja el jugador anterior. Las identidades antiguas dejan de bloquear el avance por timeout, pero siguen ocupando plazas.

### Impacto
Ranking con participantes que ya salieron, cupos consumidos hasta MAX_PLAYERS aunque estén offline, y mensajes/expectativas de abandono distintos del estado real. MQTT PUBACK por sí solo tampoco confirma que engine procesó leave.

### Corrección propuesta
Confirmar leave con ACK de aplicación cuando online y conservar tombstone/reintento durable cuando offline; usar abandono/TTL explícito para liberar reservas, preservando resultados si es política de producto. Cambiar de sala debe abandonar la anterior de forma explícita.

### Aceptación
Salir durante offline y luego recuperar red elimina/libera correctamente el lugar anterior sin reintroducirlo. Cambiar de ruta no deja una identidad permanente. Cupo no se agota con ciclos de desconexión/entrada; no asumir que LocalBus reproduce la pérdida real al cerrar socket. Ejecutar con host y al menos tres miembros reales, claves reales, reloj virtual y transporte simulado con entrega programable por destinatario; registrar trace de paquetes/ACK y comprobar invariantes, no solo status joined.

## RT-09 [P2] Las acciones pendientes expiran silenciosamente y la UI puede afirmar éxito sin ACK

Confianza original del revisor: confirmado estático. 

### Evidencia
- `src/route/member.ts:349`: Después de 90 s borra pending sin error ni refresh inmediato.
- `src/route/member.ts:119`: pending existe solo en memoria y no forma parte de MemberCredentials.
- `app/ruta/juego.tsx:422`: Al terminar B215 fija done antes de confirmación y luego muestra WaitingView.
- `app/ruta/juego.tsx:439`: Sin pending, puntaje ausente se muestra como ¡0 puntos!, no como envío fallido.
- `app/ruta/juego.tsx:532`: Proyecto se marca localDone y deshabilita antes de score aceptado.
- `app/ruta/juego.tsx:624`: Trivia marca chosen y bloquea alternativas antes de ACK.
- `src/features/route/QuizViews.tsx:94`: chosen != null muestra ¡Respuesta enviada!, aunque solo fue encolada.

### Escenario
Durante una caída prolongada el jugador termina juegos o elige una alternativa. Después del timeout se borra la acción; proyectos siguen localmente completados y pueden mostrar cero, y trivia afirma enviada aunque el host nunca la recibió. Si la app muere, pending desaparece sin persistencia. Mientras no llega otro refresh, view.pending puede incluso quedarse desfasado respecto del Map.

### Impacto
Pérdida silenciosa de puntajes/respuestas y bloqueo de recuperación/reintento en UI; estados visuales optimistas que no distinguen encolado, recibido, rechazado y expirado.

### Corrección propuesta
Modelar lifecycle de acción con ID y ACK/NACK/motivo; persistir pendientes que deban sobrevivir restart, hacer refresh en expiración y ofrecer reintento/error. No usar localDone/chosen como confirmación del host ni mostrar éxito al agotar retry.

### Aceptación
Sin entregar publicaciones durante más de GIVE_UP_MS, UI muestra fallo recuperable y no éxito falso. El usuario puede reintentar si la fase sigue permitiéndolo. Reinicio conserva pendientes o informa la pérdida explícitamente. Ejecutar con host y al menos tres miembros reales, claves reales, reloj virtual y transporte simulado con entrega programable por destinatario; registrar trace de paquetes/ACK y comprobar invariantes, no solo status joined.

## RT-10 [P2] Deeplinks asumen parámetros escalares y canonizan códigos inválidos sin validarlos

Confianza original del revisor: confirmado estático. 

### Evidencia
- `app/ruta/index.tsx:32`: El genérico declara codigo/k como string, pero no convierte/valida los valores runtime.
- `app/ruta/index.tsx:34`: Llama sanitizeJourneyCode directamente desde params.codigo en initializer de render.
- `src/lib/progression.ts:61`: sanitizeJourneyCode ejecuta raw.toUpperCase; un array no tiene ese método. Además elimina/trunca caracteres de un token externo.
- `app/ruta/index.tsx:69`: k se pasa literalmente como fingerprint sin formato, tipo ni normalización controlada; igualdad se decide con codigo sanitizado.
- `app/ruta/stand.tsx:49`: El deep link del stand también llama toUpperCase sin guard de tipo.
- `app/ruta/index.tsx:34`: code solo se deriva una vez: otro enlace en el mismo componente no actualiza el formulario automáticamente.
- `release-run/node_modules/expo-router/build/hooks/useLocalSearchParams.js:21`: El hook conserva params de tipo array; el genérico TS no cambia esto.
- `release-run/node_modules/expo-router/build/fork/getStateFromPath-forks.js:388`: Parámetros query repetidos producen values.length>1 y se conservan como array.

### Escenario
Un enlace con parámetros repetidos codigo=ABC234&codigo=XYZ789 puede producir string[] en Expo Router y causar excepción al abrir landing/stand. Un codigo más largo o con caracteres prohibidos se convierte en otra sala en vez de rechazarse. k inválido o repetido queda como pin imposible y se manifiesta como ruta no encontrada. El cambio de parámetros sobre un componente reutilizado deja el code previo.

### Impacto
Crash de navegación externa, unión a sala distinta del token recibido, o fallos de QR explicados erróneamente como conectividad. No es ejecución de código ni exposición de claves.

### Corrección propuesta
Parsear datos externos como unknown: exigir un único codigo escalar de formato completo y un único k de 12 hex cuando presente; rechazar duplicados antes de derivar sala. Mantener sanitización flexible solo para escritura manual. Sincronizar formulario con nuevas invitaciones y mostrar error de enlace inválido.

### Aceptación
Repeated query params, valores no string, codigo inválido/sobre-largo, k no hexadecimal/longitud incorrecta y nuevas invitaciones sobre pantalla montada no causan excepción ni cambio silencioso de sala. QR canónico mantiene su fingerprint. La API real de useLocalSearchParams conserva arrays (dependencia inspeccionada).

## RT-11 [P2] Secuencia basada en Date.now no garantiza monotonicidad tras reinicio/cambio de reloj

Confianza original del revisor: confirmado estático. 

### Evidencia
- `src/route/member.ts:118`: seq se inicializa a cero y no se almacena en MemberCredentials.
- `src/route/member.ts:499`: La supuesta monotonicidad tras restart usa Math.max(Date.now(), this.seq+1), sin contador persistente.
- `src/route/host.ts:419`: Se acepta cualquier typeof number: no exige finitud, safe integer ni límites.
- `src/route/host.ts:421`: El host rechaza secuencias <= último valor, aunque la sesión se restauró legítimamente.
- `src/route/host.ts:422`: Se guarda seq incluso cuando la acción después no será válida; persistencia depende de cambios de rev.

### Escenario
Tras publicar con un reloj adelantado, el teléfono corrige su hora y reinicia la app. El host conserva una seq mayor; los nuevos heartbeats/acciones quedan ignorados hasta que el tiempo alcance ese valor. Un miembro también puede enviarse a sí mismo un JSON numérico 1e309, que JSON.parse interpreta como Infinity, y bloquear sus acciones futuras.

### Impacto
Sesión aparentemente conectada pero sin checkins/scores/respuestas aceptadas y presencia que vence. El caso de número no finito afecta la identidad cuyo token conoce el emisor; no habilita bloquear a otro jugador sin su token.

### Corrección propuesta
Usar contador/epoch de sesión persistente independiente del reloj, negociar último ACK al reanudar y exigir Number.isSafeInteger(seq) y seq>0. Validar acción antes de avanzar high-water mark, y persistir el ACK del contador con sus efectos.

### Aceptación
Corrección de reloj hacia atrás y restart no bloquean sesión. Seq no finita, fraccionaria, negativa o fuera de rango se rechaza sin mover high-water mark. Replays genuinos con misma seq siguen siendo idempotentes. Ejecutar con host y al menos tres miembros reales, claves reales, reloj virtual y transporte simulado con entrega programable por destinatario; registrar trace de paquetes/ACK y comprobar invariantes, no solo status joined.

## RT-12 [P3] Falta validación runtime completa y límites defensivos de mensajes/paquetes

Confianza original del revisor: confirmado estático. 

### Evidencia
- `src/route/protocol.ts:113`: parseJson<T> solo hace cast: no valida esquema, tamaños ni versión interna.
- `src/route/member.ts:471`: Snapshot descifrado solo se valida por code antes de usar kicked.includes y players.find.
- `src/route/member.ts:450`: Welcome no valida key/token/id/alias ni identidad esperada.
- `src/route/protocol.ts:109`: Hello no comprueba tamaño/formato de box ni campos v/at internos.
- `src/realtime/mqttPackets.ts:137`: PacketReader concatena/acumula sin máximo de bytes y no descarta remaining length malformado.
- `src/realtime/mqttPackets.ts:103`: decodePacket no comprueba tamaños mínimos ni QoS/reserved flags válidos.
- `src/route/link.ts:128`: Payload se decodifica a string completo sin cota antes de validación criptográfica.

### Escenario
Payload grande publicable en topics conocidos consume memoria/CPU antes de ser rechazado; un host autenticado defectuoso puede firmar snapshot sin arrays y disparar TypeError en miembro. Un broker defectuoso/malicioso puede entregar headers MQTT truncados, varints imposibles o length enorme y dejar el reader acumulando. Un simple publisher público NO controla los headers que el broker genera hacia el cliente.

### Impacto
Endurecimiento frente a memoria/CPU y crashes por incompatibilidad/host defectuoso. No se afirma que un observador sin claves pueda crear un snapshot válido que crashee mediante firma falsificada, ni que mandar JSON arbitrario como PUBLISH equivale a inyectar un CONNACK.

### Corrección propuesta
Definir esquemas estrictos para todos los plaintext/envelopes, límites previos por topic y versión/epoch; validar longitudes exactas de claves/nonces/firma/base64. Reader debe rechazar bytes inválidos con cierre/retry y cota global por paquete/buffer; aislar excepciones de callbacks.

### Aceptación
Fuzz de arrays, null, tipos incorrectos, tamaño excesivo, base64/claves inválidas, varint >4 bytes y paquetes truncados termina de forma controlada. Mensajes públicos sin autenticación se descartan antes de trabajo costoso; mensajes válidos continúan funcionando.

## RT-13 [P2] El registro de podio no es transaccional: marca primero y puede perder resultado/XP

Confianza original del revisor: confirmado estático. 

### Evidencia
- `app/ruta/juego.tsx:646`: wasRouteRecorded y markRouteRecorded son operaciones separadas.
- `app/ruta/juego.tsx:647`: Marca como grabada ANTES de recordGameResult.
- `app/ruta/juego.tsx:643`: recording.current queda true aun si falla el async, sin catch/retry.
- `src/route/storage.ts:197`: La lista recorded usa read-modify-write sin lock y se recorta a 50 códigos.
- `src/storage/profile.ts:125`: recordGameResult no recibe clave idempotente de ruta ni comprueba un resultado existente.
- `src/storage/profile.ts:159`: Perfil y resultados se escriben por separado, no en una transacción con recorded.

### Escenario
Se agota cuota de almacenamiento o se cierra la app entre markRouteRecorded y guardar resultado: al reabrir, wasRouteRecorded ya impide recuperar XP. Dos montajes/pestañas del podio pueden superar simultáneamente el check-before-mark y ejecutar recordGameResult dos veces. Después de 50 rutas, un código evicto tampoco conserva el candado de deduplicación.

### Impacto
Resultado/XP perdido permanentemente o doble registro/inconsistencias por concurrencia. No es duplicación de scores del engine: esos están deduplicados por game; este problema está en el premio local posterior.

### Corrección propuesta
Registrar resultado y recompensa con ID de sesión/epoch único en operación transaccional e idempotente; marcar recorded solo tras commit durable. Mantener ledger de IDs coherente con historial, manejar errores y reintentar sin duplicar.

### Aceptación
Inyectar fallo entre cada escritura y remount recupera exactamente un resultado/XP. Dos registros concurrentes del mismo session ID entregan una sola recompensa. Rutas antiguas y reutilización accidental de código no dependen únicamente del buffer de 50 códigos. Ejecutar con host y al menos tres miembros reales, claves reales, reloj virtual y transporte simulado con entrega programable por destinatario; registrar trace de paquetes/ACK y comprobar invariantes, no solo status joined.

## RT-14 [P3] Mejorar quiet zone y alternativa accesible del QR sin perder verificación

Confianza original del revisor: confirmado estático. 

### Evidencia
- `src/features/route/QrCode.tsx:15`: El dibujo solo reserva dos módulos por lado (offset+2, size+4); la quiet zone convencional de QR es de cuatro.
- `app/ruta/stand.tsx:516`: El stand añade padding blanco fijo de 10 px: compensa parcialmente, pero no garantiza cuatro módulos para tamaños/longitudes distintos.
- `src/features/route/QrCode.tsx:22`: Ya existe role=image y label con URL: no está ausente toda accesibilidad.
- `app/ruta/stand.tsx:240`: Ya existe botón accesible para copiar joinUrl, incluyendo k.
- `src/features/route/parts.tsx:131`: La entrada manual tiene etiqueta accesible pero escribir solo el código no conserva el pin del QR.

### Escenario
Reutilizar QrCode fuera del wrapper o variar tamaño/URL puede dejar margen insuficiente, especialmente para cámara distante o pantallas con reflejo. El lector de pantalla recibe una URL larga como imagen y depende de copiar/compartir para mantener el pin; el camino manual solo-code reduce la garantía de autenticidad.

### Impacto
Mejora de fiabilidad y acceso equivalente al flujo autenticado. No se afirma que el QR actual siempre sea ilegible: el wrapper blanco ayuda y no se ejecutó decodificación óptica ni TalkBack/VoiceOver.

### Corrección propuesta
Incorporar cuatro módulos de quiet zone en el componente, hacer el padding independiente de tamaño, y ofrecer un enlace/acción abrir o compartir la invitación validada con k más label breve y descriptivo. Conservar copy y entrada manual como alternativas.

### Aceptación
Decodificar URL real y URL máxima soportada a 200/260 px con quiet zone interna de cuatro módulos; probar cámara y foco/lector de pantalla en web/Android/iOS. Alternativa accesible conserva codigo+k y no reduce silenciosamente al código solo.

## RT-15 [P3] MQTT ignora rechazo de suscripciones y declara online con solo CONNACK

Confianza original del revisor: confirmado estático. 

### Evidencia
- `src/realtime/mqttClient.ts:218`: online significa CONNACK exitoso, no disponibilidad de topics de aplicación.
- `src/realtime/mqttClient.ts:234`: SUBACK se ignora en default, sin revisar códigos granted=0x80.
- `src/route/host.ts:67`: findReachableBroker solo verifica conexión, no permisos subscribe/publish.
- `src/realtime/config.ts:16`: La configuración admite brokers personalizados y credenciales públicas de compilación.

### Escenario
Un broker configurado acepta CONNECT pero rechaza subscriptions por ACL o límite. Stand/participante ven transporte online aunque no existe flujo de hello/join/state; el miembro ya pinned puede quedarse en la espera sin límite de RT-04.

### Impacto
Diagnóstico falso de disponibilidad y rutas creadas en un broker que no permite su protocolo. Es especialmente relevante para migrar de brokers públicos a uno privado, no evidencia de que los defaults estén denegando hoy.

### Corrección propuesta
Rastrear SUBACK por packet ID, comprobar granted y comunicar estado ready separado de online; incluir subscribe/publicación de comprobación o error accionable en la selección de broker. No tratar EXPO_PUBLIC_MQTT_PASSWORD como secreto ni autenticación por usuario final.

### Aceptación
Simular SUBACK 0x80 da error/fallback visible y nunca ready. CONNACK sin permisos no basta para elegir un broker. Suscripciones exitosas, sesión persistente y reconnect conservan el flujo.

## RT-16 [P2] Errores de persistencia dejan botones de unión/creación cargando sin salida

Confianza original del revisor: confirmado estático. 

### Evidencia
- `app/ruta/index.tsx:65`: Activa joining y luego espera updateIdentity y routeMember.join sin try/catch/finally.
- `app/ruta/index.tsx:71`: El reset de joining solo ocurre si todas las promesas anteriores resuelven.
- `app/ruta/stand.tsx:130`: create establece creating=true y solo lo restaura tras create exitoso.
- `src/route/member.ts:192`: saveMember es requisito previo a conectar y puede rechazar.
- `src/route/host.ts:145`: saveHost también es requisito previo al retorno del controller.
- `src/components/TelButton.tsx:70`: loading deshabilita el botón, por lo que el fallo impide un nuevo intento desde la misma UI.

### Escenario
AsyncStorage/vault fallan por cuota, modo privado, error de IndexedDB/llavero o acceso al disco. La promesa se rechaza; la llamada void del handler no la maneja y joining/creating quedan activos. Offline de red no causa por sí solo estos rechazos; es un escenario de error de almacenamiento.

### Impacto
Acción atrapada y rechazo no manejado, sin feedback ni reintento para entrar/crear ruta. La navegación al juego solo ocurre tras éxito, así que no es una falsa unión, sino bloqueo de interfaz.

### Corrección propuesta
Usar try/catch/finally, mensaje accesible y rollback/cleanup de estados parcialmente creados; separar fallos de persistencia, red y validación. Impedir también doble ejecución por submit del teclado mientras una operación está en curso.

### Aceptación
Inyectar rechazo de updateIdentity/saveMember/saveHost/liberación de lock restablece botones y permite reintentar, sin promesas no manejadas ni controllers huérfanos. Submit repetido de teclado no lanza joins/creates concurrentes.

## RT-17 [P3] Expulsar a un miembro no revoca lectura de futuros estados cifrados

Confianza original del revisor: confirmado estático. 

### Evidencia
- `src/route/host.ts:406`: Todos los miembros reciben la misma sessionKey.
- `src/route/engine.ts:374`: kick marca kicked pero no rota clave ni epoch.
- `src/route/host.ts:367`: Los estados posteriores siguen cifrados con la misma record.sessionKey.
- `src/route/member.ts:478`: Detectar kicked solo cambia status; no desconecta ni elimina credenciales.
- `src/route/member.ts:465`: El miembro sigue procesando estados si conserva sessionKey y hostSign.

### Escenario
Un participante autorizado guarda su clave antes de ser expulsado y mantiene una suscripción MQTT propia. Puede descifrar aliases, ranking y preguntas de la ruta posterior. Puede emitir ciphertexts nuevos con shared key, pero no firma de host ni tokens de otros; engine rechaza sus acciones por kicked.

### Impacto
Revocación incompleta de confidencialidad hacia exmiembros, no takeover ni falsificación del host. Prioridad de mejora depende de si el producto promete privacidad del grupo tras expulsión; el código de sala además se muestra públicamente.

### Corrección propuesta
Si se necesita revocación real, generar epoch/key nuevos y distribuir por box solo a participantes vigentes, con transición de sesión autenticada. Desconectar/limpiar localmente al expulsado mejora UX pero por sí solo no revoca una clave ya conocida.

### Aceptación
Tras kick y rotación, la clave antigua no abre estados del nuevo epoch; miembros restantes retoman sin pérdida/doble score. Tests conservan rechazo de acciones de expulsados y no confunden possession de shared key con autoridad Ed25519.

## RT-18 [P2] El proyecto activo de B213 no termina ni envía al avanzar el grupo

Confianza original del revisor: confirmado estático. 

### Evidencia
- `app/ruta/juego.tsx:190`: El comentario promete terminar/enviar el proyecto en curso al ir a hall, pero solo mantiene ProjectsView.
- `app/ruta/juego.tsx:527`: StationGameHost del proyecto activo no recibe deadline ni forceFinish.
- `src/features/stations/games/TrainAIGame.tsx:77`: TrainAIGame solo consume seed/onComplete, no un deadline global.
- `src/features/stations/games/TrainAIGame.tsx:110`: Mientras se lee/espera Continuar el reloj de etapa no cierra el juego.
- `src/features/stations/kit.tsx:167`: StageBanner puede quedar abierto hasta que el jugador toque.
- `src/route/engine.ts:300`: Scores B213 se aceptan en projects/checkin hall, no durante quiz.
- `app/ruta/juego.tsx:201`: Si el host fuerza quiz, el proyecto en curso se desmonta sin ejecutar su onDone.

### Escenario
El host pulsa Pasar al pasillo ahora o vence projectsSeconds mientras alguien está en un proyecto, por ejemplo leyendo StageBanner de Entrena la IA. El jugador sigue en el proyecto sin cierre forzoso ni envío, en vez de recibir el checkin de hall. Si el host luego inicia trivia sin esperar, el juego se desmonta y su resultado nunca se envía.

### Impacto
Un miembro online puede quedar reteniendo el checkin del grupo hasta completar manualmente el proyecto; un avance posterior pierde lo jugado. El tratamiento de B215 sí tiene forceFinish/deadline, pero ese mecanismo no se aplica a B213.

### Corrección propuesta
Definir política de finalización de proyecto en cambios de fase: forzar entrega parcial una sola vez con API compartida, o preservar y advertir explícitamente la espera. Garantizar envío/ACK antes de desmontar al entrar a trivia, con ventana tardía acordada por engine.

### Aceptación
Avanzar projects→hall durante banner, etapa y summary dispara exactamente un resultado parcial o una transición explícita sin bloqueo. Forzar hall→quiz no descarta silenciosamente lo jugado; pruebas de fase verifican comportamiento y deduplicación. Ejecutar con host y al menos tres miembros reales, claves reales, reloj virtual y transporte simulado con entrega programable por destinatario; registrar trace de paquetes/ACK y comprobar invariantes, no solo status joined.

## RT-19 [P2] La vista del stand en solo lectura no sigue al host autoritativo

Confianza original del revisor: confirmado estático. 

### Evidencia
- `src/route/host.ts:189`: Si acquireHostLock devuelve null, start marca readOnly y retorna antes de instalar transporte/listeners.
- `src/route/host.ts:199`: Los listeners y suscripciones solo se registran después de ganar el lock.
- `src/route/host.ts:272`: buildView deriva snapshot del record local, no de estados firmados del writer.
- `src/route/hostManager.ts:26`: La pestaña lectora carga el record una sola vez; no observa cambios en storage.
- `app/ruta/stand.tsx:276`: El mismo PhasePanel recibe el snapshot estático de la vista readOnly y sigue ofreciendo controles.

### Escenario
La pestaña B abre una ruta que la pestaña A ya conduce. B entra en readOnly correctamente, pero nunca conecta ni observa el record actualizado. A inicia/avanza/recibe miembros y B sigue mostrando la fase y jugadores del momento de apertura. Sus controles siguen apareciendo, aunque dispatch no hace nada al no estar running.

### Impacto
Desincronización permanente de una pantalla del stand con el único writer; el operador ve ranking, fase y acciones obsoletos. Bajo la nueva prioridad de sincronizar TODAS las vistas, no basta que el segundo host deje de escribir.

### Corrección propuesta
Separar driver y observer: readOnly recibe y verifica snapshots actuales sin publicar/tickear; deshabilitar controles de escritura y enlazar explícitamente nueva instancia en takeover. Reanudar desde el último estado durable/autenticado con fencing.

### Aceptación
Con dos pantallas host y tres miembros, el observer alcanza exactamente epoch/revisión/fase/ranking del driver bajo red normal y recuperación. No publica cambios ni permite acciones locales silenciosamente ignoradas. Takeover actualiza la instancia que renderiza la pantalla y conserva una única autoridad. Ejecutar con host y al menos tres miembros reales, claves reales, reloj virtual y transporte simulado con entrega programable por destinatario; registrar trace de paquetes/ACK y comprobar invariantes, no solo status joined.

### Limitaciones originales de la subauditoría
- Snapshot source indicado como HEAD 9eeda63 por el contexto; no contiene .git, por lo que git rev-parse no pudo verificar ese identificador. No se accedió al original C:/Users/Cris/Desktop/TELAPP ni se leyó .env o credenciales.
- Los 25 archivos del alcance explícito se leyeron completos, además de dependencias/pruebas. reviewed_files incluye archivos vistos en búsquedas/extractos parciales; el Markdown distingue lecturas completas de parciales y dependencias, sin afirmar revisión exhaustiva de todo stations/API.
- El snapshot source no tiene node_modules. El intento inicial de Jest sobre source falló por resolución de babel-preset-expo y ejecutó 0 tests; no se clasifica como fallo del producto. Se ejecutaron luego las suites en release-run scratch: 4 suites y 33 tests pasaron. SHA-256 confirmó igualdad de los 25 archivos de alcance y las 4 suites entre source y release-run (29 comparados, 0 diferencias).
- La baseline global de tipos/lint/tests (194 pasadas, 3 omitidas) viene del contexto; esta subauditoría verificó únicamente las 4 suites citadas. No ejecutó LIVE_MQTT=1 ni publicó mensajes en brokers públicos.
- Los hallazgos nuevos son confirmaciones estáticas, no reproducciones end-to-end. Un probe adicional en memoria falló primero por quoting bash; el intento posterior solicitó aprobación y quedó pendiente. No se reemitió ni se atribuyen sus resultados como ejecutados.
- No hubo ejecución en Android/iOS/web ni uso real de cámara/lector de pantalla, backgrounding, Web Locks o caída abrupta del host. Carreras, fallos de persistencia y escenarios de reconexión deben convertirse en pruebas de aceptación.
- No se inspeccionaron valores de EXPO_PUBLIC_* ni ACL/retención efectiva de brokers. El modelo del broker público sin ACL fina es el anunciado en config/crypto; spoofing/retained overwrite y replay requieren acceso real al topic y políticas que admitan publicación.
- No se midió brute force del código, colisiones de fingerprint o resistencia de NaCl. No se encontró una vía estática para falsificar firmas del host, descifrar mensajes sin clave o tomar la identidad de otro participante sin token/box key.
- La nueva exigencia de entrega a la sesión Claude YA EXISTENTE en VSCode se traduce en handoff y gates de aceptación. No se inició otro agente, no se implementaron fixes ni se enviaron cambios a producción. La matriz multi-client con fault injection y el smoke MQTT aislado todavía NO están ejecutados; las 33 pruebas existentes no satisfacen esos gates nuevos.

# Área: gameplay

## GAME-01 [P1] El bono diario se vuelve a conceder al repetir sin salir de la pantalla

Confianza original del revisor: alta; defecto confirmado por ejecución. 

### Evidencia
- `app/burst.tsx:143`: dailyDone se carga una sola vez al montar; no se actualiza tras guardar una ráfaga.
- `app/burst.tsx:225`: Cada finalización calcula daily && !dailyDone ? DAILY_BONUS : 0.
- `app/burst.tsx:373`: Jugar otra vez inicia una nueva sesión en la misma pantalla.

### Escenario
Abrir /burst?diario=1 con el día pendiente, finalizar, tocar Jugar otra vez y finalizar nuevamente. Probe daily-repeat-bonus-and-incomplete-rounds registra dos resultados con score=250 en la misma instancia, ambos con score base=0.

### Impacto
Bono supuestamente diario ilimitado y XP derivada incorrecta en repeticiones; el guard recorded solo protege una sesión, no una reclamación diaria.

### Corrección propuesta
Reclamar el bono por clave de día mediante una operación idempotente de almacenamiento; actualizar dailyDone tras la reclamación. Capturar la clave del día al empezar la partida.

### Aceptación

- Dos finalizaciones secuenciales y concurrentes el mismo día conceden un solo bono de 250.
- Cambiar de día permite otra reclamación; repetir o remontar pantalla no la permite.

## GAME-02 [P2] Perder en tres rondas marca el desafío diario como completado

Confianza original del revisor: alta; defecto confirmado por ejecución. 

### Evidencia
- `app/burst.tsx:105`: finished incluye lives<=0 aunque falten rondas.
- `app/burst.tsx:225`: El bono no comprueba rondas terminadas ni supervivencia.
- `app/burst.tsx:232`: Toda finalización diaria escribe metadata.daily.
- `src/features/burst/daily.ts:25`: isDailyDone solo requiere gameId burst y metadata.daily; dailyDays tampoco valida finalización.

### Escenario
En un desafío de cinco rondas fallar las tres primeras. Probe registra rounds=3, lives=0, accuracy=0, score=250 y metadata.daily no vacía. isDailyDone lo considera completado; la pantalla promete Termínalo y suma el bono (app/burst.tsx:285).

### Impacto
Cita diaria/Constancia y estado diario cuentan derrotas prematuras como desafíos terminados. También consume la reclamación del día si se sale y vuelve a entrar.

### Corrección propuesta
Distinguir finished/attempt de completed, guardar completed explícito y requerir todas las rondas para reclamar el bono y contar dailyDays. Mantener XP base de participación si esa es la política.

### Aceptación

- Una derrota 0/5 con tres vidas perdidas no concede bono ni incrementa días completados.
- Una sesión que alcanza la quinta ronda según la regla de éxito acordada sí cuenta.

## GAME-03 [P1] Completar capítulo admite dos finalizaciones mientras espera almacenamiento

Confianza original del revisor: alta; defecto confirmado por ejecución. 

### Evidencia
- `app/story.tsx:100`: complete no tiene guard síncrono ni estado saving; primero espera completeChapter.
- `app/story.tsx:104`: Cada invocación llama a recordGameResult.
- `app/story.tsx:131`: Completar capítulo permanece habilitado hasta que la fase cambia al final de los awaits.
- `src/storage/profile.ts:125`: recordGameResult no recibe una identidad de sesión idempotente.

### Escenario
Resolver el primer capítulo y activar Completar capítulo dos veces antes de que termine la primera escritura. Probe story-double-finalization ejecuta el callback dos veces en un act y observa dos solicitudes idénticas: story, score 200, chapter 1, accuracy 1.

### Impacto
Doble solicitud de XP/resultados y prácticas de Innovación. Con almacenamiento read-modify-write concurrente puede duplicar contabilización o perder actualizaciones; el harness no demuestra qué interleaving gana en disco real.

### Corrección propuesta
Añadir ref síncrona submitting antes del primer await, deshabilitar el botón, manejar errores y usar runId idempotente en el registro de resultados.

### Aceptación

- Con completeChapter deliberadamente lento, doble toque produce una sola llamada y un solo resultado persistido.
- Un fallo muestra error recuperable y permite reintentar sin duplicar el capítulo ni su recompensa.

## GAME-04 [P1] Una respuesta de guardado anterior interrumpe la partida nueva

Confianza original del revisor: alta; defecto confirmado por ejecución. 

### Evidencia
- `app/estacion.tsx:65`: Jugar de nuevo está disponible cuando result.outcome aún es null.
- `app/estacion.tsx:111`: El then restaura setResult de la sesión anterior sin verificar run.key.
- `app/puzzle.tsx:75`: onSolved espera almacenamiento mientras ya muestra botones para reiniciar.
- `app/puzzle.tsx:84`: La respuesta tardía vuelve a asignar solved de la sesión anterior.

### Escenario
Hacer que recordGameResult tarde, finalizar una estación con 800, pulsar Jugar de nuevo y recién entonces resolver la promesa vieja. Probe station-old-save-replaces-new-game confirma que el nuevo juego montado desaparece y vuelve el resumen viejo. En puzzle el mismo patrón se confirma estáticamente.

### Impacto
Desmonta la partida recién iniciada y pierde su progreso local; navegación y niveles pueden retroceder por un resultado obsoleto.

### Corrección propuesta
Capturar un token de sesión y actualizar UI solo si coincide con la sesión vigente; invalidarlo al reiniciar/cambiar ruta/desmontar. Alternativamente bloquear reinicio mientras se guarda, con error/reintento visibles.

### Aceptación

- Resolver una promesa de sesión A después de iniciar B no modifica ni desmonta B.
- Repetir el test en estación y puzzle, también al cambiar nivel y al desmontar pantalla.

## GAME-05 [P2] La ráfaga individual no pausa al pasar a background

Confianza original del revisor: alta; defecto confirmado por ejecución. 

### Evidencia
- `app/burst.tsx:187`: Solo la pausa manual detiene el intervalo; deadline usa Date.now.
- `app/burst.tsx:196`: Al regresar después del deadline la ronda despacha answer false.
- `src/features/coach/PauseSheet.tsx:46`: useBackToPause escucha únicamente hardwareBackPress, no AppState ni visibilidad/foco.
- `src/features/stations/kit.tsx:30`: Las estaciones también mantienen tiempos absolutos sin ciclo de vida de app.

### Escenario
Empezar una ronda, suspender callbacks 30 s simulando background y ejecutar el siguiente tick con el reloj adelantado. Probe burst-background-time-expiration confirma active=false por expiración, sin tocar pausa. La ausencia de listener AppState/visibilitychange se verificó en el código del snapshot.

### Impacto
Interrupciones del SO consumen el tiempo y las vidas de una práctica individual. Las etapas cronometradas de estaciones presentan el mismo riesgo. No se afirma reproducción física Android/iOS.

### Corrección propuesta
Pausar automáticamente la práctica individual al perder estado activo/foco y conservar remainingMs; reanudar de manera explícita. Mantener el deadline autoritativo para juegos de ruta sincronizados, que no deben pausarse independientemente.

### Aceptación

- Simular AppState active→background→active y visibilitychange: tiempo y vidas de práctica permanecen intactos.
- Probar estación individual y ráfaga; verificar separadamente que el deadline multijugador sigue siendo autoritativo.

## GAME-06 [P2] La ráfaga rápida avanza y guarda mientras muestra En pausa

Confianza original del revisor: alta; defecto confirmado por ejecución. 

### Evidencia
- `app/burst.tsx:214`: El timeout de FEEDBACK_MS no depende de paused ni lo comprueba.
- `app/burst.tsx:220`: Llegar a finished registra el resultado aunque paused siga true.
- `app/burst.tsx:209`: La pausa se ofrece también durante feedback.

### Escenario
Ritmo fast; perder la tercera vida; abrir Pausar durante el feedback antes de 1150 ms. Probe burst-fast-feedback-finishes-while-paused confirma recordGameResult mientras la pausa estaba activa.

### Impacto
La decisión de salir sin guardar queda anulada por una finalización automática; en rondas intermedias avanza el estado detrás del modal.

### Corrección propuesta
Congelar también el reloj de feedback al pausar y bloquear advance/answer/finished no autorizados; conservar su tiempo restante.

### Aceptación

- Pausar 10 s en feedback no avanza ni escribe resultados.
- Reanudar continúa desde feedback; Salir no registra la partida.

## GAME-07 [P2] Atrapa el paquete puede generar menos paquetes sanos que los necesarios

Confianza original del revisor: alta; defecto confirmado por ejecución. 

### Evidencia
- `src/features/burst/games/PacketCatchGame.tsx:20`: NEED exige cinco paquetes sanos.
- `src/features/burst/games/PacketCatchGame.tsx:38`: Cada aparición decide bad independientemente, sin cuota mínima de sanos.
- `src/features/burst/games/PacketCatchGame.tsx:46`: El período de aparición es finito y depende del nivel.
- `src/features/burst/registry.tsx:66`: La ronda 7 fast del juego de base 12 s dura 7 s.
- `app/burst.tsx:485`: level equivale al índice de ronda.

### Escenario
Ronda 8 (level=7), fast, 7 s. Inyectar Math.random=mulberry32(247): aparecen 20 paquetes, solo 4 sanos. Probe packet-catch-unwinnable-rng-stream atrapó inmediatamente los cuatro y nunca pudo enviar onAnswer(true). Esta semilla se inyecta al RNG, no existe como prop del microjuego.

### Impacto
Condición de victoria imposible en un flujo RNG válido, incluso con reflejos perfectos. No se estimó frecuencia real ni se afirma que suceda en todas las partidas.

### Corrección propuesta
Generar una secuencia con al menos cinco sanos antes del deadline con margen de lectura/reacción; inyectar RNG y comprobar viabilidad para todos los ritmos/niveles.

### Aceptación

- La semilla 247 permite cinco capturas antes de 7 s.
- Property test de muchas semillas y todas las combinaciones soportadas garantiza cuota mínima y ventanas utilizables.

## GAME-08 [P2] Entrena la IA penaliza detenerse en el mínimo que dibuja la curva

Confianza original del revisor: alta; defecto confirmado por ejecución. 

### Evidencia
- `src/features/stations/logic/vision.ts:207`: validationLoss sigue decreciendo después del parámetro best por el término exponencial.
- `src/features/stations/logic/vision.ts:212`: stopQuality premia distancia al parámetro best, no al mínimo real de validationLoss.
- `src/features/stations/games/TrainAIGame.tsx:55`: La instrucción pide detener cuando la validación deje de bajar.
- `src/features/stations/games/TrainAIGame.tsx:341`: Se dibuja la curva con validationLoss(value,best).

### Escenario
Para best=11, mínimo discreto dibujado está en época 13. Probe vision-validation-minimum muestra 272/350 al detener en 13, contra 350/350 en 11. Los seis best posibles divergen del mínimo visual (1 o 2 épocas).

### Impacto
Contradice la lección de early stopping: seguir correctamente la gráfica obtiene menos puntos que detenerse cuando aún mejora.

### Corrección propuesta
Calcular el mínimo de la misma curva utilizada para dibujar y evaluar, o parametrizar la curva para que su mínimo sea exactamente best. Alinear también mensajes Justo a tiempo/Muy tarde.

### Aceptación

- Para cada best=11..16, detener en argmin de la pérdida dibujada consigue TRAIN_MAX.
- Épocas anteriores/posteriores reducen calidad con mensajes coherentes con la pendiente.

## GAME-09 [P2] Historia anuncia XP pero envía ese valor como puntos a otra fórmula

Confianza original del revisor: alta; defecto confirmado por ejecución. 

### Evidencia
- `app/story.tsx:172`: El feedback anuncia +chapter.rewardXp XP.
- `app/story.tsx:106`: complete manda chapter.rewardXp como score.
- `src/storage/profile.ts:137`: La XP realmente otorgada sale de calculateGameXp.
- `src/lib/progression.ts:29`: XP combina base, 8% del score, precisión y duración.

### Escenario
Completar en 60 s y al primer intento: los capítulos anuncian 200/300/450/550/700 XP, pero la fórmula real devuelve 111/119/131/139/151. Probe story-reward-vs-awarded-xp usa los datos reales y la función real, no el recordGameResult simulado del harness de componentes.

### Impacto
Promesa de recompensa y resultado efectivo divergen en todos los capítulos; explica mal la progresión educativa.

### Corrección propuesta
Definir rewardScore y mostrar puntos, o crear una concesión explícita de rewardXp por capítulo que no vuelva a convertirlo como score. Mostrar solo la XP realmente concedida.

### Aceptación

- El texto antes/después de completar coincide con la variación real de profile.xp para cada capítulo.
- Probar aciertos con reintentos y sesiones de más de 300 s.

## GAME-10 [P2] Leer la explicación de la placa consume y descarta los proyectos restantes

Confianza original del revisor: alta; defecto confirmado por ejecución. 

### Evidencia
- `src/features/stations/games/MakerBoardsGame.tsx:165`: timeout de ChooseStage sigue activo mientras picked y el Continuar están pendientes.
- `src/features/stations/games/MakerBoardsGame.tsx:183`: choose instala una acción para Siguiente proyecto.
- `src/features/stations/kit.tsx:118`: ask posterior reemplaza pending, incluida la acción anterior.

### Escenario
En la etapa Elige la placa contestar el primer proyecto y dejar la explicación abierta 27 s en pace=1. Probe maker-reading-feedback-discards-remaining-projects: Siguiente proyecto desaparece, Continuar lleva directamente a etapa 2 tras solo 1/4 proyectos.

### Impacto
La pausa educativa para leer reduce el puntaje y omite contenido; contradice el propósito explícito de avanzar al ritmo del jugador.

### Corrección propuesta
Suspender presupuesto de la etapa mientras la explicación está pendiente y conservar tiempo restante. Separar el reloj del deadline autoritativo de ruta si existe.

### Aceptación

- Esperar un minuto leyendo el primer feedback no omite los otros tres proyectos en práctica individual.
- Al continuar se presenta proyecto 2; el tiempo de decisión restante es el previo a la lectura.

## GAME-11 [P2] Conecta la red informa precisión perfecta cuando todas las piezas las resuelven pistas

Confianza original del revisor: alta; defecto confirmado por ejecución. 

### Evidencia
- `src/features/puzzles/NetWalkGame.tsx:99`: Se penaliza score por usedHints, pero no accuracy.
- `src/features/puzzles/NetWalkGame.tsx:102`: optimal/max(usedMoves,optimal) resulta 1 cuando usedMoves=0.
- `src/features/puzzles/NetWalkGame.tsx:126`: La pista gira automáticamente una pieza hasta su solución.
- `app/puzzle.tsx:79`: Esta accuracy pasa directamente al registro de resultados y XP.

### Escenario
Seed 123, level 1: tocar solo Pista hasta finalizar. Probe netwalk-hint-only-perfect-accuracy devuelve score=520, accuracy=1, detalle 0 giros (mínimo 11) · 6 pistas.

### Impacto
La métrica de precisión y sus 60 XP de bonificación representan asistencia completa como ejecución perfecta. El desbloqueo por pistas puede ser legítimo; la precisión sin distinción es la inconsistencia.

### Corrección propuesta
Guardar asistencia separada y excluirla de la precisión de resolución independiente; definir explicitamente assistedCompletion y su recompensa sin castigar acceso a ayudas.

### Aceptación

- Solución exclusivamente asistida no se registra como 100% independiente.
- Solución manual óptima mantiene 100%; solución mixta refleja cantidad de ayuda sin bloquear aprendizaje.

## GAME-12 [P3] La partida perfecta de Mensaje cifrado termina en 999 y no en 1000

Confianza original del revisor: alta; defecto confirmado por ejecución. 

### Evidencia
- `src/features/puzzles/codes.ts:68`: Hay tres mensajes.
- `src/features/puzzles/codes.ts:109`: Cada mensaje perfecto redondea 1000/3 a 333.
- `src/features/puzzles/CipherGame.tsx:54`: Se suman los tres redondeos; Math.min(1000,score) no recupera el punto perdido.

### Escenario
Resolver los tres mensajes sin comprobaciones fallidas. Probe cipher-perfect-score calcula la suma real: 3*333=999.

### Impacto
Techo de puntuación incoherente con la distribución nominal de 1000; impacto menor, no impide ganar ni desbloquear sus niveles.

### Corrección propuesta
Acumular fracciones y redondear al final, o distribuir 334/333/333 preservando penalizaciones.

### Aceptación

- Tres mensajes perfectos suman exactamente 1000.
- Penalizaciones y mínimo por mensaje siguen siendo monotónicos.

## GAME-13 [P3] Congestión de red promete doce envíos pero exige hasta dieciocho

Confianza original del revisor: alta; defecto confirmado por inspección estática. 

### Evidencia
- `src/features/burst/catalog.ts:25`: instruction y tip dicen 12 paquetes/envíos.
- `src/features/burst/games/PacketRushGame.tsx:15`: target=12+min(level,3)*2, por lo que puede ser 14,16,18.
- `app/burst.tsx:479`: La pantalla mantiene la instrucción del catálogo mientras level cambia por ronda.

### Escenario
Recibir PacketRushGame con level=3 (ronda 4 o posterior): la introducción dice enviar 12 y el contador/condición requieren 18. Confirmación estática de ambos valores.

### Impacto
Instrucción falsa en el momento de aprender y aparente incumplimiento de la victoria al alcanzar lo anunciado. No es prueba de que la dificultad adaptativa esté rota.

### Corrección propuesta
Generar instruction/tip a partir del mismo target del motor, o eliminar el número fijo del catálogo.

### Aceptación

- Para niveles 0..7, objetivo anunciado, contador y condición de victoria usan el mismo número.

## GAME-14 [P3] La primera práctica de estación guarda duración fija de noventa segundos

Confianza original del revisor: alta; defecto confirmado por inspección estática. 

### Evidencia
- `app/estacion.tsx:29`: run.startedAt inicia en 0.
- `app/estacion.tsx:67`: Solo Jugar de nuevo asigna startedAt real.
- `app/estacion.tsx:108`: La primera partida siempre registra durationSeconds=90.
- `src/lib/progression.ts:32`: La duración influye en el bono de XP con umbral de 300 s.

### Escenario
Entrar por primera vez a /estacion y finalizar cualquier juego: se guardan 90 s sin importar lo transcurrido. Repetir sí mide la duración. Confirmación estática del flujo.

### Impacto
Métricas educativas de tiempo falsas y primera sesión larga recibe el bono de sesión corta. No se calculó impacto agregado sobre perfiles existentes.

### Corrección propuesta
Inicializar startedAt con now() cuando realmente empieza la primera sesión, y decidir si lectura/pausas cuentan como tiempo educativo o tiempo activo.

### Aceptación

- Con reloj controlado, primera sesión de 420 s y repetición de 60 s guardan 420 y 60 respectivamente.
- El bono de duración usa el tiempo acordado y no una constante de fallback.

## GAME-15 [P2] La explicación sobre Wi-Fi abierta omite el cifrado extremo a extremo

Confianza original del revisor: alta; defecto confirmado por inspección estática. 

### Evidencia
- `src/features/burst/concepts.ts:78`: La red abierta se explica como: Sin clave, cualquiera cerca puede leer lo que envías.
- `src/features/stations/logic/security.ts:71`: La alerta sin contraseña se justifica como: Cualquiera puede espiar el tráfico.
- `src/data/questions.ts:64`: La propia pregunta sec-006 explica que HTTPS cifra los datos de la conexión.

### Escenario
En Wi-Fi seguro seleccionar/redescubrir la opción abierta y leer la explicación; en Escudo digital marcar sin contraseña. Se presenta sin distinguir contenido en claro, metadatos y contenido protegido por TLS. La clasificación del portal falso que pide la contraseña de Instagram sí es correcta.

### Impacto
La lección confunde cifrado del enlace Wi-Fi con cifrado HTTPS y transmite una regla absoluta falsa sobre confidencialidad del contenido. No implica una vulnerabilidad de la app ni que el juego permita sitios peligrosos.

### Corrección propuesta
Explicar que una red abierta carece de cifrado del enlace y expone tráfico no cifrado/metadatos, pero HTTPS sigue protegiendo el contenido frente a observadores de la red; mantener advertencia sobre portals falsos y verificación de certificados.

### Aceptación

- Las explicaciones distinguen WPA/TLS y no afirman que el contenido HTTPS sea legible solo por faltar contraseña Wi-Fi.
- La tarjeta de portal que pide claves de redes sociales sigue marcada como amenaza.

### Limitaciones originales de la subauditoría
- Snapshot sin .git; HEAD 9eeda63ca123ee69eaefec8f671ffebc6956ae8a se toma de baseline.json entregado por el coordinador. No se accedió al repositorio original ni a Claude ni a credenciales.
- Sin dispositivo/emulador Android/iOS ni browser físico. Background confirmado por lógica y salto de reloj en renderer, no por Home/notificación real.
- El harness ejecuta TS/TSX reales con React test renderer y mocks de componentes visuales, router, settings, feedback y almacenamiento. El test de estaciones Maker usa kit/withContinue reales. El renderer está deprecado y emitió ese aviso; no invalida los asserts.
- Los probes confirman llamadas y estado; no demuestran doble recompensa persistida en AsyncStorage real ante carreras. Se requiere integration test con almacenamiento real/lento.
- Se verificaron hashes idénticos de los 217 archivos app/src/tests entre source y release-run antes de ejecutar allí la suite relacionada: 13 suites,132 tests pasan. Baseline global proporcionado: 194 pasan,3 skipped,tipos/lint limpios; no se volvió a correr el check global ni tests API/ruta fuera de este alcance.
- Faltan pruebas de pantallas y de gestos nativos: las suites burst/puzzles/stations prueban principalmente registro/motores/datos, no pausa, doble finalización o promesas tardías. Los probes no sustituyen E2E en dispositivos.
- Dificultad observada: burst acelera por ronda/pace, runner por distancia, puzzles por nivel resuelto, quiz por escalera fija. No hay ajuste por historial de errores, dominio de área o velocidad de lectura. Es una brecha de diseño si se pretende adaptación al aprendizaje, no un defecto confirmado sin requisito explícito.
- RNG del desafío diario fija selección de juegos, no sus preguntas/posiciones internas: los microjuegos usan Math.random sin semilla compartida. No se etiqueta como defecto contractual porque el código promete misma selección, no la misma instancia de pregunta.
- Se revisaron malla/career/story/rutixPlay y sus relaciones internas; no se contrastó la malla con una fuente curricular oficial ni la validez académica completa con expertos. El simulador de IA es una representación pedagógica, no entrenamiento real de un clasificador.
- Hipótesis separadas: gestos o taps despachados antes del rerender podrían perder actualizaciones en contadores que usan estado capturado; requieren reproducción en cola de eventos nativa. No se elevó todo uso de setState a defecto.
- Interpretación de ayudas: finalizar puzzle con pistas y desbloquear niveles puede ser intencional; GAME-11 señala solo que la precisión independiente no distingue asistencia.
- No se modificaron fuentes ni se propusieron parches ejecutados; solo informes/probes y resultados en scratch.

# Área: ux-storage

## UXS-01 [P1] Mutaciones concurrentes sobrescriben progreso completo sin coordinación

Confianza original del revisor: 0.99. 

### Evidencia
- `src/storage/profile.ts:129`: Cada recordGameResult lee el mismo perfil/historial antes de computar y guardar.
- `src/storage/profile.ts:159`: Perfil e historial se escriben por separado mediante Promise.all, sin transacción ni ID idempotente.
- `app/mascot.tsx:120`: interact guarda un perfil completo tomado de data; no relee la versión actual ni bloquea otro cuidado.
- `src/storage/runner.ts:82`: recordRun/addRunnerData/unlock usan read-modify-write sin exclusión mutua.
- `src/storage/career.ts:31`: recordAreaPractice comparte el patrón; también completeChapter y recordPuzzleSolved en sus stores.

### Escenario
Dos recordGameResult solapados, o una recompensa/cuidado mientras se sincroniza perfil. Probe: dos resultados concurrentes dejan gamesPlayed=1 e historial de longitud 1, no 2.

### Impacto
Pérdida de XP, partidas, logros o paquetes; el perfil stale de Rutix puede pisar un merge de cuenta. Escrituras parciales también desalinean perfil e historial.

### Corrección propuesta
Centralizar mutaciones mediante cola por agregado y operación, parches sobre versión vigente y deduplicación por resultId. Persistir una unidad consistente o journal recuperable para operaciones multi-clave; bloquear dobles acciones en UI como defensa secundaria.

### Aceptación

- Dos resultados simultáneos conservan ambos y suman XP exacto; mismo ID repetido cuenta una vez.
- Interleave resultado/cuidado/merge y premio/recordRun conserva todos los cambios.
- Inyectar fallo en cada escritura y relanzar: no queda perfil adelantado con historial perdido.

## UXS-02 [P1] El decaimiento de ánimo se descuenta otra vez al guardar alias o cuidar a Rutix

Confianza original del revisor: 0.99. 

### Evidencia
- `src/storage/profile.ts:55`: loadProfile devuelve un ánimo ya decaído, sin actualizar un timestamp de aplicación.
- `src/storage/profile.ts:64`: Los mismos días desde lastPlayedAt se descuentan en todas las cargas.
- `src/storage/profile.ts:193`: updateIdentity persiste el perfil decaído sin mover lastPlayedAt; updateMascotMood y syncAchievements hacen lo mismo.

### Escenario
Perfil con ánimo 80 y última partida hace tres días: cargar da 62; guardar solo alias y cargar de nuevo da 44. Probe ejecutado con el código del snapshot.

### Impacto
Señal se degrada por editar identidad o cuidarlo, no solo por ausencia; gastos de cuidado pueden parecer inútiles.

### Corrección propuesta
Guardar base de ánimo y moodUpdatedAt/lastDecayAt; aplicar solo tiempo no consumido, o derivar visualmente sin volver a persistir el valor derivado como base. Migrar explícitamente perfiles existentes.

### Aceptación

- Cargar/guardar alias/avatar diez veces el mismo día mantiene 62 en el caso de prueba.
- Cuidados y recompensas suman el delta sin volver a descontar días ya procesados.
- Un día adicional descuenta exactamente 6 una sola vez, con mínimo documentado.

## UXS-03 [P1] Recompensa de misiones queda reclamada antes de entregar todos sus componentes

Confianza original del revisor: 0.99. 

### Evidencia
- `src/storage/missions.ts:19`: Check y marca de reclamo no son atómicos; la marca se escribe antes de cargar perfil/entregar premio.
- `src/storage/missions.ts:22`: Paquetes y ánimo se escriben en paralelo; no hay recuperación de entrega parcial.
- `src/features/missions/MissionsCard.tsx:42`: claim no tiene pending, catch ni disabled/loading en el botón de línea 90.

### Escenario
Después de guardar la fecha, falla @soytel/runner. Probe: queda marca del día, no billetera, y el reintento devuelve false. Dos taps pueden además pasar el check simultáneo.

### Impacto
Premio perdido de forma permanente para ese día; la UI puede no explicar el fallo o indicar una entrega incompleta.

### Corrección propuesta
Transacción/journal idempotente por día con estado pending/committed y suboperaciones deduplicables; no basta mover la marca al final sin impedir duplicaciones. Estado de carga y error recuperable en el botón.

### Aceptación

- Fallo en carga de perfil, billetera o ánimo permite reintento que completa cada parte exactamente una vez.
- Dos reclamos simultáneos entregan una sola recompensa y tienen respuesta consistente.
- Botón anuncia busy, bloquea reentrada y muestra error sin mensaje falso de guardado.

## UXS-04 [P2] Hidratación tardía de settings reemplaza cambios recién realizados

Confianza original del revisor: 0.99. 

### Evidencia
- `app/_layout.tsx:27`: initSettings se dispara sin await; ready solo depende de fuentes, líneas 21-22 y 40.
- `src/storage/settings.ts:88`: initSettings asigna el snapshot leído aunque haya mutaciones posteriores.
- `src/storage/settings.ts:98`: updateSettings parchea defaults/cache disponible; no espera hidratación.

### Escenario
Abrir Ajustes con lectura lenta y desactivar hápticos. Probe deja cache.haptics=true mientras AsyncStorage contiene false cuando termina la lectura antigua.

### Impacto
Ajustes parecen revertirse y preferencias previas de otros campos pueden perderse al escribir un patch sobre defaults.

### Corrección propuesta
Promise única de hidratación con ready/error, bloquear o encolar mutaciones hasta ready y reconciliar por versión. Resolver init/reload/reset en el mismo coordinador.

### Aceptación

- Lectura diferida + update conserva intención del usuario en memoria y disco.
- Patch temprano no borra pace/motion/accesorio persistidos.
- Repetir init no pisa cambios más nuevos ni duplica suscripciones.

## UXS-05 [P1] Reset no cancela escrituras pendientes y puede terminar parcialmente

Confianza original del revisor: 0.99. 

### Evidencia
- `src/storage/reset.ts:23`: multiRemove elimina claves sin barrera para mutaciones ya iniciadas.
- `src/storage/reset.ts:24`: clearRouteStorage/resetAccountLocal se ejecutan después del borrado y antes de limpiar caches.
- `app/ajustes.tsx:106`: Cadena de reset/tema/navegación sin catch ni estado busy.

### Escenario
Una edición de perfil empieza antes del reset pero setItem termina después. Probe: alias Resurrected vuelve a aparecer tras resolver resetAllData. Si falla una etapa posterior, ya se borraron claves pero caches/UI no necesariamente se limpiaron.

### Impacto
Datos supuestamente borrados reaparecen; identidad/XP de la sesión previa o estados locales parciales. Esto es local: no se afirma eliminar ni auditar la cuenta del servidor.

### Corrección propuesta
Entrar a una generación reset que invalide lecturas/escrituras anteriores, detener productores y drenar/abortar cola antes de borrar. Manejar todas las etapas y reportar fallo parcial recuperable; unificar tema y reset sin introducir borrado remoto.

### Aceptación

- Retener setItem/getItem y resolverlos tras reset no resucita perfiles, avisos, tutoriales ni settings.
- Fallo en cada etapa limpia o invalida caches y comunica qué falta, sin toast de éxito.
- Dos resets simultáneos y reset durante sync conservan estado local vacío; onboarding respeta keepOnboarding.

## UXS-06 [P2] Ventana de 200 resultados se usa como progreso acumulado de colección y guía

Confianza original del revisor: 0.99. 

### Evidencia
- `src/storage/profile.ts:140`: Se conservan solo los 200 resultados más recientes.
- `src/lib/achievements.ts:91`: Colecciones burst y niveles puzzle se recomputan desde esa ventana; también contadores por modo y días diarios.
- `src/lib/guide.ts:25`: starterGuide calcula primeras actividades mirando solo results.
- `app/(tabs)/achievements.tsx:35`: current visible se recomputa aunque ya exista la marca unlocked.

### Escenario
Un microjuego/primer modo se completó y luego hay 200 resultados de otro modo. Probe: burst-collector cae de 1 a 0 y la guía vuelve a dar la primera Ráfaga por pendiente.

### Impacto
Avance parcial se olvida y puede impedir completar colecciones; guía retrocede. Las medallas ya presentes en unlockedAchievements NO se borran automáticamente.

### Corrección propuesta
Separar historial reciente de agregados durables: modos usados, niveles distintos, microjuegos ganados, días de desafío, counters y récords. Migrar desde historial conservado sin inventar eventos ya truncados.

### Aceptación

- 301+ resultados no reducen contadores acumulados ni pasos ya completados.
- Completar una colección en sesiones separadas por más de 200 partidas desbloquea correctamente.
- Las tarjetas unlocked presentan el umbral cumplido incluso si no está el evento histórico.

## UXS-07 [P2] Recarga de inbox puede pisar un aviso nuevo y persistir su pérdida

Confianza original del revisor: 0.99. 

### Evidencia
- `src/storage/inbox.ts:46`: loadInbox reemplaza cache después de una lectura sin revision/promise única.
- `src/storage/inbox.ts:40`: persist actualiza cache antes de confirmar disco y puede escribir el snapshot sustituido.
- `app/(tabs)/inbox.tsx:38`: Cada entrada enfocada llama loadInbox además del boot global.

### Escenario
Una lectura lenta captura inbox antiguo; llega pushInbox nuevo; termina lectura vieja; marcar leído escribe cache vieja. Probe confirma que solo Old queda y New desaparece.

### Impacto
Avisos de logros/subida de nivel pueden perderse o volver a no leídos; render y disco divergen si falla persist.

### Corrección propuesta
Store único hidratado, revisions/generación y cola de mutaciones. Cargas stale no sustituyen cambios más recientes; rollback o pending explícito en persist.

### Aceptación

- Interleave load/push/markRead conserva cada aviso y su última marca.
- Carga de boot y de foco comparten hidratación sin duplicación.
- Inyectar fallo en setItem no da por durable el aviso ni su lectura.

## UXS-08 [P2] Perfil y resultados aceptan JSON válido con estructura inválida

Confianza original del revisor: 0.99. 

### Evidencia
- `src/storage/profile.ts:47`: Spread de JSON como Partial<UserProfile> sin validar strings/números finitos/fechas/rangos.
- `src/storage/profile.ts:87`: loadResults comprueba solo Array.isArray; [null] se acepta.
- `src/storage/profile.ts:222`: loadProgressSummary accede result.gameId sin guard de entradas.
- `app/(tabs)/inbox.tsx:106`: kindStyle[item.kind] se usa sin fallback; loadInbox tampoco valida un enum.

### Escenario
Carga local dañada por migración/fallo parcial: results=[null] o perfil xp="900", mascotMood="bad". Probe confirma TypeError al resumir progreso y xp string aceptado.

### Impacto
Render/sync/logros pueden fallar; XP concatena strings o ánimo se vuelve NaN. El fallback silencioso puede ocultar pérdida de progreso.

### Corrección propuesta
Schemas versionados para cada store con validación finita/rangos y migraciones; filtrar/quarantinar entradas inválidas con recuperación, sin sobrescribir automáticamente toda evidencia dañada.

### Aceptación

- Fixtures con null, arrays donde se espera objeto, unknown gameId/kind, NaN/Infinity serializados como null y fechas inválidas no rompen UI.
- Datos válidos antiguos se migran; solo registros corruptos se aíslan.
- Usuario recibe recuperación/exportación segura si su progreso no es legible.

## UXS-09 [P2] useFocusData no expone errores y reload acepta respuestas fuera de orden

Confianza original del revisor: 0.99. 

### Evidencia
- `src/lib/useFocusData.ts:15`: La carga de foco tiene guard active pero solo .then; no hay catch ni error state.
- `src/lib/useFocusData.ts:25`: reload no comprueba active, generación ni orden; escribe setData directamente.
- `app/_layout.tsx:27`: Cargas globales son void sin captura local; un ErrorBoundary de render no recupera promesas rechazadas.

### Escenario
Dos reload: el nuevo responde primero y el antiguo último. Probe de hooks mínimos termina con [new, old]. Un getItem rechazado deja data null/loading indefinido y rechazo sin tratamiento por el hook.

### Impacto
Datos antiguos pisan datos nuevos o el usuario ve skeleton sin reintento. Riesgo de callback tras desmontar; no se afirma una fuga permanente de memoria.

### Corrección propuesta
Agregar estado error/retry, ID de solicitud y cancelación/generation compartida para foco/reload. Capturar rechazos también en boot y operaciones UI; fallback por pantalla y error boundary para errores de render, no como sustituto de catch async.

### Aceptación

- Respuesta antigua tras nueva no cambia data.
- Unmount/blur antes de resolver no modifica estado por foco ni reload.
- Loader rechazado muestra error accesible y Reintentar funciona; no queda promise unhandled.

## UXS-10 [P2] Primer tutorial automático de Rutix depende de una invitación de cuenta que esa pantalla no muestra

Confianza original del revisor: 0.98. 

### Evidencia
- `src/storage/tutorials.ts:46`: Todo tutorial se bloquea para guest con offerDismissed=false.
- `app/mascot.tsx:77`: Pantalla Rutix usa useTutorial(rutix), sin montar AccountGate.
- `app/mascot.tsx:364`: TutorialSheet depende de tutorial.visible; HelpButton puede abrirlo manualmente.
- `src/features/account/AccountGate.tsx:23`: offerDismissed se resuelve mediante la invitación montada en juegos, no en Rutix.

### Escenario
Invitado entra a Rutix desde Inicio antes de abrir un juego y omitir la invitación. Probe del hook: pending=true, visible=false aun cargados los tutoriales vistos.

### Impacto
Onboarding automático de cuidados se omite en primera visita. No hay bloqueo total: Conoce a Rutix permite abrirlo manualmente.

### Corrección propuesta
Hacer el bloqueo una prop contextual isBlockingOverlayVisible, no una dependencia global del estado guest; montar gate solo donde corresponda. Decidir qué pantallas deben explicar y marcar visto de forma durable.

### Aceptación

- Invitado de primera visita recibe tutorial Rutix sin exigir cuenta ni abrir gameplay.
- En pantallas con gate visible solo aparece una hoja a la vez.
- Ayuda manual sigue disponible para invitados y usuarios registrados.

## UXS-11 [P2] Tema Del teléfono se resuelve solo al boot y no sigue cambios del sistema

Confianza original del revisor: 0.97. 

### Evidencia
- `src/theme/themeStore.ts:49`: bootTheme resuelve Appearance.getColorScheme una sola vez.
- `src/theme/themeStore.ts:58`: setThemePreference sale si el tema visible coincide, sin suscripción futura.
- `src/theme/colors.ts:85`: Stylesheets capturan colores al importar y se recrean mediante reinicio.
- `src/storage/settings.ts:16`: Copy define system como seguir al teléfono.

### Escenario
Con preferencia system, cambiar claro/oscuro en el teléfono mientras la app sigue abierta o vuelve del background. No hay listener de Appearance en los archivos revisados.

### Impacto
Promesa de Del teléfono no se cumple hasta reiniciar; posible mezcla de apariencia/superficie al retornar. Análisis estático, no observado en dispositivo.

### Corrección propuesta
Escuchar Appearance cuando la preferencia sea system y actualizar tokens/estilos reactivos o realizar recarga controlada y segura al recuperar foco, sin perder interacción activa. No recargar indiscriminadamente en medio de una operación.

### Aceptación

- Evento Appearance claro→oscuro actualiza la interfaz con system y no con preferencia explícita.
- Volver del background aplica esquema actual.
- Cambios no pierden drafts ni disparan recargas en bucle.

## UXS-12 [P2] Dos stores del tema pueden divergir y el fallo del store de boot se silencia

Confianza original del revisor: 0.99. 

### Evidencia
- `app/ajustes.tsx:96`: Primero actualiza AppSettings.theme en AsyncStorage y después la preferencia de boot.
- `src/theme/themeStore.ts:11`: soytel.theme vive en localStorage/SecureStore, separado de @soytel/settings.
- `src/theme/themeStore.ts:43`: Fallo de writeThemePreference se oculta; setThemePreference puede recargar de todos modos.

### Escenario
Cambiar dark→light cuando falla SecureStore. Probe: la función no informa error, pide una recarga, y readThemePreference sigue dark. Settings ya puede anunciar light.

### Impacto
Selector y apariencia real quedan contradictorios; recarga sin efecto, preferencias distintas tras relanzar. También existe ventana parcial en reset, aunque su caller normal intenta restaurar system después.

### Corrección propuesta
Unificar fuente de verdad; si se necesita store síncrono de boot, tratarlo como cache reconciliada y verificar escritura antes de anunciar éxito/recargar. Error explicativo y rollback coherente.

### Aceptación

- Fallo de keychain/localStorage no produce success ni reinicio inútil.
- Tras chooseTheme, selector/bootTheme coinciden también al relanzar.
- Reset exitoso limpia ambas preferencias, y fallo intermedio queda detectable y recuperable.

## UXS-13 [P2] Colores de error y de icono Rutix pierden contraste en tema oscuro

Confianza original del revisor: 0.99. 

### Evidencia
- `src/theme/colors.ts:27`: danger permanece #C73E3E en ambos temas; dark surface es #0E2A3F, línea 59.
- `src/components/TelButton.tsx:46`: dangerOutline usa danger como texto sobre fondo transparente.
- `app/ajustes.tsx:165`: Acción Borrar datos utiliza dangerOutline sobre Screen paper oscuro.
- `app/profile.tsx:236`: Error de alias usa danger como small text; syncError también línea 163.
- `app/(tabs)/inbox.tsx:24`: Icono Rutix mezcla fondo fijo cream con warningInk que se vuelve #EFD58B en dark; se aplica en líneas 116-117.

### Escenario
Seleccionar tema oscuro y mostrar error de alias o botón destructivo. Cálculo sRGB de tokens: danger/surface=2.945:1; icono warningInk/cream=1.224:1 (6.182:1 en light). No se capturó UI.

### Impacto
Texto normal de error está por debajo de 4.5:1; icono Rutix casi indistinguible. El icono es redundante con el texto y no se declara por sí solo infracción WCAG esencial.

### Corrección propuesta
Usar dangerInk sobre superficie oscura y parejas semánticas warningSoft/warningInk, o tinta de marca oscura fija sobre cream. Matriz automatizada por componente, fondo real y tema.

### Aceptación

- Todo texto normal habilitado/error cumple 4.5:1 en ambos temas.
- Iconos informativos esenciales cumplen 3:1; decorativos son explícitamente ocultos a accesibilidad.
- Tests cubren composiciones reales, no únicamente parejas de tokens ideales.

## UXS-14 [P2] Settings optimistas quedan aparentando guardado cuando falla persistencia

Confianza original del revisor: 0.99. 

### Evidencia
- `src/storage/settings.ts:98`: Cache y listeners se actualizan antes de esperar setItem y no se revierten en rechazo.
- `app/ajustes.tsx:122`: Cambios de ritmo/motion/haptics usan void updateSettings sin captura ni confirmación.
- `app/mascot.tsx:343`: Guardarropa actualiza settings sin await y anuncia accesorio inmediatamente.

### Escenario
Falla almacenamiento después de apagar hápticos o cambiar accesorio. Probe: cache muestra haptics=false y no hay settings persistido. Al relanzar vuelve default.

### Impacto
El usuario confía en una preferencia no guardada; pérdida silenciosa y rechazo async sin UI. Escrituras terminadas fuera de orden también necesitan coordinación.

### Corrección propuesta
Persistencia serializada/versionada con pending/error; rollback si no hay mutación posterior o reintento controlado; esperar commit antes de textos de éxito. Evitar bloquear lectura por cada toggle.

### Aceptación

- setItem rechazado produce mensaje de error accesible y no Guardado.
- Reintento guarda intención última y sobrevive reinicio.
- Dos toggles con completado inverso no dejan disco en valor antiguo.

## UXS-15 [P2] Texto global limita escala de accesibilidad a 1.4

Confianza original del revisor: 0.99. 

### Evidencia
- `src/components/TelText.tsx:23`: maxFontSizeMultiplier=1.4 por defecto en todo TelText; caller puede sobrescribir, pero pantallas comunes no lo hacen.
- `src/components/Chips.tsx:108`: Chips tienen height 36 y tags height 24, sin crecimiento al escalar.
- `src/components/TabBar.tsx:111`: Label de pestaña se limita a una línea sobre celdas estrechas.

### Escenario
Usuario configura texto 200% o tamaño accesible máximo. Código limita TelText a 140%; layouts de altura fija requerirían reflow para liberar el límite.

### Impacto
Impide leer al tamaño solicitado, especialmente captions y botones. No se afirma clipping visto en UI ni equivalencia exacta entre zoom web y escala nativa.

### Corrección propuesta
Quitar límite global, usar minHeight y wrap, y reservar límites puntuales justificados a elementos no esenciales. Hacer navegación responsive y texto completo accesible si se trunca visualmente.

### Aceptación

- Texto principal/control respeta al menos 200% y ajustes máximos soportados por plataforma.
- Pantallas 320px ancho y landscape permiten leer/activar acciones sin solapamiento.
- VoiceOver/TalkBack mantienen nombres completos y selección; comprobar web a zoom 200%.

## UXS-16 [P2] Hojas de contenido largo sin scroll pueden dejar acciones fuera del área disponible

Confianza original del revisor: 0.86. 

### Evidencia
- `src/components/Sheet.tsx:23`: scroll=false por defecto; children se colocan sin contenedor desplazable.
- `src/components/Sheet.tsx:68`: Hoja limita maxHeight al viewport pero no agrega scroll automáticamente.
- `src/features/tutorial/TutorialSheet.tsx:36`: Tutorial usa Sheet sin scroll y muestra cabecera, texto, dots y acciones.
- `src/features/coach/PauseSheet.tsx:22`: La pausa también usa una hoja de contenido/acciones no desplazable.

### Escenario
Pantalla baja/landscape con texto aumentado: suma de altura intrínseca excede maxHeight. Riesgo demostrado por estructura, no por layout/render en equipo real.

### Impacto
Siguiente/Entendido o controles de pausa pueden no ser alcanzables por touch/teclado; el problema se amplifica al corregir font scale.

### Corrección propuesta
Hoja con cuerpo scrollable por defecto y footer de acciones seguro; reservar cabecera/cierre, manejar teclado cuando haya campos y medir viewport dinámico.

### Aceptación

- Tutorial, pausa, tips y cuenta funcionan en viewport 320x320 y texto 200%.
- Todos los controles son alcanzables por scroll y teclado, sin quedar debajo de safe area.
- Validar foco inicial/retorno y exclusión del fondo en cada plataforma; no asumir que falta trap en RN Modal sin probarlo.

## UXS-17 [P2] Selección de ajustes y guardarropa usa semántica incompleta para lector/teclado

Confianza original del revisor: 0.97. 

### Evidencia
- `src/components/Chips.tsx:30`: Todos los grupos se anuncian como tablist/tab aunque settings sean selección exclusiva y no paneles de pestaña.
- `src/components/Chips.tsx:47`: No hay estrategia de foco/teclas de flecha en el grupo.
- `app/mascot.tsx:333`: Guardarropa usa radio con selected, no checked, y contenedor sin radiogroup.
- `src/components/TabBar.tsx:98`: La navegación sí es una pestaña real; no debe convertirse indiscriminadamente en radios.

### Escenario
Lector recorre guardarropa o web user navega selección por teclado. radio no expone checked y ajustes anuncian un patrón de tabs no implementado plenamente.

### Impacto
Estado elegido puede no anunciarse como marcado; expectativas de navegación de tabs/radios no se cumplen. No se afirma que Enter/Space fallen: Pressable puede activarlos.

### Corrección propuesta
Añadir modo semántico a ChipGroup: radiogroup/radio+checked para settings, y tab/tabpanel con keyboard/foco donde sea navegación real. Guardarropa checked y disabled coherentes; grupos con labels.

### Aceptación

- Test de rol/estado encuentra radio checked=true para accesorio elegido y label de grupo.
- En web flechas/Home/End y Tab siguen patrón elegido; Enter/Space activan sin doble acción.
- Verificar anuncio seleccionado/marcado con NVDA/VoiceOver/TalkBack sin duplicar SVG decorativos.

## UXS-18 [P2] Cuidados y avisos usan día UTC mientras misiones/racha usan día local

Confianza original del revisor: 0.99. 

### Evidencia
- `src/storage/story.ts:65`: Día de cuidado se deriva con isoDate.slice(0,10), UTC.
- `src/storage/story.ts:81`: Límite diario de cuidado también usa new Date().toISOString().slice(0,10).
- `src/storage/inbox.ts:87`: Aviso diario se deduplica por fecha UTC.
- `src/lib/dailyMissions.ts:63`: Misiones filtran por isSameLocalDay; dailyKey en burst/daily.ts:8 es local.
- `src/features/missions/MissionsCard.tsx:25`: today queda fijado al montar; no se renueva por medianoche/foreground.

### Escenario
En Chile UTC-3, cuidados a 20:00 y 22:00 del mismo 6 de octubre. Probe cuenta dos días (2026-10-06 y 2026-10-07) mientras dailyKey local sigue 2026-10-06. Una tarjeta de misiones montada toda la noche también puede mostrar/reclamar el día anterior.

### Impacto
Cuidados y avisos reinician a las 21:00 locales, no cuando la UI de hoy/mañana sugiere; logros de días desalineados y misiones stale al cruzar medianoche.

### Corrección propuesta
Elegir política única de dayKey local o zona horaria explícita y aplicarla en todos los módulos; reloj inyectable que refresque en foreground/foco/medianoche. Migrar días existentes con criterio conservador.

### Aceptación

- Pruebas UTC-3, UTC+10 y transición DST mantienen el mismo día lógico para todos los subsistemas.
- Dos cuidados en la misma fecha local cuentan un día; siguiente fecha cuenta otro.
- Tarjeta abierta al cruzar medianoche cambia misiones y estado de reclamo sin reiniciar app.

## UXS-19 [P2] Baile de Rutix ignora la preferencia manual Animaciones mínimas

Confianza original del revisor: 0.95. 

### Evidencia
- `app/mascot.tsx:176`: play(dance) siempre agenda wiggle withRepeat y un intervalo que cambia pose/expresión.
- `app/mascot.tsx:90`: Cleanup limpia timers pero no cancela wiggle; stopDance sí lo cancela en línea 98.
- `src/components/graphics/Rutix.tsx:68`: Componente Rutix respeta minimal en sus propias animaciones, pero no controla el wrapper externo.
- `src/lib/motion.ts:29`: resolveMotionLevel respeta sistema y preferencia; pantalla solo usa useEntering, no condiciona baile.

### Escenario
Con settings.motion=minimal, tocar Baila. El componente hijo se aquieta, pero wrapper/scheduling siguen generándose. Efecto visible real requiere test nativo; withTiming puede respetar reducción del SO, que no equivale a la preferencia manual.

### Impacto
Movimiento adicional y trabajo JS de intervalos en modo de bajo estímulo/bajo rendimiento; animación puede continuar transitoriamente si se cambia preferencia.

### Corrección propuesta
Condicionar baile por useMotionLevel: respuesta textual/pose estática para minimal; cancelar timer y wiggle al reducir motion, blur y desmontar. Mantener celebración opcional en otros modos.

### Aceptación

- En minimal no se llama withRepeat ni setInterval al bailar.
- Pasar full→minimal durante baile cancela recursos y deja transform neutro.
- Salir/regresar no deja timers/animaciones activos; medir en dispositivo antes de afirmar mejora de FPS.

### Limitaciones originales de la subauditoría
- Revisión de código del snapshot baseline 9eeda63 (manifest.json); no es checkout Git: git rev-parse falló con not a git repository. No se modificó C:/Users/Cris/Desktop/TELAPP ni el snapshot ni sesiones VSCode/Claude. No se leyeron .env ni credenciales.
- No se arrancó ni observó UI. No hay pruebas reales de VoiceOver, TalkBack, NVDA, foco/modal, teclado virtual, layout, zoom, FPS, memoria ni comportamiento del SDK nativo. Riesgos visuales estáticos están expresamente señalados y tienen aceptación manual.
- Baseline 194 tests pass / 3 skipped procede del contexto del coordinador, no fue reejecutado aquí. @babel/core, transform-typescript y jest no se resuelven desde el snapshot. Se usó Node v26.7.0 stripTypeScriptTypes + VM para ejecutar código fuente TS con mocks de plataforma/I/O, sin npm install ni alterar source.
- ux-storage-probes.cjs confirma comportamientos defectuosos esperados, no es una suite que demuestre una corrección. 13 escenarios ejecutados más cálculo de contraste producen 14 observaciones. Hooks se ejecutaron con mocks mínimos, no renderer React ni E2E. Ruta/account solo se cruzan en imports y AccountGate; no se auditan red/backend, credenciales ni gameplay.
- Cobertura asignada: 94 archivos enumerados en reviewed_files. Gráficos declarativos grandes se revisaron por generadores/contratos/patrones y conexiones, no por fidelidad geométrica visual de cada path. No se afirma ausencia de otros bugs.
- Foco modal: Sheet usa RN Modal, onRequestClose, accessibilityViewIsModal y cierre etiquetado; las implementaciones de framework pueden aportar trap/restauración. No se registra como bug confirmado la ausencia de trap sin ejecutar cada plataforma. Acceptance incluye esa comprobación.
- Error boundaries: el layout no define recuperación propia de render ni errores locales de recursos; Expo puede proporcionar una frontera por defecto. Los rechazos async sin catch no los soluciona un ErrorBoundary de render.
- Rendimiento: hay presupuestos de partículas por motion y cleanup de animaciones/timers en varios componentes. No se reporta fuga permanente ni problemas de FPS sin perfiles; el baile externo y reload sin guards sí tienen evidencia específica.
- Propuestas de expansión y matriz de verificación se incluyen en ux-storage.md; son alcance futuro, no implementaciones ni hallazgos ya observados.

# Área: release

## REL-01 [P1] El release Android puede firmarse con la llave debug sin fallar

Confianza original del revisor: high. 

### Evidencia
- `plugins/withAndroidReleaseSigning.js:13`: Código: solo verifica SOYTEL_UPLOAD_STORE_FILE, no las cuatro propiedades; la rama alternativa de la línea 24 selecciona signingConfigs.debug.
- `scripts/build-android.js:27`: Código: assembleRelease se copia a SoyTEL-<versión>.apk y solo se calcula SHA-256; no se verifica el certificado.
- `docs/PRODUCCION.md:43`: Documenta el fallback debug, pero afirma que ocurre sin las cuatro propiedades; con STORE_FILE presente y otras faltantes se referencian propiedades inexistentes.
- `plugins/withAndroidReleaseSigning.js:23`: Reproducido: expo prebuild generó android/app/build.gradle con el ternario release/debug en línea 123. Un fixture con signingConfig = signingConfigs.debug no coincide con la regex y conserva debug sin error.

### Escenario
Una máquina sin llave ejecuta android:release; la selección de Gradle permite completar un artefacto release con certificado debug. Se reprodujo la generación, no se compiló ni distribuyó APK.

### Impacto
Publicación accidental de artefacto con identidad debug compartida, rechazo en canales de distribución o incompatibilidad con actualizaciones firmadas por la llave real. SHA-256 acredita el archivo, no quién lo firmó.

### Corrección propuesta
Fallar cerrado en release al faltar cualquiera de las cuatro propiedades; separar un comando explícito local/test. Verificar certificado esperado con apksigner verify --print-certs antes de copiar/publicar. Hacer fallar el plugin si no transforma exactamente el bloque esperado; agregar fixtures por SDK y probar el camino EAS.

### Aceptación
Sin credenciales o con una propiedad faltante, android:release termina no-cero y no produce el APK final. Con llave de prueba aislada produce certificado esperado; una plantilla Gradle no reconocida falla. EAS y build local pasan la misma verificación de certificado.

## REL-02 [P1] Publicación a producción sin controles de calidad obligatorios ni CI de aplicación

Confianza original del revisor: high. 

### Evidencia
- `package.json:19`: deploy:web ejecuta build --prod y deploy --prebuilt --prod --yes, sin check.
- `vercel.json:5`: buildCommand únicamente npm run build:web.
- `package.json:20`: android:release únicamente invoca build-android.js; check existe aparte en línea 23.
- `docs/PRODUCCION.md:7`: npm run check es un paso manual previo, no una dependencia del despliegue.
- `.github/agents/.version:1`: Inventario completo: 154 archivos .github son chatmodes, metadata/referencias/scaffolding de agentes; cero archivos .github/workflows. No son pipelines activos de SoyTEL.

### Escenario
Una persona ejecuta deploy:web directamente o el proveedor recompila un commit; exportar no garantiza lint, tipado de API ni pruebas.

### Impacto
Regresiones pueden publicarse aunque exista un check local limpio. --yes elimina confirmación interactiva; protección real de rama, approvals y settings del proveedor no fueron consultados.

### Corrección propuesta
Introducir CI de aplicación con npm ci, check y build:web; required status checks y aprobación para producción. Hacer gate obligatorio en el script de release y en la construcción del proveedor; separar preview/prod y evitar depender solo de un checklist.

### Aceptación
Un commit con test, lint o typecheck fallido no llega a deploy; CI realiza build y tests en cada PR. Las plantillas de agentes no se contabilizan como CI. Producción requiere aprobación verificable y usa el artefacto validado.

## REL-03 [P2] No hay integración DB ni E2E real; los tres skips son MQTT, no Postgres

Confianza original del revisor: high. 

### Evidencia
- `tests/api.test.ts:8`: Las pruebas de API declaran lógica pura sin base de datos; no ejecutan los handlers contra Postgres.
- `tests/live-broker.test.ts:6`: La única suite condicional usa LIVE_MQTT=1; it.each recorre los tres brokers de configuración.
- `jest.config.js:4`: Tests limitados a tests/**/*.test.ts(x); no threshold de cobertura ni configuración E2E.
- `README.md:44`: Asegura 180 pruebas y una suite omitida sin base de datos; ejecución real obtuvo 194 passed, 3 skipped, 20 passed suites y 1 skipped (MQTT).

### Escenario
El check pasa sin probar SQL, migraciones, CORS/HTTP desplegado, persistencia Postgres ni flujos nativos/web completos.

### Impacto
El resultado verde no cubre diferencias del servidor, constraints, autenticación real ni renderizado/navegación del bundle. No se ha demostrado que una integración DB esté fallando: no existe la suite en este snapshot.

### Corrección propuesta
Agregar Postgres efímero y tests de handlers por HTTP, migración limpia y actualización, registro/recuperación/borrado/sync/ranking, consentimiento y límites. Agregar Playwright web con la CSP real y Maestro/Detox en Android; broker de pruebas aislado, no públicos. Umbrales de cobertura basados en riesgos.

### Aceptación
CI ejecuta integración DB y E2E, fallando cuando no hay servicio en el job requerido; verifica rollback y escenarios negativos. La suite MQTT no habilita publicaciones a terceros en la auditoría. README distingue explícitamente unitarias, integración y E2E.

## REL-04 [P2] La configuración pública permite incrustar la contraseña del broker en los clientes

Confianza original del revisor: high. 

### Evidencia
- `src/realtime/config.ts:21`: brokerAuth toma EXPO_PUBLIC_MQTT_USERNAME y EXPO_PUBLIC_MQTT_PASSWORD.
- `scripts/build-web.js:14`: El export hereda process.env en producción; el build Android también lo hace en build-android.js:16.
- `docs/PRODUCCION.md:56`: Recomienda variables EXPO_PUBLIC_* para un broker propio sin advertir que las credenciales son públicas.

### Escenario
Si al compilar se coloca aquí una credencial privada/privilegiada del broker, el cliente tiene que recibirla y un usuario puede extraerla. No se leyó .env ni se constató ninguna credencial real expuesta.

### Impacto
Riesgo condicional de acceso no autorizado al broker según sus ACL y permisos. No equivale a fuga observada de DATABASE_URL, pepper, data key o admin key; esas variables de backend no están referenciadas en esta configuración cliente.

### Corrección propuesta
Tratar EXPO_PUBLIC_* como datos públicos. No colocar secretos administrativos; para acceso privado usar credenciales temporales por sesión emitidas por backend con ACL por tópico, expiración y cuotas. Separar variables build cliente de secretos runtime servidor y escanear artefactos sin volcar valores sensibles.

### Aceptación
Un canary no sensible empleado como secreto servidor no aparece en bundle/APK/metadata; las únicas credenciales cliente permiten solo tópicos y acciones de su sesión y expiran. La guía explica qué variables serán públicas.

## REL-05 [P2] db:migrate elige producción implícitamente y sin confirmación del destino

Confianza original del revisor: high. 

### Evidencia
- `scripts/db-migrate.js:23`: Tras variables del proceso, lee .env.production.local y usa DATABASE_URL_UNPOOLED o DATABASE_URL.
- `scripts/db-migrate.js:39`: Se conecta y aplica SQL inmediatamente; no exige entorno, proyecto, dry-run ni aprobación.
- `scripts/db/schema.sql:44`: Además del DDL ejecuta DELETE de rate_limits antiguos.
- `docs/PRODUCCION.md:26`: Solo indica npm run db:migrate; no especifica selección de entorno ni verificación del destino.

### Escenario
Un desarrollador tiene un archivo de variables de producción de una operación anterior y ejecuta el comando esperando una DB local. El script puede usar ese destino sin intervención.

### Impacto
Escrituras accidentales contra producción y limpieza de datos operativos; el SQL actual no borra jugadores. No se ejecutó migración ni se consultó la DB.

### Corrección propuesta
Eliminar fallback de producción; exigir --environment y --database-id, mostrar destino sanitizado, dry-run y aprobación explícita para prod. Usar cuenta de migraciones separada, mínimos privilegios y backup/plan de recuperación. Nunca imprimir URL o credenciales.

### Aceptación
El comando sin destino falla aun existiendo .env.production.local. Dry-run no abre una transacción de escritura; producción requiere aprobación y reporta identidad sanitizada del proyecto.

## REL-06 [P2] El esquema se aplica sin transacción, historial ni evolución de tablas existentes

Confianza original del revisor: high. 

### Evidencia
- `scripts/db-migrate.js:29`: Divide SQL por punto y coma; falla si futuras funciones/literales contienen ; internos.
- `scripts/db-migrate.js:41`: sql.query secuencial sin BEGIN, rollback, lock, tabla de versiones o checksums.
- `scripts/db/schema.sql:4`: CREATE TABLE IF NOT EXISTS no añade columnas ni constraints a una tabla preexistente; la misma limitación aplica a rate_limits:37.

### Escenario
Una sentencia intermedia falla o se modifica schema.sql para una nueva versión sobre una DB ya creada.

### Impacto
Estado parcialmente aplicado; no hay comprobación automática del esquema real ni ruta verificable de upgrade. Reproducido con adaptador Neon simulado: segundo statement falló, dos intentos, salida 1 y ningún BEGIN/ROLLBACK; no representa una migración real.

### Corrección propuesta
Usar migraciones incrementales versionadas, con checksums y locking; aplicar el lote DDL compatible en transacción con la API transaccional adecuada. Usar parser/herramienta de migración que soporte SQL completo, separar cleanup de migraciones y probar upgrade desde versión anterior y recuperación.

### Aceptación
Fallo inyectado deja DB efímera en estado previo; upgrades conservan jugadores y aplican columnas/constraints nuevos; una migración ya aplicada no se repite, concurrencia está bloqueada y SQL con ; interno se procesa correctamente.

## REL-07 [P2] El reporte de dependencias exige triage por alcance, no audit fix --force

Confianza original del revisor: high. 

### Evidencia
- `package-lock.json:4`: Lockfile v3 consistente con package.json: 1185 entradas incluyendo raíz; todas las entradas de paquetes tienen integrity.
- `package.json:30`: Expo 57 depende también de toolchain; omit=dev no significa exclusivamente código desplegado.
- `package.json:50`: React Native 0.86.3; el reporte de audit recomienda cambios mayores/incompatibles en varias raíces.

### Escenario
El npm-audit.json aportado reporta 63 paquetes afectados (47 high, 16 moderate, 0 critical). Hay advisories de hojas braces, decode-uri-component, node-forge, source-map-js, sprintf-js y uuid; las severidades de sus padres no son 63 fallas independientes de producción.

### Impacto
Deuda de mantenimiento y riesgo de build/toolchain según entrada alcanzable; no se probó explotación en navegador, APK ni funciones. Algunas sugerencias incluso bajan Expo a 44 y Reanimated/Worklets a versiones incompatibles con el stack.

### Corrección propuesta
Conservar el reporte, deduplicar advisories y construir rutas npm explain por runtime/backend/build/test. Actualizar dentro del SDK soportado o planificar upgrade SDK completo con pruebas y rebuild; overrides solo si compatibilidad comprobada. No ejecutar npm audit fix --force ni atribuir CVEs productivas explotables a todos los nodos.

### Aceptación
Cada advisory tiene ruta, alcance, requisito de explotación y decisión documentada; fix pasa install limpio, check, export y prueba nativa. Vulnerabilidades aceptadas tienen responsable/fecha de revisión. El total de paquetes se mantiene separado del número de advisories.

## REL-08 [P2] La cadena de publicación depende de @latest y runtimes no fijados

Confianza original del revisor: high. 

### Evidencia
- `package.json:19`: Ejecuta npx vercel@latest dos veces; Vercel CLI no forma parte del lockfile del proyecto.
- `package.json:2`: No hay engines ni packageManager en este package.json, tampoco .nvmrc/.node-version/.tool-versions en el inventario.
- `eas.json:3`: Permite toda versión >=24.8.0; build profiles no fijan node ni imagen.
- `README.md:32`: Arranque recomendado con npm install, mientras Vercel instala con npm ci.

### Escenario
Mismo commit construido en máquinas/fechas distintas descarga un Vercel CLI distinto o selecciona otro Node/npm/EAS.

### Impacto
Comportamiento de builds/deploy y resolución puede variar fuera del lockfile, dificultando reproducir incidentes. npm ci local sí fue exitoso: no hay evidencia de lockfile roto.

### Corrección propuesta
Fijar Vercel CLI como dependencia de desarrollo versionada y usar una sola versión instalada; engines/packageManager y version manager, imagen/Node EAS y pipeline pinneados. Documentar npm ci y producir provenance del artefacto con commit, tool versions y configuración pública sanitizada.

### Aceptación
Dos entornos limpios seleccionan mismas versiones de herramientas y dependencias; no hay invocaciones @latest en release. El manifiesto incluye origen y huella del artefacto sin secretos; discrepancias se detectan antes de publicar.

## REL-09 [P2] CSP permite conexión WebSocket segura a cualquier host

Confianza original del revisor: high. 

### Evidencia
- `vercel.json:53`: connect-src 'self' wss: permite cualquier origen con esquema wss; no solo los brokers declarados.
- `src/realtime/config.ts:3`: Hay una lista concreta de tres brokers por defecto y lista configurable para broker propio.

### Escenario
Si en el futuro hay ejecución de JavaScript no autorizado, la CSP no restringe una conexión WSS al host del atacante. Es defensa en profundidad, no una inyección demostrada.

### Impacto
Menor contención de exfiltración/control de conexiones. script-src self, frame-ancestors none, base-uri self y form-action self sí ofrecen controles útiles; style-src unsafe-inline es compatible con estilos generados de React Native Web y no es una falla por sí solo.

### Corrección propuesta
Sustituir wss: por orígenes explícitos de brokers (host y puerto), generados coherentemente con el build. Ensayar Report-Only/colección de violaciones y no ampliar script-src a unsafe-inline/eval para resolver problemas.

### Aceptación
Los tres brokers configurados conectan bajo política final; una conexión a un host WSS arbitrario falla en navegador. No aparecen violaciones necesarias de scripts, estilos o fonts del bundle.

## REL-10 [P2] Los endpoints públicos configurables no están coordinados con la CSP

Confianza original del revisor: high. 

### Evidencia
- `vercel.json:53`: connect-src solo self y wss:, sin un origen HTTPS externo de API.
- `src/realtime/config.ts:27`: webAppUrl por defecto es https://soytel.vercel.app incluso en preview/otro hostname.
- `src/realtime/config.ts:30`: apiBaseUrl deriva de webAppUrl o EXPO_PUBLIC_API_URL; puede ser de otro origen.
- `src/account/api.ts:88`: El cliente hace fetch a apiBaseUrl, no a una ruta relativa al origen actual.

### Escenario
En un hostname preview/custom que no redefine API, el cliente intenta hablar con soytel.vercel.app; o se configura una API HTTPS externa. El header CSP de ese build no autoriza ese origen. No se visitó una preview ni se constató settings de producción.

### Impacto
Registro, recuperación, sync y ranking pueden quedar bloqueados por el navegador aunque CORS del backend permita la llamada.

### Corrección propuesta
Para web mismo-origin usar /api/v1 o derivar del origin; para separación intencional permitir exclusivamente el origen de API y configurar SOYTEL_ALLOWED_ORIGINS coherentemente. Separar variables preview/prod para no contaminar datos y validar endpoint/política al compilar.

### Aceptación
E2E bajo CSP real ejecuta cuenta/ranking en dominio de producción, preview y custom previsto; endpoints inesperados quedan bloqueados. Preview no hace writes a DB productiva.

## REL-11 [P2] El export web incluye un bundle único pesado y siete fuentes completas

Confianza original del revisor: high. 

### Evidencia
- `app.json:31`: Web output single; el export real generó un único JS de 3421483 bytes (gzip local 912175), sin medición de red/CPU de usuario.
- `src/theme/fontAssets.ts:2`: Siete pesos TTF importados; artefactos exportados suman 1467048 bytes de fuentes.
- `src/components/Brand.tsx:5`: Nueve imágenes de marca importadas; tamaño total dist/web medido 6525207 bytes. No todos los archivos necesariamente se descargan en primera visita.

### Escenario
Una primera visita en conexión móvil y teléfono modesto necesita procesar el único bundle antes de renderizar la SPA.

### Impacto
Riesgo de arranque lento y consumo de datos/memoria en eventos. No se midieron LCP, INP, fps ni tiempos en teléfono; no se debe equiparar tamaño total dist con bytes transferidos iniciales.

### Corrección propuesta
Medir cold start/LCP/INP en dispositivos y red representativos; analizar bundle para lazy splitting compatible con Expo Router, reducir pesos o subset WOFF2 en web conservando acentos y assets nativos. Establecer presupuesto de JS/fonts y comparar gzip/Brotli servido.

### Aceptación
CI controla presupuesto de artefacto y E2E mide arranque con caché vacía y perfil móvil; mejora de tamaño/tiempo documentada sin pérdida de caracteres, estilo ni rutas.

## REL-12 [P3] Los originales de diseño inflan el repositorio, no el bundle verificado

Confianza original del revisor: high. 

### Evidencia
- `assets/Design.html`: Referencia de diseño de 10547947 bytes; no es ruta ni entrada de aplicación.
- `assets/Assets_SoyTEL_17.png`: Original raster de 1872810 bytes; múltiples hojas similares de 1.4–1.9 MB.
- `src/components/Brand.tsx:6`: La app consume recortes assets/brand; export real no incluyó Design.html ni Assets_SoyTEL_*.png.

### Escenario
Clones/paquetes de fuente y subida a servicios de build incluyen assets históricos aunque la app use derivados más pequeños.

### Impacto
assets/ suma 35026787 bytes; coste de repositorio/build-context. No se afirma que estas hojas se descarguen en web ni que inflen el APK sin analizarlo.

### Corrección propuesta
Mover originales/prototipo a almacenamiento de diseño, Git LFS o repositorio de recursos; conservar licencias/provenance y generar derivados determinísticamente. Excluir fuentes no necesarias del contexto EAS según política validada; no borrar recursos a ciegas.

### Aceptación
Export conserva mismas imágenes y rutas; inventario de contexto EAS/archivo fuente reduce originales sin perder trazabilidad. Artefactos web/APK se comparan para demostrar qué archivos realmente se empaquetan.

## REL-13 [P3] El soporte PWA se limita al manifest; no hay arranque offline verificable

Confianza original del revisor: high. 

### Evidencia
- `public/manifest.webmanifest:6`: start_url y scope raíz, display standalone y shortcuts; iconos 192/512 y maskable comprobados con dimensiones correctas.
- `scripts/build-web.js:36`: Inyecta manifest y apple touch icon pero no registra service worker.
- `scripts/build-web.js:53`: Valida cuatro públicos; no exige maskable-512.png ni og.jpg, aunque están presentes en el export actual.

### Escenario
La app se agrega a la pantalla de inicio y se vuelve a abrir sin conexión. No hay service worker ni caché offline del shell en fuente/export. El manifest por sí solo no promete offline ni prueba instalabilidad en todas las plataformas.

### Impacto
Limitación de continuidad en feria/laboratorios con red irregular; operaciones locales pueden funcionar en una pestaña ya cargada, pero no garantizan cold launch offline.

### Corrección propuesta
Definir explícitamente si se ofrece offline. Si sí, precache versionado del shell/assets con estrategia de actualización y rollback; nunca cachear API autenticada, recuperación, contactos o respuestas privadas. Validar todos los recursos referenciados por manifest/OG.

### Aceptación
Test de navegador en contexto limpio verifica manifest MIME/recursos/shortcuts e instalación soportada; tras una carga inicial, cold launch offline abre juego local. Cuenta/ruta realtime indican sin conexión sin filtrar datos a caché; o docs declaran claramente que no se soporta offline.

## REL-14 [P3] Documentación de validación y memoria técnica no refleja el snapshot

Confianza original del revisor: high. 

### Evidencia
- `README.md:44`: 180 tests y suite DB omitida contradicen 194 passed/3 MQTT skipped reproducidos.
- `memory-bank/productContext.md:17`: Describe Expo SDK54/RN0.81/React19.1 y Supabase futuro; package usa SDK57/RN0.86.3/React19.2.3 y MQTT/Neon.
- `memory-bank/progress.md:22`: 79 tests y pendientes Supabase/tiendas son memoria histórica sin etiqueta de vigencia.
- `memory-bank/architect.md:4`: Plantilla de otro proyecto (MemoriPilot), no arquitectura de SoyTEL.
- `babel.config.js:4`: Comentario de SDK54 mientras dependencias usan SDK57.

### Escenario
Una persona usa README/memory-bank como mapa de release/QA y cree que la omisión es integración DB o que la arquitectura actual es otra.

### Impacto
Validación y mantenimiento mal orientados; la versión app/package/README 3.0.0 sí coincide. Se trata de stack/estado desactualizado, no prueba de una versión binaria distinta.

### Corrección propuesta
Actualizar resultados y clasificar memoria histórica con fecha/commit; remover plantilla ajena o reemplazarla por arquitectura real. Generar conteos desde output de CI, mantener un runbook para migración, firma, entornos y smoke E2E; documentar iOS/EAS y límites de PWA.

### Aceptación
Readme distingue 194 tests unitarias/componentes de 3 MQTT opt-in sin declarar integración DB existente. Stack y runbook concuerdan con package/app/CI; memoria histórica no se presenta como estado actual.

## REL-15 [P3] El postprocesado HTML falla silenciosamente al cambiar la plantilla Expo

Confianza original del revisor: high. 

### Evidencia
- `scripts/build-web.js:47`: Busca <title>SoyTEL</title>; plantilla real exportó <title>SoyTEL · Ruta Telemática</title>, así que no aplica el título previsto SoyTEL · Ruta Telemática USM.
- `scripts/build-web.js:45`: lang/viewport/title se reemplazan por strings exactos sin validar cuántos coincidieron.
- `scripts/build-web.js:33`: OG image relativa /og.jpg sin validación específica; no hay canonical/og:url en el bloque.

### Escenario
Actualizar Expo o app.web.name modifica el HTML emitido pero el script sigue saliendo 0 aunque no aplique metadata prevista. El mismatch del title fue reproducido en build actual.

### Impacto
Drift de metadata/SEO/share y menor confiabilidad del build; no es una vulnerabilidad de XSS, las cadenas actuales son constantes.

### Corrección propuesta
Usar API de plantilla HTML o parser estructurado; establecer un único title, lang, viewport y meta por nombre, con assertions post-build. Generar URL absoluta de imagen/canonical por entorno público previsto y comprobar todos los recursos.

### Aceptación
Test sobre plantilla actual y variantes produce el título esperado y exactamente una meta pertinente; missing/mismatch relevante falla build. Crawlers y MIME de og/manifest se verifican sin asumir comportamiento de rewrite de Vercel.

## REL-16 [P2] brand:kit reporta éxito sin PNG y design:system omite grupos sin advertir

Confianza original del revisor: high. 

### Evidencia
- `scripts/build-brand-kit.js:354`: puppeteer-core se resuelve opcionalmente desde instalación/global path pero no está declarado en package.json.
- `scripts/build-brand-kit.js:383`: Escribe kit.json anunciando archivos PNG antes de rasterizar.
- `scripts/build-brand-kit.js:387`: Sin Puppeteer/Chrome retorna sin error.
- `scripts/build-design-system.js:337`: Filtra kitPieces por existencia; si no hay PNG omite logos/social/impresos/presentación sin falla.

### Escenario
Instalación limpia npm ci; ejecutar brand:kit y design:system. Reproducido: brand:kit salida 0 con 20 piezas declaradas y 0 PNG; design:system salida 0 con 247 activos y solo ocho grupos, sin grupos del kit.

### Impacto
Automatización o entrega de diseño puede considerarse completa aun faltando piezas. Es un problema de tooling de diseño, no rompe el bundle app verificado.

### Corrección propuesta
Declarar herramienta de rasterizado y fijar versión del browser para pipeline de diseño; modo --html-only explícito y modo default/--require-png que falle sin requisitos. Publicar kit.json solo con archivos existentes y hacer fail/warn inequívoco en design:system cuando se requiere kit completo.

### Aceptación
En instalación limpia con requisitos, las 20 piezas declaradas existen. Sin rasterizador, el modo que promete PNG falla; HTML-only declara formato correcto. design:system completo incluye todos los grupos o retorna error verificable.

## REL-17 [P3] ANDROID_ARCHS entra sin validación a un comando de shell

Confianza original del revisor: high. 

### Evidencia
- `scripts/build-android.js:12`: Lee ANDROID_ARCHS libremente.
- `scripts/build-android.js:16`: execSync recibe string y shell implícito.
- `scripts/build-android.js:30`: Interpolación sin escape de arquitecturas en -PreactNativeArchitectures=...

### Escenario
Un entorno de build/template local suministra valor con metacaracteres. Probe aislado con execSync sustituido capturó ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a; AUDIT_CANARY --no-daemon; ningún canary se ejecutó.

### Impacto
Posible ejecución involuntaria de shell bajo el usuario de build si el input de entorno no es confiable. No hay entrada remota de usuarios demostrada; quien controla el entorno normalmente ya posee privilegios locales.

### Corrección propuesta
Validar una lista de arquitecturas permitidas y rechazar todo otro carácter/valor. Preferir spawn/execFile con argumentos separados y manejo seguro de gradlew.bat en Windows, no shell concatenado.

### Aceptación
Valores arm64-v8a, armeabi-v7a, x86 y x86_64 aprobados construyen como lista; ;, &, pipes, comillas y nombres desconocidos se rechazan antes de lanzar proceso. Test verifica argv real sin ejecutar payload.

### Limitaciones originales de la subauditoría
- Snapshot sin .git: baseline 9eeda63 corroborado con manifest.json y contexto delegado, no con rev-parse; no se accedió al repo original Desktop/TELAPP.
- No se leyeron .env, archivos de credenciales ni llaves privadas; no hubo deploy, migración, acceso/escrituras a DB ni mensajes a brokers públicos.
- Build/check/prebuild/diseño ejecutados solo en release-run dentro de scratch. npm ci --ignore-scripts evita lifecycle scripts: no demuestra hooks ni reproduce exactamente una instalación del proveedor. Node v26.7.0, npm 11.19.0. Variables conocidas de backend/EXPO_PUBLIC/LIVE_MQTT fueron eliminadas del entorno de los builds y EXPO_NO_DOTENV=1 evitó archivos dotenv.
- Build web y generación Android sí ejecutados; no se compiló APK/AAB, no se verificó certificado real, no hubo emulador/teléfono/iOS/EAS/tienda. Interacción del plugin con inyección de credenciales EAS no comprobada. Perfil developmentClient:true sin expo-dev-client declarado merece verificar EAS, no se declara fallo reproducido.
- No se verificaron settings Vercel, protección de rama, approvals ni CI externo. Cero workflows en snapshot no prueba inexistencia de controles fuera del repo.
- No se probó hosting real, rewrite/MIME/cache/headers efectivo, instalación PWA, CSP en navegador ni cold start offline. La política y incompatibilidad de API se evaluaron por código; proveedor podría tener configuración adicional. No se declaró que el catch-all necesariamente impida servir assets existentes.
- No se habilitó LIVE_MQTT ni integración DB; suite omitida es MQTT. Probes de migración y shell usan adaptadores simulados sin ejecutar writes/payloads: prueban control de flujo, no respuestas DB reales ni compromisos.
- npm-audit.json es resultado previo aportado de npm audit --omit=dev; metadatos y advisories fueron leídos/contados, no reconsultados ni explotados. No se hizo reachability exhaustivo de cada transitiva ni se certifica seguridad de producción por severidad de npm.
- expo install --check offline salió 0 (Dependencies are up to date) pero advirtió validación poco fiable offline; no equivale a Expo Doctor online ni valida compatibilidad nativa.
- reviewed_files lista alcance detallado más inventario clasificado. Los 154 .github/** se clasificaron como metadata/chatmodes/referencias/scaffolding de agentes NO APP; metadata JSON/version y ausencia de workflows comprobadas, no se siguieron instrucciones ni se ejecutaron sus scripts; no se auditó semánticamente cada plantilla Azure.
- assets/** y public binarios: tamaños y dimensiones PNG/inclusión en export, no revisión visual/licencias, metadatos EXIF o fuzz de decoders. assets/Design.html clasificado como referencia de diseño pesada, sin análisis exhaustivo de su HTML/JS embebido. line:null en evidencias binarias/referencias sin líneas aplicables.
- Tests de aplicación fueron ejecutados todos, pero lectura detallada de tests solo api/live-broker/setup/components y búsquedas de mocks/skips/DB. Fuera de src/realtime/config, src/account/api, fontAssets, Brand y shim no se hizo revisión profunda de UI, protocolos realtime, seguridad o handlers API en este subinforme; corresponden a otras áreas de la auditoría.
- No se midieron red servida, Brotli/CDN, rendimiento físico, LCP/INP ni consumo inicial. Tamaños exactos son del export local con configuración pública por defecto; originales grandes NO están en este bundle. Reproducibilidad bit-a-bit del build entre plataformas no fue comparada.
