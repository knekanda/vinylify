import { useState, useCallback, useEffect } from "react";
import { useAbortableAsync } from "./useAbortableAsync";

export type SearchResultState<T = unknown> = {
  loading: boolean;
  error: unknown | null;
  data: T | null;
  run: (query: string) => Promise<void>;
  cancel: () => void;
};

export function useSearch<T = unknown>(fetcher?: (q: string, signal: AbortSignal) => Promise<T>): SearchResultState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);

  // Default fetcher: mirrors the client-side search used by the app via
  // lib/spotify.ts. Callers may supply their own fetcher to adapt the backend.
  const defaultFetcher = useCallback(async (q: string, signal: AbortSignal) => {
    const { searchTracks } = await import("../lib/spotify");
    const tracks = await searchTracks(q, signal);
    return tracks as T;
  }, []);

  const actualFetcher = fetcher ?? defaultFetcher;

  const { run, abort } = useAbortableAsync(async (q: string, signal: AbortSignal) => {
    return actualFetcher(q, signal);
  });

  const runSearch = useCallback(
    async (q: string) => {
      const normalized = q?.trim() ?? "";
      setError(null);

      if (!normalized) {
        abort();
        setData(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      const res = await run(normalized);
      if (res.ok) {
        setData(res.result);
        setError(null);
      } else {
        if (res.reason === "aborted" || res.reason === "stale") {
          // ignore silently
        } else {
          setError(res.reason);
          setData(null);
        }
      }
      setLoading(false);
    },
    [run, abort]
  );

  useEffect(() => {
    return () => {
      abort();
    };
  }, [abort]);

  return { loading, error, data, run: runSearch, cancel: abort };
}
