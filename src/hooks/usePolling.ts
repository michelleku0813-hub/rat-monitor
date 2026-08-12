import { useEffect, useRef, useState } from 'react';

/**
 * Periodically reloads data. Useful for simulated live camera snapshots.
 * Does not cancel in-flight requests; only applies results if still current.
 */
export function usePolling<T>(
  loader: () => Promise<T>,
  intervalMs: number,
  deps: unknown[] = [],
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    let cancelled = false;
    generation.current += 1;
    const gen = generation.current;

    const load = async (isInitial: boolean) => {
      if (isInitial) setLoading(true);
      try {
        const result = await loader();
        if (!cancelled && gen === generation.current) {
          setData(result);
          setError(null);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled && gen === generation.current) {
          setError(err instanceof Error ? err.message : '載入失敗');
          setLoading(false);
        }
      }
    };

    void load(true);
    const id = window.setInterval(() => void load(false), intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}
