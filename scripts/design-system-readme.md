SoyTEL es la app de juegos cortos de Ingeniería Civil Telemática USM: microjuegos, desafíos sin reloj, un concurso, una historia en el campus, la Ruta Telemática en vivo y Rutix, una mascota que acompaña y se cuida jugando. La identidad es la de Telemática USM: azul noche, crema y celeste, estrellas de cuatro puntas y ondas de señal. Tiene tema claro y tema oscuro. Todo lo de este sistema sale del código de la app (`src/theme`, `src/graphics`, `src/components`).

## Voz y contenido

- Escribe en español de Chile, tuteando («Arma una contraseña», «Tu ruta está lista»). Frases cortas; una idea por frase.
- Nombra las cosas como en la carrera y con precisión técnica: router, switch, firewall, fibra óptica, DNS, TCP. Cada acierto o error trae una explicación de una o dos frases: es la microlección.
- Títulos en oración («Mis logros», «Conoce la carrera»); el kicker va en mayúsculas espaciadas (`overline`): «SISTEMA DE LOGROS».
- Celebra con exclamación solo en momentos de logro («¡Conexión establecida!», «¡Ruta completada!»). Los errores explican qué pasó y cómo seguir («Casi… inténtalo otra vez», «Pista: primero contener, después investigar»).
- Sin emoji. Los números usan punto de miles (1.180 pts) y los tiempos son relativos («Hace 5 min», «Ayer 22:39»).
- Rutix habla en primera persona, cálido y breve, dentro de una burbuja `cream`.

## Color

