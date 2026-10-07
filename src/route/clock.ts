import { monoNow } from '@/realtime/clock';

// Reloj de la ruta. `now` es la hora del equipo (solo para mostrar y guardar fechas); `mono` no
// retrocede ni salta y es la que se usa para medir plazos, reintentos y señales de vida.
export interface RouteClock {
  now(): number;
  mono(): number;
}

export const systemClock: RouteClock = {
  now: () => Date.now(),
  mono: monoNow,
};

// Presupuesto de trabajo costoso (verificar firmas, abrir sobres): permite una ráfaga y luego un ritmo
// fijo por segundo. Lo que llega por encima se descarta, así una inundación de mensajes en el broker
// público no deja sin procesador al teléfono ni al stand.
export class Budget {
  private tokens: number;
  private refilledAt: number;

  constructor(
    private readonly burst: number,
    private readonly perSecond: number,
    private readonly clock: RouteClock,
  ) {
    this.tokens = burst;
    this.refilledAt = clock.mono();
  }

  take(): boolean {
    const mono = this.clock.mono();
    this.tokens = Math.min(this.burst, this.tokens + (Math.max(0, mono - this.refilledAt) / 1000) * this.perSecond);
    this.refilledAt = mono;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

// Recuerda los últimos valores vistos (por ejemplo, los sobres ya procesados) con un tope de memoria.
export class RecentSet {
  private items = new Set<string>();

  constructor(private readonly limit: number) {}

  has(value: string): boolean {
    return this.items.has(value);
  }

  add(value: string): void {
    if (this.items.has(value)) return;
    this.items.add(value);
    if (this.items.size > this.limit) this.items.delete(this.items.values().next().value as string);
  }

  clear(): void {
    this.items.clear();
  }
}
