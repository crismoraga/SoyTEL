import { ConnectNetworkGame } from './ConnectNetworkGame';
import type { MicroGameProps } from '../types';

export function SameSubnetGame(props: MicroGameProps) {
  return <ConnectNetworkGame {...props} />;
}
