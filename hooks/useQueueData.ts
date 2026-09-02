"use client";

import { useEffect, useState } from "react";
import { getQueue } from "../lib/spotify";
import type { QueueResponse, SpotifyTrack } from "../types/spotify";

// Polls the user's playback queue. Used by the Now Playing queue drawer and
// the main-layout queue panel.
export function useQueueData(pollMs = 5000) {
  const [queue, setQueue] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const sync = (data: QueueResponse | null) => {
      if (cancelled) return;
      if (data) setQueue(data.queue || []);
      setLoading(false);
    };

    getQueue().then(sync);
    const id = setInterval(() => {
      getQueue().then(sync);
    }, pollMs);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pollMs]);

  return { queue, loading };
}