import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

// Carga datos locales cada vez que la pantalla gana foco (útil al volver de un juego).
export function useFocusData<T>(loader: () => Promise<T>) {
  const loaderRef = useRef(loader);
  useLayoutEffect(() => {
    loaderRef.current = loader;
  });
  const [data, setData] = useState<T | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loaderRef.current().then((value) => {
        if (active) setData(value);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const reload = useCallback(() => {
    void loaderRef.current().then(setData);
  }, []);

  return { data, setData, reload, loading: data === null };
}
