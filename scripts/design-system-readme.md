SoyTEL es la app de juegos cortos de Ingeniería Civil Telemática USM: microjuegos, un concurso, una historia en el campus, recorridos en grupo y Telix, una mascota que se cuida jugando. La identidad es la de Telemática USM: azul noche, crema y celeste, estrellas de cuatro puntas y ondas de señal. Todo lo de este sistema sale del código de la app (`src/theme`, `src/graphics`, `src/components`).

## Voz y contenido

- Escribe en español de Chile, tuteando («Arma una contraseña», «Tu ruta está lista»). Frases cortas; una idea por frase.
- Nombra las cosas como en la carrera y con precisión técnica: router, switch, firewall, fibra óptica, DNS, TCP. Cada acierto o error trae una explicación de una o dos frases: es la microlección.
- Títulos en oración («Mis logros», «Conoce la carrera»); el kicker va en mayúsculas espaciadas (`overline`): «SISTEMA DE LOGROS».
- Celebra con exclamación solo en momentos de logro («¡Conexión establecida!», «¡Ruta completada!»). Los errores explican qué pasó y cómo seguir («Casi… inténtalo otra vez», «Pista: primero contener, después investigar»).
- Sin emoji. Los números usan punto de miles (1.180 pts) y los tiempos son relativos («Hace 5 min», «Ayer 22:39»).
- Telix habla en primera persona, cálido y breve, dentro de una burbuja `cream`.

## Color

- La base es `primary` (#0B2D45) con texto `cream`: cabeceras, botón principal, pantallas inmersivas. Sobre `primary`, el texto secundario es `accentSoft` y el cuerpo largo `onDark`.
- Las pantallas claras usan fondo `paper`, tarjetas `surface` con borde `border`, texto `ink` y secundario `muted`.
- Las pantallas oscuras (juegos, historia, Telix) usan un degradado `primary` → `primarySoft` con un fondo de patrón (ver Patrones).
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

- Usa los 95 íconos propios (`TelIcon`, grupo Íconos): grilla 24, trazo 2, extremos redondeados, color por `currentColor`. No mezcles otras familias de íconos ni emoji.
- Íconos de red para contenido técnico (`router`, `server`, `antenna`, `fiber`, `packet`, `terminal`, `shieldCheck`); íconos de interfaz para navegación (`home`, `gamepad`, `school`, `trophy`, `bell`, `chevronLeft`).
- Un ícono solo, sin texto, necesita nombre accesible.

## Medallas, Telix e ilustraciones

- Las medallas (grupo Medallas) representan logros, áreas de la carrera, estaciones de la ruta y accesos de Inicio. Estado bloqueado en gris con candado; en progreso con arco parcial; la rareza cambia el anillo y suma estrellas.
- Telix (grupo Telix) acompaña, reacciona y celebra. Su ánimo se ve en las barras del pecho (0–4). Un solo Telix por pantalla.
- Las ilustraciones (grupo Ilustraciones) abren estados vacíos, errores, onboarding y tarjetas de modos. Versión clara sobre `paper`, versión `-oscuro` sobre `primary`.
- El arte rasterizado de la marca (grupo Marca) se usa en la bienvenida, el primer paso del onboarding y las tarjetas de carrusel; nunca se redibuja el logo.

## Patrones

- `estrellas` es el fondo por defecto de las pantallas oscuras; `red`, `senal` y `orbitas` dan variedad (intro de juegos, resultados). Durante un microjuego no hay patrón.
- El patrón nunca pasa detrás de texto largo con alto contraste: baja su presencia o elige `senal`, que se concentra en una esquina.

## Movimiento

- Presionar encoge a 0,96 con resorte; las entradas de contenido suben y aparecen escalonadas cada 60 ms (`duration-slow`).
- Movimiento ambiental (Telix flota y parpadea, estrellas titilan) en `duration-ambient`.
- Las celebraciones (confeti de estrellas) marcan logros reales, no navegación.
- Todo se detiene con «Reducir animaciones» en Perfil o con el ajuste del sistema.

## Carga, vacío y error

- Mientras se leen datos: `Skeleton` con la forma final del contenido. Procesos sin forma conocida: `SignalSpinner` u `OrbitSpinner`. Botones: `DotsLoader` dentro del botón.
- Vacío: ilustración + título + una frase + acción («Nada por aquí todavía» · «Ir a jugar»).
- Error: ilustración `offline`, qué pasó y cómo seguir, sin disculpas genéricas.

## Retroalimentación

- Vibración leve al tocar, de éxito al acertar y de advertencia al fallar (desactivable).
- Cada respuesta muestra `FeedbackPanel` con la explicación; la vista se desplaza hasta él.
- Logros y subidas de nivel aparecen como `Toast` arriba y quedan registrados en Avisos.

## Pantallas de referencia

Las pantallas de Claude Design del proyecto (Bienvenida, Onboarding, Inicio, Centro de avisos, Mi ruta, Reto de estación, Mis logros y Conoce la carrera) definen la composición: cabecera `primary` con kicker, título y subtítulo; tarjetas `surface` con borde; barra inferior de cinco pestañas con píldora `highlight` en la activa.
