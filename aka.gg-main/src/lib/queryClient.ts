import { QueryClient } from '@tanstack/react-query';

// Sensible ATAK.GG defaults. Riot/stats data changes slowly, so we keep it fresh
// for a minute and cached for five. Adjust per-query (`staleTime`/`gcTime`) where
// data is more volatile (e.g. social feed) or basically static (e.g. DDragon).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 min — treat data as fresh, no refetch
      gcTime: 5 * 60_000, // 5 min — keep unused cache around
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
