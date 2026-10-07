import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

// Carga datos locales cada vez que la pantalla gana foco (útil al volver de un juego).
//
// Solo cuenta la respuesta de la carga más reciente: si se pide recargar dos veces y la primera
// termina después, no pisa a la segunda; si la pantalla pierde el foco o se cierra, lo que llegue
// tarde se descarta. Un fallo queda en `error` (con `reload` para reintentar) en vez de dejar la
// pantalla cargando para siempre.
export function useFocusData<T>(loader: () => Promise<T>) {
  const loaderRef = useRef(loader);
  useLayoutEffect(() => {
    loaderRef.current = loader;
  });
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const request = useRef(0);

  const run = useCallback(() => {
    request.current += 1;
    const id = request.current;
    loaderRef.current().then(
      (value) => {
        if (id !== request.current) return;
        setData(value);
        setError(false);
      },
      () => {
        if (id === request.current) setError(true);
      },
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      run();
      return () => {
        // Al perder el foco, lo que siga en camino ya no toca esta pantalla.
        request.current += 1;
      };
    }, [run]),
  );

  return { data, setData, reload: run, loading: data === null && !error, error };
}
