import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { colors, typography } from '@/theme';

type Variant = keyof typeof typography;

interface TelTextProps extends TextProps {
  variant?: Variant;
  color?: keyof typeof colors;
  align?: TextStyle['textAlign'];
}

export function TelText({
  variant = 'body',
  color = 'ink',
  align,
  style,
  children,
  ...props
}: PropsWithChildren<TelTextProps>) {
  return (
    <Text
      {...props}
      style={[
        typography[variant],
        { color: colors[color], textAlign: align },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export const textStyles = StyleSheet.create({
  shadow: {
    textShadowColor: 'rgba(0, 0, 0, 0.28)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  } as TextStyle,
});
