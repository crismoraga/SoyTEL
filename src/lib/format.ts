const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

export function isSameLocalDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

export function relativeTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const diff = Math.max(0, now.getTime() - date.getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  if (isSameLocalDay(date, now)) return `Hoy ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameLocalDay(date, yesterday)) return `Ayer ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

export function dayGroup(iso: string, now = new Date()): 'HOY' | 'AYER' | 'ANTES' {
  const date = new Date(iso);
  if (isSameLocalDay(date, now)) return 'HOY';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return isSameLocalDay(date, yesterday) ? 'AYER' : 'ANTES';
}

export function formatNumber(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 6) return 'Buenas noches';
  if (hour < 13) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}
