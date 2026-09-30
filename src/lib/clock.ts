// Hora actual para manejadores de eventos y efectos (nunca durante el render).
export function now(): number {
  return Date.now();
}
