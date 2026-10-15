import type { ComponentType } from 'react';
import type { MicroGameId } from '@/types/game';
import { makeQuickGame } from '../quickpick';
import type { MicroGameProps } from '../types';
import { phishingMail, caesarShift, redundancy, cpuHog, httpStatus, bugHunt } from './quickRounds';

// Componentes del paquete de microjuegos · Sistemas: phishing, cifrado César, redundancia, procesos, códigos HTTP y depuración.
export const sistemasComponents: Partial<Record<MicroGameId, ComponentType<MicroGameProps>>> = {
  'phishing-mail': makeQuickGame(phishingMail, 'phishingMail'),
  'caesar-shift': makeQuickGame(caesarShift, 'caesarShift'),
  'redundancy': makeQuickGame(redundancy, 'redundancy'),
  'cpu-hog': makeQuickGame(cpuHog, 'cpuHog'),
  'http-status': makeQuickGame(httpStatus, 'httpStatus'),
  'bug-hunt': makeQuickGame(bugHunt, 'bugHunt'),
};
