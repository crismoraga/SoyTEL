import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ApiError, fetchLeaderboard, type Leaderboard } from './api';
import { getAccountToken } from './store';

interface LeaderboardState {
  data: Leaderboard | null;
  error: string | null;
  refreshing: boolean;
}

// Ranking global: se pide al ganar foco la pantalla y al deslizar para actualizar.
export function useLeaderboard(limit = 50) {
  const [state, setState] = useState<LeaderboardState>({ data: null, error: null, refreshing: false });

  const load = useCallback(
    async (refreshing: boolean) => {
      if (refreshing) setState((current) => ({ ...current, refreshing: true }));
      try {
        const data = await fetchLeaderboard(getAccountToken(), limit);
        setState({ data, error: null, refreshing: false });
      } catch (error) {
        setState((current) => ({
          ...current,
          refreshing: false,
          error: error instanceof ApiError ? error.message : 'No se pudo cargar el ranking.',
        }));
      }
    },
    [limit],
  );

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  return { ...state, loading: state.data === null && state.error === null, refresh: () => void load(true) };
}
