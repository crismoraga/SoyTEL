import { useCallback, useRef } from 'react';
import type { ScrollView } from 'react-native';

// Lleva la vista al final (p. ej. a la explicación que aparece tras responder).
export function useScrollToEnd() {
  const ref = useRef<ScrollView | null>(null);
  const scrollToEnd = useCallback(() => {
    setTimeout(() => ref.current?.scrollToEnd({ animated: true }), 120);
  }, []);
  return { ref, scrollToEnd };
}
