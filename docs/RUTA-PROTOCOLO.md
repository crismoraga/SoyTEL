# Ruta en vivo: protocolo versión 3

Cómo se sincronizan el stand y los teléfonos en la Ruta Telemática, qué garantiza el sistema y qué no.
Código: `src/route/` (anfitrión, participante, motor, protocolo, almacenamiento) y `src/realtime/` (cliente MQTT y cifrado).

## Qué se garantiza

| Invariante | Cómo se cumple |
| --- | --- |
| Una sola autoridad por ruta | El stand que conduce lleva una **época** que sube cada vez que alguien toma la conducción y se guarda antes de publicar. Quien queda con una época menor no puede guardar (`FencedError`) y deja de conducir al ver un estado de época mayor con sus mismas llaves. |
| Todas las pantallas convergen | Cada estado publicado lleva `(época, instancia, publicación)`. Teléfonos y pantallas en solo lectura aceptan únicamente uno **mayor** que el último. |
| El orden no depende de relojes | Los estados se ordenan por ese sello; las acciones, por un contador propio de cada participante que se guarda en el teléfono. La hora del stand se calcula con un reloj monótono. |
| Confirmación de aplicación | Cada acción lleva un id de evento. El stand responde `ok`, `retry` (todavía no) o `no` (con motivo) **después de guardar**. Reintentar la misma acción no la aplica dos veces. |
| Lo confirmado es durable | El stand solo publica y confirma el último estado que ya quedó guardado. El teléfono guarda sus acciones sin respuesta y las reenvía al reabrir la app. |
| Unión auténtica y reciente | La solicitud va sellada hacia la llave del stand y repite el id del participante, la época y el **desafío** del saludo vigente (vale ~45 s). Una copia vieja, o publicada en el tópico de otro, no sirve. |
| Errores acotados | Buscar la ruta, esperar la bienvenida y las suscripciones tienen plazo. Al vencer se informa (`not-found`, `unreachable`, `incompatible`) y se ofrece reintentar. |

Objetivos medidos (ver `docs/audits/hermes-9eeda63/RESULTADOS.md`): una actualización llega a todas las pantallas en menos de 500 ms (p95) y, tras recuperar el transporte o la autoridad, todo converge en menos de 2 s.

## Tópicos

Bajo `soytel/r2/<sala>/`, donde `<sala>` se deriva del código con un hash lento (el código nunca viaja en claro).

| Tópico | Quién publica | Contenido |
| --- | --- | --- |
| `hello` (retenido) | Stand | Saludo: llaves públicas, versión, época, instancia y desafío. Sellado con la llave del código y firmado. |
| `state` (retenido) | Stand | Estado del grupo. Sellado con la llave de sesión, firmado (la firma cubre el número de llave). |
| `join/<id>` | Participante | Solicitud de unión, sellada hacia la llave del stand. |
| `dm/<id>` | Stand | Bienvenida, rechazo, confirmaciones, llave nueva o aviso de expulsión. Sellado con la llave del par. |
| `up/<id>` | Participante | Acción con contador e id de evento. Sellada con la llave del par. |

La **llave del par** es la que comparten el stand y un participante (X25519). Ningún otro miembro del grupo puede leer ni imitar las acciones de alguien. La **llave de sesión** es común y solo sirve para leer el estado.

## Mensajes

- **Saludo** `{v:2, proto:3, kind, box, sign, at, epoch, owner, challenge}`. El sobre conserva `v:2` para que una app anterior lo lea (ver Migración).
- **Unión** `{v:3, id, alias, avatar, nonce, epoch, challenge}`. El stand verifica que `id` sea el del tópico, que la época sea la suya y que el desafío esté vigente; recuerda el `nonce` dos minutos y repite la misma respuesta si llega de nuevo.
- **Directo** `welcome{nonce, key, kid, id, alias, epoch}`, `rejected{nonce, reason}`, `acks{list:[{e, s, why}]}`, `rekey{key, kid}`, `kicked`. El teléfono solo acepta `welcome` y `rejected` que citen un intento propio y vigente.
- **Acción** `{k:'act', seq, e, action}` con `action` ∈ `heartbeat | checkin{stop} | score{game, score, accuracy} | answer{index, option} | leave`. `game` y `stop` pertenecen a listas cerradas.
- **Estado** `{kid, sealed, sig}`; dentro, el estado público con `epoch`, `owner`, `pub`, `rev` y `now`.

Todo mensaje entrante se reconstruye campo por campo (`protocol.ts`): otros tipos, claves extra, `__proto__`, arreglos o `null` no llegan al estado. Hay topes de tamaño por mensaje y por paquete MQTT (256 kB).

## Durabilidad y confirmaciones

1. Llega una acción válida con contador mayor al último del participante.
2. Si su id de evento ya tiene respuesta, se repite esa respuesta y no se aplica otra vez.
3. Se aplica al motor (`submitPlayerAction`) y se guarda el estado.
4. Solo después del guardado salen la confirmación y el estado nuevo.

En el teléfono cada acción pasa por `queued` (sin conexión) → `sent` → `accepted` | `rejected` (con motivo) | `expired` (la fase ya pasó). La pantalla muestra ese estado tal cual: nunca dice que algo quedó guardado sin la respuesta del stand.

