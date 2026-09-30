import { useLayoutEffect, useRef, useState } from 'react';
import {
  PanResponder,
  type GestureResponderEvent,
  type GestureResponderHandlers,
  type PanResponderGestureState,
} from 'react-native';

export interface PanHandlers {
  // Decide si el toque inicial toma el gesto (por defecto, sí).
  canStart?: (event: GestureResponderEvent) => boolean;
  onGrant?: (event: GestureResponderEvent, gesture: PanResponderGestureState) => void;
  onMove?: (event: GestureResponderEvent, gesture: PanResponderGestureState) => void;
  onRelease?: (event: GestureResponderEvent, gesture: PanResponderGestureState) => void;
  onTerminate?: () => void;
}

// PanResponder estable cuyos callbacks siempre usan los handlers del último render.
export function usePanHandlers(handlers: PanHandlers): GestureResponderHandlers {
  const latest = useRef(handlers);
  useLayoutEffect(() => {
    latest.current = handlers;
  });
  // La ref solo se lee durante los gestos, nunca al renderizar.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: (event) => latest.current.canStart?.(event) ?? true,
      onMoveShouldSetPanResponder: (event) => latest.current.canStart?.(event) ?? true,
      onPanResponderGrant: (event, gesture) => latest.current.onGrant?.(event, gesture),
      onPanResponderMove: (event, gesture) => latest.current.onMove?.(event, gesture),
      onPanResponderRelease: (event, gesture) => latest.current.onRelease?.(event, gesture),
      onPanResponderTerminate: () => latest.current.onTerminate?.(),
      onPanResponderTerminationRequest: () => false,
    }),
  );
  return responder.panHandlers;
}
