import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

export interface FitSize {
  width: number;
  height: number;
}

interface FitBoxProps {
  // Recibe el tamaño exacto disponible y dibuja el tablero a esa medida.
  children: (size: FitSize) => ReactNode;
  // Proporción ancho / alto del tablero. Sin ella, el tablero usa todo el espacio.
  aspectRatio?: number;
  // Tope de alto (en pantallas grandes el tablero no necesita crecer más).
  maxHeight?: number;
  // Tope de ancho.
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
}

// Ocupa el espacio que le deja la pantalla (flex: 1) y le dice a su contenido cuánto mide. Así un
// tablero de juego se ajusta a cualquier teléfono en vez de suponer un alto fijo que en pantallas
// bajas queda cortado. No dibuja nada hasta conocer su tamaño.
export function FitBox({ children, aspectRatio, maxHeight, maxWidth, style }: FitBoxProps) {
  const [space, setSpace] = useState<FitSize | null>(null);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSpace((current) => (current && Math.abs(current.width - width) < 1 && Math.abs(current.height - height) < 1 ? current : { width, height }));
  }, []);

  const size = space ? fitInside(space, { aspectRatio, maxHeight, maxWidth }) : null;

  return (
    <View style={[styles.box, style]} onLayout={onLayout}>
      {size && size.width > 0 && size.height > 0 ? <View style={{ width: size.width, height: size.height }}>{children(size)}</View> : null}
    </View>
  );
}

// El rectángulo más grande que cabe en `space` respetando la proporción y los topes.
export function fitInside(space: FitSize, limits: { aspectRatio?: number; maxHeight?: number; maxWidth?: number } = {}): FitSize {
  let width = Math.max(0, Math.floor(space.width));
  let height = Math.max(0, Math.floor(space.height));
  if (limits.maxWidth !== undefined) width = Math.min(width, limits.maxWidth);
  if (limits.maxHeight !== undefined) height = Math.min(height, limits.maxHeight);
  if (limits.aspectRatio && limits.aspectRatio > 0) {
    if (width / height > limits.aspectRatio) width = Math.floor(height * limits.aspectRatio);
    else height = Math.floor(width / limits.aspectRatio);
  }
  return { width, height };
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    minHeight: 0,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
