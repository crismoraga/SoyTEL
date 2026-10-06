import { formatNumber } from '@/lib/format';
import type { OutboxView } from '@/route/member';

// Qué decirle al participante sobre lo que envió. La regla: nunca afirmar que algo quedó guardado
// si el stand todavía no lo confirma. Cada envío está en el teléfono, en camino, guardado o perdido.

export const isOpenEntry = (entry: OutboxView | undefined): boolean => entry?.state === 'queued' || entry?.state === 'sent';
export const isLostEntry = (entry: OutboxView | undefined): boolean => entry?.state === 'rejected' || entry?.state === 'expired';

export interface ScoreStatus {
  title: string;
  note: string;
  // El puntaje no quedó en el stand.
  lost: boolean;
  // Tiene sentido ofrecer "enviar otra vez".
  canRetry: boolean;
}

// `score` es el puntaje que muestra el stand (undefined si aún no lo tiene); `entry`, el estado del envío.
export function scoreStatus(score: number | undefined, entry: OutboxView | undefined): ScoreStatus {
  if (score !== undefined) return { title: `¡${formatNumber(score)} puntos!`, note: 'Guardado en el stand.', lost: false, canRetry: false };
  if (isLostEntry(entry)) {
    const late = entry?.state === 'expired' || entry?.reason === 'phase' || entry?.reason === 'closed';
    return {
      title: 'Tu puntaje no quedó registrado',
      note: late ? 'Llegó cuando el grupo ya había avanzado, así que el stand no lo contó.' : 'El stand no lo aceptó. Puedes intentar enviarlo otra vez.',
      lost: true,
      canRetry: !late && entry?.reason !== 'kicked',
    };
  }
  if (entry?.state === 'queued') return { title: 'Puntaje guardado en tu teléfono', note: 'Sin conexión: se enviará solo al volver la señal. No cierres la app.', lost: false, canRetry: false };
  if (entry?.state === 'accepted') return { title: 'Puntaje recibido por el stand', note: 'Aparecerá en el ranking en un momento.', lost: false, canRetry: false };
  return { title: 'Enviando tu puntaje…', note: 'Esperando la confirmación del stand.', lost: false, canRetry: false };
}

// Texto bajo la pregunta de la trivia (null si todavía no responde).
export function answerNote(answered: boolean, entry: OutboxView | undefined): string | null {
  if (answered || entry?.state === 'accepted') return '¡Respuesta registrada!';
  if (isLostEntry(entry)) return 'Tu respuesta no alcanzó a llegar: elige de nuevo.';
  if (entry?.state === 'queued') return 'Sin conexión: se enviará al volver la señal.';
  if (entry?.state === 'sent') return 'Enviando tu respuesta…';
  return null;
}

// Etiqueta de un pilar de B213 en la lista de proyectos.
export function pillarState(score: number | undefined, entry: OutboxView | undefined): string {
  if (score !== undefined) return formatNumber(score);
  if (entry?.state === 'queued') return 'En el teléfono';
  if (entry?.state === 'sent') return 'Enviando…';
  if (entry?.state === 'accepted') return 'Guardado';
  return '';
}
