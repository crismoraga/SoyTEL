import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { TelText } from '@/components/TelText';
import { pillars } from '@/route/content';
import type { PillarId } from '@/route/types';
import { colors } from '@/theme';

// Templo de Telemática (como en Didactic-Tel): cada pilar se enciende al completar su proyecto en B213.
export const Temple = memo(function Temple({ lit, width = 320 }: { lit: Partial<Record<PillarId, boolean>>; width?: number }) {
  const all = pillars.every((pillar) => lit[pillar.id]);
  const height = (width / 320) * 196;
  return (
    <View style={styles.wrap} accessible accessibilityRole="image" accessibilityLabel={`Templo de Telemática: ${pillars.filter((pillar) => lit[pillar.id]).length} de 5 pilares encendidos`}>
      <Svg width={width} height={height} viewBox="0 0 320 196">
        <Defs>
          <LinearGradient id="roof" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={all ? '#FBE3A1' : '#2A5673'} />
            <Stop offset="1" stopColor={all ? '#DDAE3E' : '#1C4460'} />
          </LinearGradient>
        </Defs>
        {all &&
          [0, 1, 2, 3, 4, 5, 6].map((ray) => (
            <Path key={ray} d={`M160 40 L${40 + ray * 40} -10`} stroke="#FBE3A1" strokeOpacity={0.35} strokeWidth={6} strokeLinecap="round" />
          ))}
        <Path d="M18 64 L160 14 L302 64 Z" fill="url(#roof)" stroke={colors.cream} strokeOpacity={0.5} strokeWidth={2} />
        <Circle cx={160} cy={46} r={9} fill={all ? colors.primary : '#15384F'} stroke={colors.cream} strokeOpacity={0.6} />
        <Rect x={22} y={64} width={276} height={14} rx={3} fill={all ? '#E6D9B8' : '#23506C'} />
        {pillars.map((pillar, index) => {
          const x = 36 + index * 56;
          const on = Boolean(lit[pillar.id]);
          return (
            <Rect
              key={pillar.id}
              x={x}
              y={80}
              width={24}
              height={88}
              rx={4}
              fill={on ? pillar.color : '#16364C'}
              stroke={on ? colors.cream : '#2E5877'}
              strokeWidth={2}
            />
          );
        })}
        <Rect x={14} y={170} width={292} height={11} rx={3} fill={all ? '#E6D9B8' : '#23506C'} />
        <Rect x={6} y={182} width={308} height={11} rx={3} fill={all ? '#D6C7A0' : '#1C4460'} />
      </Svg>
      <View style={[styles.labels, { width }]}>
        {pillars.map((pillar) => (
          <TelText key={pillar.id} variant="small" color={lit[pillar.id] ? 'cream' : 'slate'} align="center" style={styles.label} numberOfLines={1} adjustsFontSizeToFit>
            {pillar.pillar === 'Telecomunicaciones' ? 'Teleco' : pillar.pillar}
          </TelText>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  labels: {
    flexDirection: 'row',
    marginTop: 4,
  },
  label: {
    flex: 1,
    fontSize: 11,
  },
});
