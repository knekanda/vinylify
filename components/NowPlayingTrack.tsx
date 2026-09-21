"use client";

import { normalizeEntityId } from "../lib/spotify";
import type { SpotifyAlbum, SpotifyArtist, SpotifyTrack } from "../types/spotify";
import Image from "next/image";

type Props = {
  currentTrack: SpotifyTrack | null;
  albumImageUrl: string | undefined;
  onToggleNowPlaying: () => void;
  nowPlayingOpen: boolean;
  onSelectArtist?: (a: SpotifyArtist) => void;
  onSelectAlbum?: (a: SpotifyAlbum) => void;
};

export default function NowPlayingTrack({
  currentTrack,
  albumImageUrl,
  onToggleNowPlaying,
  nowPlayingOpen,
  onSelectArtist,
  onSelectAlbum,
}: Props) {
  const artists = currentTrack?.artists ?? [];
  const firstArtist = artists[0];
  const canSelectArtist = Boolean(
    firstArtist && onSelectArtist && normalizeEntityId(firstArtist.id)
  );
  const canSelectAlbum = Boolean(
    currentTrack?.album && onSelectAlbum && normalizeEntityId(currentTrack.album.id)
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggleNowPlaying}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggleNowPlaying();
        }
      }}
      className="group relative flex shrink-0 cursor-pointer items-center gap-3"
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
          {canSelectArtist ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectArtist!(firstArtist!);
              }}
              className="hover:text-[var(--color-text-primary)] hover:underline"
            >
              {firstArtist!.name}
            </button>
          ) : (
            artists.map((a) => a.name).join(", ") || "Select a track"
          )}
          {canSelectArtist && artists.length > 1
            ? `, ${artists.slice(1).map((a) => a.name).join(", ")}`
            : ""}
        </p>
        {canSelectAlbum && (
          <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectAlbum!(currentTrack!.album!);
              }}
              className="hover:text-[var(--color-text-primary)] hover:underline"
            >
              {currentTrack!.album!.name}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}