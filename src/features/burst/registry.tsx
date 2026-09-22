import { QuizGame } from './QuizGame';
import { SequenceGame } from './SequenceGame';
import { TapRaceGame } from './TapRaceGame';
import { TimingGame } from './TimingGame';
import type { MicroGameDefinition } from './types';

export const microGameRegistry: MicroGameDefinition[] = [
  {
    id: 'connect-network',
    title: 'Conecta la red',
    instruction: '¿Qué equipo conecta la LAN con Internet?',
    durationSeconds: 12,
    Component: (props) => (
      <QuizGame
        {...props}
        options={['Switch', 'Router', 'Mouse', 'Monitor']}
        answer="Router"
      />
    ),
  },
  {
    id: 'clean-signal',
    title: 'Señal limpia',
    instruction: 'Elige el medio menos propenso a interferencias cotidianas.',
    durationSeconds: 12,
    Component: (props) => (
      <QuizGame
        {...props}
        options={['Cable UTP', 'Fibra óptica', 'Wi-Fi saturado', 'Bluetooth antiguo']}
        answer="Fibra óptica"
      />
    ),
  },
  {
    id: 'ping-check',
    title: '¿Ping o no ping?',
    instruction: 'El servidor responde con tiempo de ida y vuelta. ¿Hay conectividad?',
    durationSeconds: 8,
    Component: (props) => (
      <QuizGame {...props} options={['Sí', 'No']} answer="Sí" />
    ),
  },
  {
    id: 'color-code',
    title: 'Ruta lógica',
    instruction: 'La ruta es Origen → Nodo → ¿?',
    durationSeconds: 10,
    Component: (props) => (
      <QuizGame
        {...props}
        options={['Origen', 'Destino', 'Ruido', 'Cable']}
        answer="Destino"
      />
    ),
  },
  {
    id: 'firewall',
    title: 'Firewall',
    instruction: 'Toca la acción correcta ante un paquete malicioso.',
    durationSeconds: 10,
    Component: (props) => (
      <QuizGame
        {...props}
        options={['Bloquearlo', 'Dejarlo pasar', 'Apagar la red', 'Borrar los logs']}
        answer="Bloquearlo"
      />
    ),
  },
  {
    id: 'signal-timing',
    title: 'Sintoniza la antena',
    instruction: 'Detén la aguja dentro de la zona verde para fijar la señal.',
    durationSeconds: 8,
    Component: (props) => <TimingGame {...props} />,
  },
  {
    id: 'sequence-memory',
    title: 'Ruta de paquetes',
    instruction: 'Memoriza la secuencia de nodos y repítela en orden.',
    durationSeconds: 14,
    Component: (props) => <SequenceGame {...props} />,
  },
  {
    id: 'packet-rush',
    title: 'Congestión de red',
    instruction: '¡Envía 12 paquetes antes de que se acabe el tiempo!',
    durationSeconds: 8,
    Component: (props) => <TapRaceGame {...props} />,
  },
];

export function pickBurstGames(count: number): MicroGameDefinition[] {
  const shuffled = [...microGameRegistry].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
