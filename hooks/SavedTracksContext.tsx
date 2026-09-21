"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { checkSavedTracks, removeTrack, saveTrack } from "../lib/spotify";

type ToggleResult = { ok: boolean; skipped?: boolean };

type SavedTracksApi = {
  isSaved: (id: string) => boolean;
  toggleSaved: (id: string) => Promise<ToggleResult>;
  loadSaved: (ids: string[]) => Promise<void>;
};

const SavedTracksContext = createContext<SavedTracksApi | null>(null);

/**
 * Shared saved-track store backed by Spotify's Library.
 *
 * This is the single source of truth for every "like" button in the app
 * (ContentGrid rows, PlayerBar, NowPlayingPanel) so toggling in one surface
 * is reflected everywhere else immediately.
 */
export function SavedTracksProvider({ children }: { children: ReactNode }) {
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const savedRef = useRef<Set<string>>(new Set());
  const inflightRef = useRef<
    Record<string, Promise<ToggleResult> | null>
  >({});
  const versionRef = useRef<Record<string, number>>({});

  useEffect(() => {
    savedRef.current = savedSet;
  }, [savedSet]);

  const loadSaved = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    try {
      const result = await checkSavedTracks(ids);
      setSavedSet((prev) => {
        const next = new Set(prev);
        ids.forEach((id, i) => {
          // If a toggle has touched this id, it wins over the (older) batch
          // snapshot from checkSavedTracks.
          if ((versionRef.current[id] ?? 0) === 0) {
            if (result[i]) next.add(id);
            else next.delete(id);
          }
        });
        return next;
      });
    } catch (err) {
      console.error("loadSaved failed", err);
    }
  }, []);

  const toggleSaved = useCallback(async (id: string): Promise<ToggleResult> => {
    // Dedupe concurrent toggles: a repeat click while the first call is still
    // in flight is a no-op rather than a failure.
    if (inflightRef.current[id]) {
      return { ok: true, skipped: true };
    }

    versionRef.current[id] = (versionRef.current[id] ?? 0) + 1;
    const currentlySaved = savedRef.current.has(id);

    // optimistic update
    setSavedSet((prev) => {
      const copy = new Set(prev);
      if (currentlySaved) copy.delete(id);
      else copy.add(id);
      return copy;
    });

    const action = async (): Promise<ToggleResult> => {
      try {
        const res = currentlySaved ? await removeTrack(id) : await saveTrack(id);
        if (!res.ok) throw new Error("toggle failed");
        return { ok: true };
      } catch {
        versionRef.current[id] = (versionRef.current[id] ?? 0) + 1;
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
  }, []);

  const isSaved = useCallback((id: string) => savedSet.has(id), [savedSet]);

  const value = useMemo(
    () => ({ isSaved, toggleSaved, loadSaved }),
    [isSaved, toggleSaved, loadSaved]
  );

  return (
    <SavedTracksContext.Provider value={value}>
      {children}
    </SavedTracksContext.Provider>
  );
}

export function useSavedTracks(): SavedTracksApi {
  const ctx = useContext(SavedTracksContext);
  if (!ctx) {
    throw new Error("useSavedTracks must be used within a SavedTracksProvider");
  }
  return ctx;
}