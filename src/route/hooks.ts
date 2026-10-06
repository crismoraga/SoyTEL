import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import type { HostController, HostView } from './host';
import { hostManager } from './hostManager';
import { routeMember, type MemberView } from './member';

export function useMemberView(): MemberView {
  return useSyncExternalStore(
    (listener) => routeMember.subscribe(listener),
    () => routeMember.getView(),
    () => routeMember.getView(),
  );
}

const emptyHostSubscribe = () => () => undefined;

export function useHostView(controller: HostController | null): HostView | null {
  return useSyncExternalStore(
    controller ? (listener) => controller.subscribe(listener) : emptyHostSubscribe,
    () => controller?.getView() ?? null,
    () => controller?.getView() ?? null,
  );
}

// Reloj del stand visto desde este teléfono. Lo calcula la ruta a partir del último estado recibido y
// un reloj que no salta: cambiar la hora del teléfono no mueve las cuentas regresivas.
// Solo lo usan las vistas con cuenta regresiva, para que los juegos no se redibujen en cada tic.
export function useHostClock(intervalMs = 250): number {
  const [now, setNow] = useState(() => routeMember.hostNow());
  useEffect(() => {
    const timer = setInterval(() => setNow(routeMember.hostNow()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

// true desde el instante indicado (hora del stand). Un solo cambio, sin reloj que corra.
export function useHostTimeReached(target: number | null): boolean {
  const [reached, setReached] = useState(() => target === null || routeMember.hostNow() >= target);
  useEffect(() => {
    if (target === null) return;
    const timer = setTimeout(() => setReached(true), Math.max(0, target - routeMember.hostNow()));
    return () => clearTimeout(timer);
  }, [target]);
  return reached;
}

function nudgeAll() {
  routeMember.nudge();
  hostManager.nudgeAll();
}

// Al volver la app al primer plano (o recuperar la red en la web) se reconecta de inmediato y se
// comprueba que la conexión que parecía viva lo siga estando.
export function useRouteForeground(): void {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') nudgeAll();
    });
    const target = Platform.OS === 'web' ? (globalThis as { addEventListener?: (type: string, listener: () => void) => void; removeEventListener?: (type: string, listener: () => void) => void }) : null;
    target?.addEventListener?.('online', nudgeAll);
    return () => {
      subscription.remove();
      target?.removeEventListener?.('online', nudgeAll);
    };
  }, []);
}
