import { Platform } from 'react-native';
import { randomHex } from '@/realtime/crypto';

// Una sola pestaña juega la ruta.
//
// En la web, la ruta puede quedar abierta en dos pestañas del mismo navegador (por ejemplo, al
// escanear el QR otra vez). Las dos comparten lo guardado —la misma identidad de participante—, así
// que si ambas siguieran conectadas se pisarían los envíos. Manda la última que se abre: la anterior
// se entera, se desconecta y ofrece volver a tomar la ruta. En Android/iOS hay una sola app abierta.

export interface TabClaim {
  // ¿Esta pestaña sigue siendo la que juega?
  held(): boolean;
  release(): void;
}

export interface TabGuard {
  claim(onLost: () => void): TabClaim;
}

interface StorageChange {
  key: string | null;
  newValue: string | null;
}

// Lo que se usa de la ventana del navegador (así se puede probar sin uno).
export interface TabWindow {
  localStorage: { getItem(key: string): string | null; setItem(key: string, value: string): void };
  addEventListener(type: 'storage', listener: (event: StorageChange) => void): void;
  removeEventListener(type: 'storage', listener: (event: StorageChange) => void): void;
}

export const MEMBER_TAB_KEY = '@soytel/route/member-tab';

// Marca en el almacenamiento compartido: el navegador avisa a las demás pestañas cuando cambia.
export function storageTabGuard(target: TabWindow, tabId = randomHex(6)): TabGuard {
  return {
    claim(onLost) {
      // Cada toma lleva su propia marca: la misma pestaña puede ceder la ruta y volver a tomarla.
      const mark = `${tabId}:${randomHex(4)}`;
      let active = true;
      let written = false;
      const listener = (event: StorageChange) => {
        if (!active || event.key !== MEMBER_TAB_KEY || event.newValue === null || event.newValue === mark) return;
        active = false;
        target.removeEventListener('storage', listener);
        onLost();
      };
      try {
        target.localStorage.setItem(MEMBER_TAB_KEY, mark);
        written = true;
      } catch {
        // Sin almacenamiento (modo privado estricto) tampoco hay otra pestaña con la misma ruta guardada.
      }
      target.addEventListener('storage', listener);
      return {
        held: () => {
          if (!active) return false;
          if (!written) return true;
          try {
            const current = target.localStorage.getItem(MEMBER_TAB_KEY);
            // Sin marca (se borraron los datos) nadie más la tomó.
            return current === null || current === mark;
          } catch {
            return true;
          }
        },
        release: () => {
          active = false;
          target.removeEventListener('storage', listener);
        },
      };
    },
  };
}

function browserWindow(): TabWindow | null {
  if (Platform.OS !== 'web') return null;
  const target = globalThis as Partial<TabWindow>;
  return target.localStorage && typeof target.addEventListener === 'function' && typeof target.removeEventListener === 'function' ? (target as TabWindow) : null;
}

const target = browserWindow();

export const deviceTabs: TabGuard | null = target ? storageTabGuard(target) : null;
