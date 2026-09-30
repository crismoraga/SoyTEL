import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
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

// Al volver la app al primer plano, reconecta de inmediato.
export function useRouteForeground(): void {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        routeMember.nudge();
        hostManager.nudgeAll();
      }
    });
    return () => subscription.remove();
  }, []);
}
