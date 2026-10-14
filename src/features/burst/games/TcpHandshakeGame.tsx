import { LayerOrderGame } from './OrderTapGame';
import type { MicroGameProps } from '../types';

export function TcpHandshakeGame(props: MicroGameProps) {
  return <LayerOrderGame {...props} />;
}