- Hay dos familias de color. Las de marca no cambian con el tema: `primary` (#0B2D45), `secondary`, `accent`, `cream` y los estados. Las de superficie sí cambian: `paper`, `surface`, `surfaceAlt`, `border`, `highlight`, el texto `ink`, `inkSoft`, `inkAccent` y la acción `action` con `actionInk`.
- Regla de texto: sobre una superficie del tema se escribe con `ink` (principal), `inkSoft` (secundario) o `inkAccent` (enlaces, kickers, íconos). Sobre un relleno de marca (`cream`, `accent`, color de pilar) se escribe con `primary` o `secondary`. Nunca `primary` sobre `surface`: en el tema oscuro no se lee.
- La acción principal de una pantalla (botón primario, pestaña activa, chip seleccionado) usa `action` con `actionInk`: azul noche con texto crema en claro, celeste con texto azul noche en oscuro.
- Las cabeceras son `primary` con texto `cream` en los dos temas. Sobre `primary`, el texto secundario es `accentSoft` y el cuerpo largo `onDark`.
- Las pantallas de lectura usan fondo `paper` y tarjetas `surface` con borde `border`.
- Las pantallas inmersivas (juegos, historia, Rutix) usan un degradado `primary` → `primarySoft` con un fondo de patrón (ver Patrones), igual en ambos temas.
- El tema se elige en Ajustes («Del teléfono», «Claro», «Oscuro»); por defecto sigue al del sistema. La vista `Themes` muestra ambos lado a lado.
- `accent` es el celeste de la señal: arcos de medalla, barras de tiempo, progreso activo. Como texto, solo sobre `primary`.
- `cream` es la acción principal sobre fondos azules («Comenzar», «¡Empezar!») y el anillo de las medallas.
- Estados: `success`/`successSoft`/`successInk` para aciertos, `danger`/`dangerSoft`/`dangerInk` para errores y vidas perdidas. Acompáñalos siempre con ícono (✓/✕) o palabra, nunca solo con color.
- Rarezas de logros: `tier-bronce`, `tier-plata`, `tier-oro`, `tier-platino` solo en anillos de medallas y etiquetas de rareza.

## Tipografía

- Montserrat (`display`) para títulos, botones, cifras y kickers; Nunito Sans (`body`) para lectura, etiquetas y metadatos. Ambas van incluidas como archivos.
- Escala: `display` 44 (puntajes), `hero` 32 (pantallas inmersivas), `title` 26 (cabeceras), `heading` 19 (secciones y preguntas), `subtitle` 17 (títulos de tarjeta), `body` 16, `label` 14, `caption` 13, `small` 12 en 800.
- Las cifras que cambian (puntaje, XP, tiempo) usan números tabulares.

## Espaciado y forma

- Margen lateral de pantalla `space-md` (16); cabeceras con `space-gutter` (20); separación entre tarjetas `space-sm`–`space-md`.
- Radios: `radius-lg` (20) tarjetas, `radius-md` (16) botones y alternativas, `radius-sm` (12) botones pequeños y campos, `radius-pill` etiquetas y barras. La cabecera de Inicio y las hojas modales usan `radius-xxl` (28).
- Separa con bordes (`border`) antes que con sombras. `shadow-card` solo en la tarjeta flotante de misión; `shadow-lifted` solo en avisos flotantes.
- Toda área táctil mide al menos 44 px.

## Iconografía

- Usa los íconos propios (`TelIcon`, grupo Íconos): grilla 24, trazo 2, extremos redondeados, color por `currentColor`. No mezcles otras familias de íconos ni emoji.
- Íconos de red para contenido técnico (`router`, `server`, `antenna`, `fiber`, `packet`, `terminal`, `shieldCheck`); íconos de interfaz para navegación (`home`, `gamepad`, `school`, `trophy`, `bell`, `chevronLeft`).
- Un ícono solo, sin texto, necesita nombre accesible.

## Medallas, Rutix e ilustraciones

- Las medallas (grupo Medallas) representan logros, áreas de la carrera, estaciones de la ruta y accesos de Inicio. Estado bloqueado en gris con candado; en progreso con arco parcial; la rareza cambia el anillo y suma estrellas.
- Rutix (grupo Rutix) acompaña, reacciona y celebra: 15 expresiones, 7 poses y un guardarropa de ocho accesorios que se desbloquean jugando. De vez en cuando mira hacia los lados y parpadea. Su ánimo se ve en las barras del pecho (0–4). Sus colores son fijos, por eso va sobre fondos azul noche. Un solo Rutix por pantalla.
- Las ilustraciones (grupo Ilustraciones) abren estados vacíos, errores, onboarding y tarjetas de modos. Versión clara sobre `paper`, versión `-oscuro` sobre `primary`.
- El arte rasterizado de la marca (grupo Marca) se usa en la bienvenida, el primer paso del onboarding y las tarjetas de carrusel; nunca se redibuja el logo.

## Patrones

- `estrellas` es el fondo por defecto de las pantallas oscuras; `red`, `senal` y `orbitas` dan variedad (intro de juegos, resultados). Durante un microjuego no hay patrón.
- El patrón nunca pasa detrás de texto largo con alto contraste: baja su presencia o elige `senal`, que se concentra en una esquina.

## Movimiento

- Presionar encoge a 0,96 con resorte; las entradas de contenido suben y aparecen escalonadas cada 60 ms (`duration-slow`).
- Movimiento ambiental (Rutix flota y parpadea, estrellas titilan) en `duration-ambient`.
- Las celebraciones (confeti de estrellas) marcan logros reales, no navegación.
- El nivel de animación se elige en Ajustes: completas, equilibradas o mínimas (automático según el teléfono). Con el nivel mínimo, o con el ajuste del sistema para reducir movimiento, se apaga todo lo decorativo.

## Carga, vacío y error

- Mientras se leen datos: `Skeleton` con la forma final del contenido. Procesos sin forma conocida: `SignalSpinner` u `OrbitSpinner`. Botones: `DotsLoader` dentro del botón.
- Vacío: ilustración + título + una frase + acción («Nada por aquí todavía» · «Ir a jugar»).
- Error: ilustración `offline`, qué pasó y cómo seguir, sin disculpas genéricas.

## Retroalimentación

- Vibración leve al tocar, de éxito al acertar y de advertencia al fallar (desactivable).
- Cada respuesta muestra `FeedbackPanel` con la explicación; la vista se desplaza hasta él.
- Logros y subidas de nivel aparecen como `Toast` arriba y quedan registrados en Avisos.

## Juegos

- Nadie juega contra el apuro: cada ronda y cada etapa parten cuando la persona toca («Toca para jugar», «Toca para empezar») y, tras cada respuesta, la explicación espera un «Continuar».
- El ritmo se elige en Ajustes: sin apuro (por defecto, tiempos ×2,5), tranquilo (×1,7), normal (×1,35) o rápido (×1, y la Ráfaga acelera). En la ruta en vivo lo fija el stand para todo el grupo.
- Rutix acompaña la partida (`CoachBubble`): da una pista antes de cada microjuego, mira el reloj contigo, celebra los aciertos y anima tras un error. Se puede apagar en Ajustes; entonces las pistas se muestran como texto.
- Todo juego con reloj tiene pausa (`PauseSheet`); salir de una partida en curso siempre pide confirmación.
- Los desafíos sin reloj («Conecta la red», «Parejas TEL», «Binario» y «Mensaje cifrado») avanzan por niveles y premian resolver con pocos movimientos, no la velocidad.
- Rutix propone tres misiones cada día; al cumplirlas regala paquetes de datos para TEL Runner.
- El color nunca es la única señal: acierto y error llevan ícono y palabra; los cables con señal cambian también de relleno.

## Pantallas de referencia

Las pantallas de Claude Design del proyecto (Bienvenida, Onboarding, Inicio, Centro de avisos, Mi ruta, Reto de estación, Mis logros y Conoce la carrera) definen la composición: cabecera `primary` con kicker, título y subtítulo; tarjetas `surface` con borde; barra inferior de cinco pestañas con la activa marcada completa en `action`. Las secciones de la barra también se cambian deslizando hacia los lados.
