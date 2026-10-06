// Reloj monótono (ms): no retrocede ni salta cuando el usuario o la red ajustan la hora del equipo.
// Sirve para medir intervalos (reintentos, vencimientos, señales de vida), nunca para fechas.
export function monoNow(): number {
  const perf = (globalThis as { performance?: { now?: () => number } }).performance;
  return perf && typeof perf.now === 'function' ? perf.now() : Date.now();
}
