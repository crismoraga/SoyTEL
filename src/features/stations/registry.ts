import type { ComponentType } from 'react';
import type { IconName } from '@/graphics/icons';
import { pillarInfo, stationTitles } from '@/route/content';
import type { StationGameId } from '@/route/types';
import { AquaSenseGame, PosturaGame, WifiTrampaGame } from './games/B213Projects';
import { FiberLaserGame } from './games/FiberLaserGame';
import { VoipCallGame } from './games/VoipCallGame';
import { B215Circuit } from './b215/Circuit';
import { withContinue, type StationGameProps } from './kit';

export interface StationGameInfo {
  id: StationGameId;
  title: string;
  place: string;
  pillar: string;
  summary: string;
  icon: IconName;
  color: string;
  minutes: string;
  Component: ComponentType<StationGameProps>;
}

const b215: StationGameInfo = {
  id: 'red-b215',
  title: stationTitles['red-b215'],
  place: 'Sala B215',
  pillar: 'Redes y Telecomunicaciones',
  summary: 'Tres rondas cortas para entender cómo viaja la información: switch, router, firewall y más.',
  icon: 'router',
  color: '#6FB3D9',
  minutes: '2–3 min',
  Component: withContinue(B215Circuit),
};

// Cada juego avanza al ritmo del jugador: sus etapas piden "Continuar" (ver kit/withContinue).
const components = {
  datos: withContinue(AquaSenseGame),
  software: withContinue(WifiTrampaGame),
  redes: withContinue(VoipCallGame),
  teleco: withContinue(FiberLaserGame),
  hardware: withContinue(PosturaGame),
} satisfies Record<Exclude<StationGameId, 'red-b215'>, ComponentType<StationGameProps>>;

function projectGame(id: keyof typeof components): StationGameInfo {
  const info = pillarInfo(id);
  return {
    id,
    title: info.game,
    place: 'Sala B213',
    pillar: info.pillar,
    summary: info.summary,
    icon: info.icon,
    color: info.color,
    minutes: '1–2 min',
    Component: components[id],
  };
}

export const stationGames: StationGameInfo[] = [b215, projectGame('datos'), projectGame('software'), projectGame('redes'), projectGame('teleco'), projectGame('hardware')];

export function getStationGame(id: string): StationGameInfo | undefined {
  return stationGames.find((game) => game.id === id);
}
