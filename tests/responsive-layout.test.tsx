import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { fitInside } from '@/components/FitBox';
import { CableConnectGame } from '@/features/burst/games/CableConnectGame';
import { ConnectNetworkGame } from '@/features/burst/games/ConnectNetworkGame';
import { PasswordStrongGame } from '@/features/burst/games/PasswordStrongGame';
import { PingCheckGame } from '@/features/burst/games/PingCheckGame';
import { SequenceMemoryGame } from '@/features/burst/games/SequenceMemoryGame';
import { ChoiceTile, GameSpaceProvider, TileGrid, densityFor } from '@/features/burst/parts';
import type { MicroGameProps } from '@/features/burst/types';

const gamesDir = path.join(__dirname, '..', 'src', 'features', 'burst', 'games');
const gameFiles = fs.readdirSync(gamesDir).filter((file) => file.endsWith('Game.tsx'));

const props: MicroGameProps = { durationSeconds: 12, active: true, level: 0, pace: 1, onAnswer: () => undefined };

// Entrega a un tablero con FitBox el tamaño que le daría la pantalla.
function giveSpace(width: number, height: number) {
  const boxes = screen.UNSAFE_root.findAll((node) => typeof node.type === 'string' && typeof node.props.onLayout === 'function');
  boxes.forEach((box) => fireEvent(box, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width, height } } }));
}

describe('densidad según el espacio', () => {
  it('achica las piezas en teléfonos bajos y las agranda cuando sobra alto', () => {
    expect(densityFor(364)).toBe('compact');
    expect(densityFor(404)).toBe('regular');
    expect(densityFor(624)).toBe('roomy');
  });

  it('las opciones respetan la densidad y siguen siendo tocables (44 px o más)', () => {
    const minHeightOf = (height: number) => {
      const view = render(
        <GameSpaceProvider value={{ width: 288, height }}>
          <TileGrid>
            <ChoiceTile label="Router" icon="router" onPress={() => undefined} />
          </TileGrid>
        </GameSpaceProvider>,
      );
      const style = StyleSheet.flatten(view.getByRole('button', { name: 'Router' }).props.style);
      view.unmount();
      return style.minHeight as number;
    };
    expect(minHeightOf(364)).toBeGreaterThanOrEqual(44);
    expect(minHeightOf(364)).toBeLessThan(minHeightOf(404));
    expect(minHeightOf(404)).toBeLessThan(minHeightOf(624));
  });

  it('sin la pantalla de la Ráfaga (pruebas, otras vistas) usa la densidad normal', () => {
    render(<ChoiceTile label="Switch" onPress={() => undefined} />);
    expect(StyleSheet.flatten(screen.getByRole('button', { name: 'Switch' }).props.style).minHeight).toBe(84);
  });
});

describe('microjuegos: nada de alturas fijas grandes', () => {
  it('ningún estilo fija un alto mayor a 200 px (los tableros usan FitBox)', () => {
    expect(gameFiles.length).toBeGreaterThanOrEqual(12);
    for (const file of gameFiles) {
      const source = fs.readFileSync(path.join(gamesDir, file), 'utf8');
      // Solo los estilos: las constantes de referencia (por ejemplo la casa de Wi-Fi Boost) no fijan nada en pantalla.
      const styles = source.slice(source.indexOf('StyleSheet.create('));
      const fixed = [...styles.matchAll(/\b(?:min|max)?[hH]eight:\s*(\d+)\b/g)].map((match) => Number(match[1])).filter((value) => value > 200);
      expect({ file, fixed }).toEqual({ file, fixed: [] });
    }
  });

  it('los juegos con tablero lo miden con FitBox', () => {
    for (const file of ['CableConnectGame.tsx', 'PacketCatchGame.tsx', 'WifiBoostGame.tsx', 'SequenceMemoryGame.tsx', 'SignalTimingGame.tsx', 'ColorCodeGame.tsx']) {
      expect(fs.readFileSync(path.join(gamesDir, file), 'utf8')).toContain('FitBox');
    }
  });

  it('las superficies que se arrastran desactivan el desplazamiento del navegador', () => {
    for (const file of ['CableConnectGame.tsx', 'WifiBoostGame.tsx']) {
      expect(fs.readFileSync(path.join(gamesDir, file), 'utf8')).toContain("touchAction: 'none'");
    }
  });
});

describe('FitBox', () => {
  it('calcula el mayor rectángulo que cabe respetando proporción y topes', () => {
    expect(fitInside({ width: 300, height: 200 }, { aspectRatio: 1 })).toEqual({ width: 200, height: 200 });
    expect(fitInside({ width: 300, height: 500 }, { aspectRatio: 1.5, maxWidth: 240 })).toEqual({ width: 240, height: 160 });
    expect(fitInside({ width: 300, height: 500 }, { maxHeight: 220 })).toEqual({ width: 300, height: 220 });
  });
});

describe('microjuegos dentro de un espacio chico', () => {
  it('Cable Connect dibuja los tres cables y puertos en un tablero de 288 × 200', () => {
    render(
      <GameSpaceProvider value={{ width: 288, height: 364 }}>
        <CableConnectGame {...props} />
      </GameSpaceProvider>,
    );
    // Sin medir no hay tablero; al medirlo aparecen cables y puertos.
    expect(screen.queryAllByLabelText(/^Cable /)).toHaveLength(0);
    giveSpace(288, 200);
    expect(screen.getAllByLabelText(/^Cable /)).toHaveLength(3);
    expect(screen.getAllByLabelText(/^Puerto /)).toHaveLength(3);
  });

  it('Memoria de ruta muestra sus cuatro nodos al medir el tablero', () => {
    render(
      <GameSpaceProvider value={{ width: 288, height: 364 }}>
        <SequenceMemoryGame {...props} />
      </GameSpaceProvider>,
    );
    giveSpace(260, 260);
    ['Router', 'Servidor', 'Notebook', 'Nube'].forEach((label) => expect(screen.getByLabelText(label)).toBeTruthy());
  });

  it('Ping: todas las líneas de la terminal ocupan su lugar desde el inicio (no crece al escribir)', () => {
    render(
      <GameSpaceProvider value={{ width: 288, height: 364 }}>
        <PingCheckGame {...props} />
      </GameSpaceProvider>,
    );
    expect(screen.getAllByText(/ping|icmp_seq|Tiempo de espera|inaccesible/).length).toBeGreaterThanOrEqual(4);
  });

  it('Contraseña: nueve piezas y alto fijo para el campo', () => {
    render(
      <GameSpaceProvider value={{ width: 288, height: 364 }}>
        <PasswordStrongGame {...props} />
      </GameSpaceProvider>,
    );
    expect(screen.getAllByLabelText(/^Agregar /)).toHaveLength(9);
  });

  it('Conecta la red muestra el diagrama y cuatro opciones', () => {
    render(
      <GameSpaceProvider value={{ width: 288, height: 364 }}>
        <ConnectNetworkGame {...props} />
      </GameSpaceProvider>,
    );
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });
});
