import { useState, useRef, useCallback, useEffect } from "react";
import {
  checkSavedTracks,
  saveTrack,
  removeTrack,
} from "../lib/spotify";

/**
 * useSavedTracks - central saved-track state + optimistic toggle
 *
 * This project calls Spotify via the client-side wrapper in lib/spotify.ts
 * (which uses the OAuth token from localStorage), so this hook wraps those
 * functions rather than calling server proxy routes.
 */

export function useSavedTracks() {
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const inflightRef = useRef<Record<string, Promise<{ ok: boolean }> | null>>({});

  const loadSaved = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    try {
      const result = await checkSavedTracks(ids);
      setSavedSet((prev) => {
        const next = new Set(prev);
        ids.forEach((id, i) => {
          if (result[i]) next.add(id);
          else next.delete(id);
        });
        return next;
      });
    } catch (err) {
      console.error("loadSaved failed", err);
    }
  }, []);

  // optimistic toggle
  const toggleSaved = useCallback(
    async (id: string): Promise<{ ok: boolean }> => {
      // dedupe concurrent toggles for same id
      if (inflightRef.current[id]) {
        return { ok: false };
      }

      const currentlySaved = savedSet.has(id);
      // optimistic update
      setSavedSet((prev) => {
        const copy = new Set(prev);
        if (currentlySaved) copy.delete(id);
        else copy.add(id);
        return copy;
      });

      const action = async (): Promise<{ ok: boolean }> => {
        try {
          const res = currentlySaved
            ? await removeTrack(id)
            : await saveTrack(id);
          if (!res.ok) throw new Error("toggle failed");
          return { ok: true };
        } catch (err) {
          // rollback on error
          setSavedSet((prev) => {
            const copy = new Set(prev);
            if (currentlySaved) copy.add(id);
            else copy.delete(id);
            return copy;
          });
          return { ok: false };
        } finally {
          inflightRef.current[id] = null;
        }
      };

      const p = action();
      inflightRef.current[id] = p;
      return p;
    },
    [savedSet]
  );

  // helper
  const isSaved = useCallback((id: string) => savedSet.has(id), [savedSet]);

  useEffect(() => {
    // no automatic load - caller should call loadSaved(ids) for visible tracks
  }, []);

  return { isSaved, toggleSaved, loadSaved, savedIds: Array.from(savedSet) };
}