Si el guardado del stand falla, reintenta y mientras tanto no confirma ni publica nada nuevo. Tras tres fallos seguidos sigue en **modo volátil**, con un aviso permanente en pantalla: la ruta continúa, pero se pierde si esa pantalla se cierra.

## Recuperación

| Situación | Qué pasa |
| --- | --- |
| El stand se cierra o reinicia | Al reabrir toma una época nueva y parte de lo guardado. Los plazos en curso se corren el tiempo que estuvo detenido y todos reciben señal de vida fresca. Lo que no alcanzó a guardarse no se había confirmado: los teléfonos lo reenvían. |
| Dos pantallas abren la misma ruta | En la web, Web Locks deja a una en solo lectura. Sin Web Locks ambas toman la conducción y gana la época mayor: la otra pasa a solo lectura al ver su estado y no puede guardar. |
| "Tomar el control" | La pantalla nueva sube la época; la anterior queda en solo lectura y sigue mostrando la ruta en vivo. |
| El stand cambia de broker | Tras 25 s sin conexión (o 3 s si el broker lo rechaza) pasa al siguiente. Los teléfonos lo siguen: si no reciben estados nuevos en 20 s rotan, y quien aún no entra busca al stand en los demás brokers **sin soltar las llaves** que ya verificó. |
| El teléfono pierde la red o se suspende | Las acciones quedan en cola en el teléfono. Al volver recibe el estado vigente; lo pendiente sale de inmediato y lo que ya no aplica se marca vencido. |
| El stand no conoce al participante | Si el estado no lo incluye (o cambió la llave mientras no estaba), el teléfono vuelve a pedir su lugar con la misma identidad. |
| Se quita a un participante | El stand cambia la llave de sesión y la reparte a los demás. El quitado no puede actuar ni leer lo que sigue ni volver con la misma identidad. |
| Sale un participante | Con conexión, el stand lo confirma y libera el lugar. Sin conexión, el lugar se libera solo: en el lobby tras 2 min sin señales; después deja de contar para el cupo a los 10 min (su registro y su puntaje se conservan). |

## Límites conocidos

- **Broker público.** Cualquiera puede publicar en los tópicos. Los mensajes ajenos no se pueden falsificar ni leer, pero una inundación degrada el servicio. Hay presupuestos de verificación, pero no hay control de acceso por tópico. Un broker propio con ACL lo resuelve; las credenciales administrativas nunca deben ir en variables `EXPO_PUBLIC_*`, que quedan dentro de la app.
- **Quien conoce el código puede unirse.** No hay cuentas en la ruta. Un expulsado puede volver con otra identidad si aún conoce el código; para evitarlo hay que crear una ruta nueva.
- **Un solo stand por ruta.** La ruta vive en el equipo donde se creó. Otra pantalla del mismo equipo puede observarla o tomar el control; otro equipo no.
- **El teléfono debe alcanzar el broker del stand.** Si la red de un teléfono bloquea ese broker, no entra hasta que el stand se mude.
- **Particiones.** Mientras dura un corte no hay consistencia instantánea: cada pantalla muestra su último estado y lo dice (`Sin señal del stand`, `Reconectando`).

## Migración desde la versión 2

La versión 3 no es compatible con la 2: cambian la unión, las acciones, el estado y lo que se guarda.

- **Teléfono con la app anterior → stand nuevo.** Lee el saludo (el sobre sigue en `v:2`), intenta unirse con su formato y recibe un rechazo. Ve "No pudimos unirte" en vez de quedar buscando. El stand muestra "Un teléfono con una versión antigua intentó unirse".
- **Teléfono nuevo → stand con la versión anterior.** Ve "El stand usa una versión anterior" con la opción de reintentar.
- **Teléfono nuevo → stand más nuevo (futuro).** Ve "Necesitas actualizar SoyTEL".
- **Rutas y sesiones guardadas con la versión 2.** No se retoman. En el modo stand aparecen como "De una versión anterior" y se pueden borrar. En el teléfono se descartan al abrir la app.

Publicar la web y repartir el APK en el mismo momento evita mezclar versiones en un mismo evento. Quien entra por el QR usa la web, que siempre está al día.

## Pruebas

| Qué | Dónde | Cómo correrlo |
| --- | --- | --- |
| Regresiones de los defectos reproducidos (RT-01, RT-02, RT-05) | `tests/route-regressions.test.ts` | `npx jest tests/route-regressions.test.ts` |
| 20 escenarios con fallos, sobre red simulada | `tests/route-multiplayer-a.test.ts`, `tests/route-multiplayer-b.test.ts` | `npx jest tests/route-multiplayer` |
| Protocolo, transporte, candados, enlaces | `tests/route-protocol.test.ts` | `npx jest tests/route-protocol.test.ts` |
| MQTT real contra un broker local | `tests/route-mqtt-local.test.ts` | `npx jest tests/route-mqtt-local.test.ts` |
| Web con varias sesiones y la política de seguridad real | `scripts/e2e-web.js` | `npm run e2e:web` |

El banco de pruebas (`tests/support/routeHarness.ts`) usa el anfitrión y los participantes reales, con su cifrado y sus firmas. Solo la red, el reloj y el almacenamiento son simulados, para poder perder, demorar, duplicar y reordenar mensajes por destinatario.
