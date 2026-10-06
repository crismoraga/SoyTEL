import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PressableScale } from '@/components/PressableScale';
import { TelIcon } from '@/components/TelIcon';
import { TelText } from '@/components/TelText';
import { colors, monoFamily, radius, spacing } from '@/theme';
import { fastRouteRound, ipRound, urlRound } from '../logic';
import type { MicroGameProps } from '../types';

interface PickOption {
  id: string;
  label: string;
  detail?: string;
  correct: boolean;
  // Se muestra al fallar o acertar, bajo la opción.
  why?: string;
}

interface PickRound {
  prompt: string;
  options: PickOption[];
  mono?: boolean;
  footer?: string;
}

// Microjuegos de "elige la correcta" con opciones en lista (textos largos como direcciones o URL).
function PickOneGame({ build, active, level, onAnswer }: MicroGameProps & { build: (level: number) => PickRound }) {
  const [round] = useState(() => build(level));
  const [chosen, setChosen] = useState<string | null>(null);

  function choose(option: PickOption) {
    if (!active || chosen) return;
    setChosen(option.id);
    const answer = round.options.find((item) => item.correct);
    onAnswer(option.correct, 25, option.correct ? option.why : (option.why ?? answer?.why));
  }

  return (
    <View style={styles.container}>
      <TelText variant="subtitle" color="cream" align="center">
        {round.prompt}
      </TelText>
      <View style={styles.list}>
        {round.options.map((option) => {
          const revealed = Boolean(chosen);
          const right = revealed && option.correct;
          const wrong = revealed && chosen === option.id && !option.correct;
          return (
            <PressableScale
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={`${option.label}${option.detail ? `, ${option.detail}` : ''}`}
              disabled={!active || revealed}
              haptic
              onPress={() => choose(option)}
              scaleTo={0.97}
              style={[styles.row, right && styles.rowRight, wrong && styles.rowWrong, revealed && !right && !wrong && styles.rowDim]}
            >
              <View style={styles.flex}>
                <TelText variant="label" color="cream" style={round.mono ? styles.mono : undefined}>
                  {option.label}
                </TelText>
                {option.detail && (
                  <TelText variant="small" color="accentSoft">
                    {option.detail}
                  </TelText>
                )}
                {revealed && option.why && (right || wrong) && (
                  <TelText variant="small" color="white">
                    {option.why}
                  </TelText>
                )}
              </View>
              {right && <TelIcon name="checkCircle" size={22} color={colors.white} />}
              {wrong && <TelIcon name="closeCircle" size={22} color={colors.white} />}
            </PressableScale>
          );
        })}
      </View>
      {round.footer && (
        <TelText variant="caption" color="accentSoft" align="center">
          {round.footer}
        </TelText>
      )}
    </View>
  );
}

// Microjuego 15: reconoce una dirección IPv4 bien formada.
export function IpValidGame(props: MicroGameProps) {
  return (
    <PickOneGame
      {...props}
      build={() => ({
        prompt: '¿Cuál es una dirección IPv4 válida?',
        mono: true,
        footer: 'Una IPv4 tiene 4 números entre 0 y 255 separados por puntos.',
        options: ipRound().map((option) => ({ id: option.id, label: option.text, correct: option.valid })),
      })}
    />
  );
}

// Microjuego 16: suma la latencia de cada ruta y elige la más rápida.
export function FastRouteGame(props: MicroGameProps) {
  return (
    <PickOneGame
      {...props}
      build={(level) => {
        const routes = fastRouteRound(Math.random, level);
        const best = Math.min(...routes.map((route) => route.total));
        return {
          prompt: '¿Por qué ruta llega antes el paquete?',
          mono: true,
          footer: 'La latencia total es la suma de cada salto (en milisegundos).',
          options: routes.map((route) => ({
            id: route.id,
            label: `Ruta ${route.id}:  ${route.hops.join(' + ')} ms`,
            correct: route.total === best,
            why: `Total: ${route.total} ms`,
          })),
        };
      }}
    />
  );
}

// Microjuego 17: distingue el sitio oficial de sus imitaciones (phishing).
export function SafeUrlGame(props: MicroGameProps) {
  return (
    <PickOneGame
      {...props}
      build={() => ({
        prompt: '¿Cuál es el sitio verdadero?',
        mono: true,
        footer: 'Lee el dominio completo: lo que manda es lo que está justo antes de la primera «/».',
        options: urlRound().map((option) => ({ id: option.id, label: option.url, correct: option.legit, why: option.why })),
      })}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  list: {
    gap: spacing.xs,
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 58,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 212, 237, 0.3)',
    backgroundColor: colors.primarySoft,
  },
  rowRight: {
    backgroundColor: '#1F5E43',
    borderColor: '#6BC59A',
  },
  rowWrong: {
    backgroundColor: '#6E2A2A',
    borderColor: '#E58A8A',
  },
  rowDim: {
    opacity: 0.55,
  },
  mono: {
    fontFamily: monoFamily,
    fontSize: 15,
  },
});
