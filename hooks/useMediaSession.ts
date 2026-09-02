"use client";

import { useEffect } from "react";
import type { SpotifyTrack } from "../types/spotify";

type Props = {
  track: SpotifyTrack | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
};

export function useMediaSession({
  track,
  isPlaying,
  onPlayPause,
  onNext,
  onPrevious,
}: Props) {
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    const artwork = track?.album?.images?.[0]?.url
      ? [
          {
            src: track.album.images[0].url,
            sizes: "512x512",
            type: "image/jpeg",
          },
        ]
      : [];

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track?.name || "Vinylify",
      artist: track?.artists?.map((a) => a.name).join(", ") || "",
      album: track?.album?.name || "",
      artwork,
    });
  }, [track]);

  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    navigator.mediaSession.setActionHandler("play", () => {
      onPlayPause();
    });

    navigator.mediaSession.setActionHandler("pause", () => {
      onPlayPause();
    });

    navigator.mediaSession.setActionHandler("previoustrack", () => {
      onPrevious();
    });

    navigator.mediaSession.setActionHandler("nexttrack", () => {
      onNext();
    });

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
    };
  }, [onPlayPause, onNext, onPrevious]);
}
