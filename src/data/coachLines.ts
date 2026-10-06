import type { RutixExpression, RutixPose } from '@/graphics/rutix';

// Lo que dice Rutix mientras acompaña en los juegos: frases cortas, cálidas y en primera persona.
export type CoachMood = 'intro' | 'tip' | 'good' | 'great' | 'bad' | 'hurry' | 'win' | 'lose' | 'idle';

export const coachLooks: Record<CoachMood, { expression: RutixExpression; pose: RutixPose }> = {
  intro: { expression: 'happy', pose: 'wave' },
  tip: { expression: 'wink', pose: 'point' },
  good: { expression: 'happy', pose: 'thumbsUp' },
  great: { expression: 'celebrate', pose: 'celebrate' },
  bad: { expression: 'worried', pose: 'shrug' },
  hurry: { expression: 'alert', pose: 'idle' },
  win: { expression: 'proud', pose: 'celebrate' },
  lose: { expression: 'sad', pose: 'idle' },
  idle: { expression: 'neutral', pose: 'idle' },
};

export const coachLines: Record<CoachMood, string[]> = {
  intro: ['¡Vamos! Yo te acompaño.', 'Lee con calma: aquí no hay apuro.', '¡Hora de conectar ideas!', 'Respira y a jugar. ¡Confío en ti!'],
  tip: ['Te doy una pista…', 'Mira bien antes de tocar.', 'Fíjate en los detalles.'],
  good: ['¡Bien ahí!', '¡Eso es!', '¡Buena conexión!', '¡Así se hace!', '¡Vas súper!', '¡Paquete entregado!'],
  great: ['¡Señal completa!', '¡Brillante!', '¡Nivel ingeniero!', '¡Impecable!'],
  bad: ['Casi. ¡Probemos de nuevo!', 'No pasa nada: de los errores se aprende.', 'Uy, se cayó un paquete. ¡Sigamos!', 'Calma, a mí también me pasa.', 'Buen intento. La próxima sale.'],
  hurry: ['¡Queda poco tiempo!', '¡Último tramo!', '¡Tú puedes, falta poco!'],
  win: ['¡Lo lograste!', '¡Misión cumplida!', '¡Estoy orgulloso de ti!', '¡Qué gran partida!'],
  lose: ['Esta vez no salió, pero ya sabes más que antes.', '¿Otra ronda? Yo me apunto.', 'Cada intento te deja más cerca.'],
  idle: ['¿Seguimos?', 'Tómate tu tiempo.', 'Cuando quieras.'],
};

// Frase estable para una misma semilla (no cambia en cada render).
export function coachLine(mood: CoachMood, seed = 0): string {
  const lines = coachLines[mood];
  return lines[Math.abs(Math.floor(seed)) % lines.length];
}

// Reacción de Rutix a un puntaje (0 a 1).
export function coachMoodForScore(ratio: number): CoachMood {
  if (ratio >= 0.75) return 'win';
  if (ratio >= 0.45) return 'good';
  return 'lose';
}

export function coachSummaryLine(ratio: number): string {
  if (ratio >= 0.9) return '¡Partida perfecta! Así trabaja un telemático.';
  if (ratio >= 0.75) return '¡Excelente! Dominas este tema.';
  if (ratio >= 0.45) return '¡Buen trabajo! Con otra ronda lo dejas impecable.';
  return 'Ya conoces el juego: en la próxima te va mejor.';
}
