import type { ComponentType } from 'react';
import type { IconName } from '@/graphics/icons';
import { pillarInfo, stationTitles } from '@/route/content';
import type { StationGameId } from '@/route/types';
import { FiberLaserGame } from './games/FiberLaserGame';
import { MakerBoardsGame } from './games/MakerBoardsGame';
import { NetworkOpsGame } from './games/NetworkOpsGame';
import { ShieldedGame } from './games/ShieldedGame';
import { TrainAIGame } from './games/TrainAIGame';
import { VoipCallGame } from './games/VoipCallGame';
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
  summary: 'Arma la red del laboratorio, enruta paquetes y elimina la interferencia Wi-Fi.',
  icon: 'router',
  color: '#6FB3D9',
  minutes: '2 min',
  Component: withContinue(NetworkOpsGame),
};

// Cada juego avanza al ritmo del jugador: sus etapas piden "Continuar" (ver kit/withContinue).
const components = {
  datos: withContinue(TrainAIGame),
  software: withContinue(ShieldedGame),
  redes: withContinue(VoipCallGame),
  teleco: withContinue(FiberLaserGame),
  hardware: withContinue(MakerBoardsGame),
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
