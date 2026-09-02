"use client";

import type { SpotifyTrack } from "../types/spotify";
import Image from "next/image";

type Props = {
  currentTrack: SpotifyTrack | null;
  albumImageUrl: string | undefined;
  isPlaying: boolean;
  onToggleNowPlaying: () => void;
  nowPlayingOpen: boolean;
};

export default function NowPlayingTrack({
  currentTrack,
  albumImageUrl,
  isPlaying,
  onToggleNowPlaying,
  nowPlayingOpen,
}: Props) {
  return (
    <button
      onClick={onToggleNowPlaying}
      className="group relative flex shrink-0 items-center gap-3"
      aria-label="Show now playing"
    >
      {albumImageUrl ? (
        <Image
          src={albumImageUrl}
          alt={currentTrack?.name || "Now playing"}
          width={160}
          height={160}
          className={`h-14 w-14 shrink-0 rounded-md object-cover shadow-md transition-all duration-slow ${
            nowPlayingOpen
              ? "ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-[var(--color-bg)]"
              : ""
          }`}
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-[var(--color-surface-card)]">
          <span className="text-xl">🎵</span>
        </div>
      )}

      <div className="hidden lg:block min-w-0">
        <p
          className={`truncate text-[14px] font-medium transition-colors ${
            nowPlayingOpen
              ? "text-[var(--color-accent)]"
              : "text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)]"
          }`}
        >
          {currentTrack?.name || "Nothing playing"}
        </p>
        <p className="truncate text-[12px] text-[var(--color-text-secondary)]">
          {currentTrack?.artists?.map((a) => a.name).join(", ") || "Select a track"}
        </p>
      </div>
    </button>
  );
}
