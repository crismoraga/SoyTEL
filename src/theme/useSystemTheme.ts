import { useCallback, useEffect, useRef } from 'react';
import { Appearance, AppState } from 'react-native';
import { usePathname } from 'expo-router';
import { hostManager } from '@/route/hostManager';
import { routeMember } from '@/route/member';
import { canRestartAt, restartInterface, systemThemeToApply } from './themeStore';

// Con la preferencia "Del teléfono", la app sigue al sistema también mientras está abierta: si el
// teléfono pasa a modo oscuro (o claro), el cambio se aplica al volver a una pantalla principal.
export function useSystemTheme(): void {
  const pathname = usePathname();
  const path = useRef(pathname);
  const restarting = useRef(false);

  const check = useCallback(() => {
    if (restarting.current || systemThemeToApply() === null) return;
    // Con una ruta en curso (como participante o como stand) no se reinicia nada.
    if (!canRestartAt(path.current) || routeMember.getView().status !== 'idle' || hostManager.busy) return;
    restarting.current = true;
    void restartInterface('Tema del teléfono').catch(() => {
      restarting.current = false;
    });
  }, []);

  useEffect(() => {
    path.current = pathname;
    check();
  }, [check, pathname]);

  useEffect(() => {
    const appearance = Appearance.addChangeListener(check);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      appearance.remove();
      appState.remove();
    };
  }, [check]);
}
