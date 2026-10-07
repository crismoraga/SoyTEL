// Día local en formato AAAA-MM-DD. Todo lo "diario" de la app (misiones, desafío, racha, cuidados de
// Rutix, aviso del día) usa esta misma clave: un día empieza y termina con el reloj del teléfono, no
// con la hora UTC (en Chile eso lo cortaba a las 21:00).
export function localDayKey(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// Milisegundos hasta la próxima medianoche local (para refrescar lo diario sin reiniciar la app).
export function msUntilNextLocalDay(date: Date = new Date()): number {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 1);
  return Math.max(1000, next.getTime() - date.getTime());
}
