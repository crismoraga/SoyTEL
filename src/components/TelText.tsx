import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { colors, textStyle, type ColorToken, type TypeVariant } from '@/theme';

interface TelTextProps extends TextProps {
  variant?: TypeVariant;
  color?: ColorToken;
  align?: TextStyle['textAlign'];
  tabular?: boolean;
}

export function TelText({
  variant = 'body',
  color = 'ink',
  align,
  tabular = false,
  style,
  children,
  ...props
}: PropsWithChildren<TelTextProps>) {
  return (
    <Text
      // El texto sigue el tamaño elegido en el teléfono hasta el doble. Quien no pueda crecer tanto
      // (una celda de ancho fijo) pone su propio límite y conserva el nombre completo para el lector.
      maxFontSizeMultiplier={2}
      {...props}
      style={[
        textStyle(variant),
        { color: colors[color], textAlign: align },
        tabular && styles.tabular,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});

export const textStyles = StyleSheet.create({
  shadow: {
    textShadowColor: 'rgba(0, 0, 0, 0.28)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  } as TextStyle,
});
