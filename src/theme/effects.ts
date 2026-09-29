import type { ViewStyle } from 'react-native';

// boxShadow es multiplataforma en la nueva arquitectura (RN 0.76+).
export const shadows = {
  none: {} as ViewStyle,
  soft: { boxShadow: '0px 6px 18px rgba(11, 45, 69, 0.08)' } as ViewStyle,
  card: { boxShadow: '0px 12px 30px rgba(11, 45, 69, 0.12)' } as ViewStyle,
  lifted: { boxShadow: '0px 18px 40px rgba(11, 45, 69, 0.22)' } as ViewStyle,
  logo: { boxShadow: '0px 24px 60px rgba(0, 0, 0, 0.45)' } as ViewStyle,
  glow: { boxShadow: '0px 0px 24px rgba(111, 179, 217, 0.55)' } as ViewStyle,
};

export const motion = {
  duration: {
    instant: 90,
    fast: 160,
    base: 240,
    slow: 380,
    slower: 600,
    ambient: 1600,
  },
  spring: {
    gentle: { damping: 18, stiffness: 180, mass: 1 },
    bouncy: { damping: 9, stiffness: 240, mass: 0.8 },
    snappy: { damping: 22, stiffness: 340, mass: 0.9 },
  },
  stagger: 60,
  pressScale: 0.96,
} as const;
