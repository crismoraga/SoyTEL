import type { ComponentType } from 'react';
import type { MicroGameId } from '@/types/game';
import { makeQuickGame } from '../quickpick';
import type { MicroGameProps } from '../types';
import { waveFrequency, amFm, wifiChannel, fiberAngle, signalNoise, sampling } from './quickRounds';

// Componentes del paquete de microjuegos · Señales: ondas, modulación, canales Wi-Fi, fibra óptica, ruido y muestreo.
export const senalesComponents: Partial<Record<MicroGameId, ComponentType<MicroGameProps>>> = {
  'wave-frequency': makeQuickGame(waveFrequency, 'waveFrequency'),
  'am-fm': makeQuickGame(amFm, 'amFm'),
  'wifi-channel': makeQuickGame(wifiChannel, 'wifiChannel'),
  'fiber-angle': makeQuickGame(fiberAngle, 'fiberAngle'),
  'signal-noise': makeQuickGame(signalNoise, 'signalNoise'),
  'sampling': makeQuickGame(sampling, 'sampling'),
};
