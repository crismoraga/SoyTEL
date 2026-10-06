import type { IconName } from '@/graphics/icons';

// Tutoriales paso a paso ("Cómo se juega"). Se muestran solos la primera vez que se entra a cada
// juego y después quedan a un toque en el botón de ayuda. Frases cortas: los leen niñas y niños.
export interface TutorialStep {
  icon: IconName;
  title: string;
  text: string;
}

export interface Tutorial {
  id: string;
  title: string;
  steps: TutorialStep[];
}

export type TutorialId = 'burst' | 'runner' | 'puzzle-red' | 'puzzle-memoria' | 'puzzle-binario' | 'puzzle-cifrado' | 'station' | 'ruta' | 'rutix';

export const tutorials: Record<TutorialId, Tutorial> = {
  burst: {
    id: 'burst',
    title: 'Cómo se juega la Ráfaga',
    steps: [
      { icon: 'bolt', title: 'Ocho microjuegos', text: 'Son 8 microjuegos al azar. Cada uno te enseña algo de redes, señales o seguridad.' },
      { icon: 'book', title: 'Primero, cómo se juega', text: 'Antes de cada ronda ves los pasos y una pista de Rutix. Léelos con calma: todavía no corre el reloj.' },
      { icon: 'tap', title: 'Tú das la partida', text: 'El reloj parte recién cuando tocas «Toca para jugar». Al terminar, Rutix te explica la respuesta.' },
      { icon: 'heart', title: 'Cuida tus 3 vidas', text: 'Si fallas o se acaba el tiempo pierdes una vida. Rutix te explica por qué y sigues jugando.' },
      { icon: 'pause', title: 'Pausa cuando quieras', text: 'El botón de pausa detiene el reloj. Si va muy rápido o muy lento, cambia el ritmo en Ajustes.' },
    ],
  },
  runner: {
    id: 'runner',
    title: 'Cómo se juega TEL Runner',
    steps: [
      { icon: 'move', title: 'Cambia de pista', text: 'Toca las flechas o desliza el dedo hacia los lados para moverte entre las tres pistas.' },
      { icon: 'chevronUp', title: 'Salta los cables', text: 'Toca «Saltar» o desliza hacia arriba para pasar sobre los cables sueltos.' },
      { icon: 'bug', title: 'Esquiva los virus', text: 'Los virus son altos: no se saltan. Cámbiate de pista o perderás una vida.' },
      { icon: 'packet', title: 'Junta paquetes de datos', text: 'Cada paquete suma puntos y se guarda. Con ellos desbloqueas personajes telemáticos con ventajas.' },
      { icon: 'shieldCheck', title: 'Busca las ayudas', text: 'El escudo te protege de un golpe y el rayo de fibra duplica los datos por unos segundos.' },
    ],
  },
  'puzzle-red': {
    id: 'puzzle-red',
    title: 'Cómo se juega Conecta la red',
    steps: [
      { icon: 'server', title: 'Parte del servidor', text: 'El servidor es el círculo crema. De él sale la señal que debe llegar a todos los equipos.' },
      { icon: 'refresh', title: 'Gira las piezas', text: 'Toca una pieza para girarla. Cuando un cable se enciende, ya está recibiendo señal.' },
      { icon: 'laptop', title: 'Conecta todos los equipos', text: 'Ganas cuando todos los notebooks quedan encendidos. No hay reloj: piensa tranquilo.' },
      { icon: 'lightbulb', title: 'Pide una pista', text: 'Si te trabas, Rutix acomoda una pieza por ti. Mientras menos giros uses, más puntos ganas.' },
    ],
  },
  'puzzle-memoria': {
    id: 'puzzle-memoria',
    title: 'Cómo se juega Parejas TEL',
    steps: [
      { icon: 'grid', title: 'Cartas boca abajo', text: 'Toca una carta para darla vuelta. Algunas muestran un equipo o una idea; otras, lo que hace.' },
      { icon: 'eye', title: 'Busca su pareja', text: 'Da vuelta otra carta. Si une el concepto con lo que hace, la pareja queda a la vista.' },
      { icon: 'clock', title: 'Mira con calma', text: 'Si no calzan, se quedan un momento a la vista para que las memorices. No hay reloj.' },
      { icon: 'star', title: 'Menos intentos, más puntos', text: 'Recuerda dónde estaba cada carta: mientras menos intentos uses, mejor puntaje.' },
    ],
  },
  'puzzle-binario': {
    id: 'puzzle-binario',
    title: 'Cómo se juega Binario',
    steps: [
      { icon: 'hash', title: 'Solo unos y ceros', text: 'Los computadores cuentan con bits: cada bit está encendido (1) o apagado (0).' },
      { icon: 'plus', title: 'Cada bit vale distinto', text: 'De derecha a izquierda valen 1, 2, 4, 8, 16… Un bit encendido suma su valor.' },
      { icon: 'target', title: 'Forma el número', text: 'Enciende los bits que sumen el número pedido, o lee el binario y elige cuánto vale.' },
      { icon: 'lightbulb', title: 'Truco de Rutix', text: 'Parte por el bit más grande que quepa en el número y completa con los más chicos.' },
    ],
  },
  'puzzle-cifrado': {
    id: 'puzzle-cifrado',
    title: 'Cómo se juega Mensaje cifrado',
    steps: [
      { icon: 'lock', title: 'Un mensaje secreto', text: 'Cada letra fue cambiada por otra que está unos pasos más adelante en el abecedario.' },
      { icon: 'shuffle', title: 'Mueve el abecedario', text: 'Sube o baja el desplazamiento y mira cómo cambia el texto.' },
      { icon: 'eye', title: 'Busca palabras reales', text: 'Cuando el texto se pueda leer, encontraste la clave. Compruébalo para ganar.' },
      { icon: 'shieldCheck', title: 'Así nació la criptografía', text: 'Este truco se llama cifrado César. Hoy Internet usa claves muchísimo más difíciles de adivinar.' },
    ],
  },
  station: {
    id: 'station',
    title: 'Cómo funcionan los juegos de la ruta',
    steps: [
      { icon: 'steps', title: 'Dos o tres etapas', text: 'Cada juego tiene etapas cortas. Antes de cada una, Rutix te cuenta qué hay que hacer.' },
      { icon: 'tap', title: 'Tú das la partida', text: 'El reloj parte cuando tocas «Toca para empezar». Lee la explicación sin apuro.' },
      { icon: 'lightbulb', title: 'Mira la pista', text: 'Durante el juego, Rutix te recuerda abajo cómo se juega esa etapa.' },
      { icon: 'star', title: 'Hasta 1.000 puntos', text: 'Acertar suma puntos y hacerlo sin errores suma más. Al final ves qué aprendiste.' },
    ],
  },
  ruta: {
    id: 'ruta',
    title: 'Cómo funciona la Ruta Telemática',
    steps: [
      { icon: 'qr', title: 'Entra con el código', text: 'En el stand hay un código de 6 letras y números. Escríbelo o escanea el QR para unirte a tu grupo.' },
      { icon: 'pin', title: 'Sigue las paradas', text: 'La app te dice a qué sala ir: primero la B215, luego la B213 y al final el pasillo.' },
      { icon: 'gamepad', title: 'Juega en cada sala', text: 'En cada parada hay juegos de los proyectos de Telemática. Todo el grupo juega al mismo tiempo.' },
      { icon: 'podium', title: 'Trivia final y podio', text: 'Cierra con una trivia en vivo: responder bien y rápido da más puntos. ¡Los tres primeros suben al podio!' },
    ],
  },
  rutix: {
    id: 'rutix',
    title: 'Conoce a Rutix',
    steps: [
      { icon: 'robot', title: 'Tu compañero', text: 'Rutix es un robot-antena. Te da pistas en los juegos y celebra contigo.' },
      { icon: 'signal', title: 'Su señal es su ánimo', text: 'Sube cuando juegas y cuando lo cuidas. Si pasan días sin jugar, le baja la señal.' },
      { icon: 'tap', title: 'Juega con él', text: 'Tócalo, chócale la mano, pídele un chiste, hazlo bailar o responde su «¿verdadero o falso?».' },
      { icon: 'target', title: 'Misiones de cada día', text: 'Rutix propone tres metas diarias. Cúmplelas y te regala paquetes para TEL Runner.' },
      { icon: 'crown', title: 'Vístelo', text: 'En el guardarropa hay accesorios que se desbloquean jugando.' },
    ],
  },
};

export function getTutorial(id: string): Tutorial | undefined {
  return (tutorials as Record<string, Tutorial | undefined>)[id];
}
