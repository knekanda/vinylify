"use client";

import { useState } from "react";
import { PlayIcon, PauseIcon, QueueIcon, HeartIcon, HeartOutlineIcon } from "./icons";
import { addToQueue, saveTrack, removeTrack } from "../lib/spotify";
import type { SpotifyAlbum, SpotifyArtist, SpotifyPlaylist, SpotifyTrack, SpotifyUser } from "../types/spotify";

type Props = {
  connected: boolean;
  homeStatus: "idle" | "loading" | "ready" | "error";
  user: SpotifyUser | null;
  view: "home" | "search" | "playlist" | "artist" | "album" | "liked";
  searchQuery: string;
  playlists: SpotifyPlaylist[];
  topArtists: SpotifyArtist[];
  topTracks: SpotifyTrack[];
  recent: SpotifyTrack[];
  selectedPlaylist: SpotifyPlaylist | null;
  playlistTracks: SpotifyTrack[];
  searchResults: SpotifyTrack[];
  selectedArtist: SpotifyArtist | null;
  artistTracks: SpotifyTrack[];
  selectedAlbum: SpotifyAlbum | null;
  albumTracks: SpotifyTrack[];
  likedTracks: SpotifyTrack[];
  likedStatus: "idle" | "loading" | "ready";
  likedLoaded: number;
  likedTotal: number;
  onRefreshLiked: () => void;
  currentTrack: SpotifyTrack | null;
  isPlaying: boolean;
  onSelectPlaylist: (p: SpotifyPlaylist) => void;
  onPlayTrack: (t: SpotifyTrack) => void;
  onPlayContext: (uri: string) => void;
  onSelectArtist: (a: SpotifyArtist) => void;
  onSelectAlbum: (a: SpotifyAlbum) => void;
  onNotice: (msg: string) => void;
};

function CardSkeleton() {
  return (
    <div className="glass-card p-3 animate-pulse">
      <div className="aspect-square rounded-[6px] bg-[var(--color-surface-card)] mb-3" />
      <div className="h-4 rounded bg-[var(--color-surface-card)] mb-2 w-4/5" />
      <div className="h-3 rounded bg-[var(--color-surface-card)] w-3/5" />
    </div>
  );
}

function TrackRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2 animate-pulse">
      <div className="h-10 w-10 rounded bg-[var(--color-surface-card)]" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 rounded bg-[var(--color-surface-card)] w-3/5" />
        <div className="h-3 rounded bg-[var(--color-surface-card)] w-2/5" />
      </div>
    </div>
  );
}

function TrackRow({
  track,
  index,
  isActive,
  isPlaying,
  onPlay,
  onSelectArtist,
  onSelectAlbum,
  onNotice,
}: {
  track: SpotifyTrack;
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onSelectArtist?: (a: SpotifyArtist) => void;
  onSelectAlbum?: (a: SpotifyAlbum) => void;
  onNotice?: (msg: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [liked, setLiked] = useState(false);
  const cover = track.album?.images?.[0]?.url;

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const id = track.id;
    if (liked) {
      const res = await removeTrack(id);
      if (res.ok) {
        setLiked(false);
        onNotice?.("Removed from Library");
      }
    } else {
      const res = await saveTrack(id);
      if (res.ok) {
        setLiked(true);
        onNotice?.("Added to Library");
      }
    }
  };

  const handleAddToQueue = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await addToQueue(track.uri);
    if (res.ok) onNotice?.("Added to queue");
    else onNotice?.("Could not add to queue");
  };

  const firstArtist = track.artists?.[0];

  return (
    <div
      className={`group flex items-center gap-3 rounded-md px-3 py-2 transition-colors duration-fast cursor-pointer ${
        isActive
          ? "bg-[var(--color-surface-interactive)]"
          : "hover:bg-[var(--color-surface-interactive)]"
      }`}
      onClick={onPlay}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Number / Play button */}
      <div className="relative flex h-5 w-8 shrink-0 items-center justify-center">
        {hovered || isActive ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            className="text-[var(--color-text-primary)]"
          >
            {isActive && isPlaying ? (
              <PauseIcon className="h-4 w-4" />
            ) : (
              <PlayIcon className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span
            className={`tabular-nums text-[14px] ${
              isActive
                ? "text-[var(--color-accent)] font-medium"
                : "text-[var(--color-text-secondary)]"
            }`}
          >
            {index + 1}
          </span>
        )}
      </div>

      {/* Cover */}
      {cover ? (
        <img
          src={cover}
          alt={track.name}
          className="h-10 w-10 shrink-0 rounded object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--color-surface-card)]">
          <span className="text-xs font-bold text-[var(--color-text-tertiary)]">♪</span>
        </div>
      )}

      {/* Title + Artist */}
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-[15px] font-medium ${
            isActive
              ? "text-[var(--color-accent)]"
              : "text-[var(--color-text-primary)]"
          }`}
        >
          {track.name}
        </p>
        <p className="truncate text-[13px] text-[var(--color-text-secondary)]">
          {firstArtist && onSelectArtist ? (
            <button
              className="hover:text-[var(--color-text-primary)] hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onSelectArtist(firstArtist);
              }}
            >
              {firstArtist.name}
            </button>
          ) : (
            track.artists?.map((a) => a.name).join(", ") || "Unknown Artist"
          )}
          {track.artists && track.artists.length > 1 && onSelectArtist
            ? `, ${track.artists.slice(1).map((a) => a.name).join(", ")}`
            : ""}
        </p>
        {track.album && onSelectAlbum && (
          <p className="truncate text-[13px] text-[var(--color-text-tertiary)]">
            <button
              className="hover:text-[var(--color-text-secondary)] hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onSelectAlbum(track.album!);
              }}
            >
              {track.album.name}
            </button>
          </p>
        )}
      </div>

      {/* Hover actions: like + queue */}
      {hovered && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleLike}
            className={`transition-colors ${
              liked ? "text-[var(--color-accent)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
            aria-label={liked ? "Remove from Library" : "Add to Library"}
          >
            {liked ? (
              <HeartIcon className="h-4 w-4 fill-current" />
            ) : (
              <HeartOutlineIcon className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={handleAddToQueue}
            className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            aria-label="Add to queue"
          >
            <QueueIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Duration */}
      <span className="tabular-nums text-[13px] text-[var(--color-text-tertiary)] shrink-0">
        {formatDuration(track.duration_ms)}
      </span>
    </div>
  );
}

function formatDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function quickPickData(playlists: SpotifyPlaylist[]) {
  return playlists.slice(0, 8);
}

export default function ContentGrid({
  connected,
  homeStatus,
  user,
  view,
  searchQuery,
  playlists,
  topArtists,
  topTracks,
  recent,
  selectedPlaylist,
  playlistTracks,
  searchResults,
  selectedArtist,
  artistTracks,
  selectedAlbum,
  albumTracks,
  likedTracks,
  likedStatus,
  likedLoaded,
  likedTotal,
  onRefreshLiked,
  currentTrack,
  isPlaying,
  onSelectPlaylist,
  onPlayTrack,
  onPlayContext,
  onSelectArtist,
  onSelectAlbum,
  onNotice,
}: Props) {
  if (!connected) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center gap-6">
        <div className="hero-album-shadow">
          <div className="relative h-48 w-48 rounded-2xl bg-gradient-to-br from-[var(--color-accent)] via-[#15803d] to-[var(--color-surface)] flex items-center justify-center">
            <svg viewBox="0 0 40 40" className="h-20 w-20" aria-hidden="true">
              <circle cx="20" cy="20" r="19" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
              <circle cx="20" cy="20" r="14" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
              <circle cx="20" cy="20" r="10" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
              <circle cx="20" cy="20" r="4" fill="rgba(255,255,255,0.9)" />
              <circle cx="20" cy="20" r="1.5" fill="var(--color-accent)" />
            </svg>
            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5" />
          </div>
        </div>

        <div>
          <h1 className="text-vinyl-display mb-2 tracking-tight text-[var(--color-text-primary)]">
            Vinylify
          </h1>
          <p className="mx-auto max-w-sm text-[17px] leading-relaxed text-[var(--color-text-secondary)]">
            Your personal music space. Discover, control, and immerse in your music with a premium listening experience.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={async () => {
              const { loginWithSpotify } = await import("../lib/spotify");
              loginWithSpotify();
            }}
            className="rounded-full bg-[var(--color-accent)] px-8 py-3.5 text-[16px] font-bold text-[var(--color-text-on-accent)] transition-all duration-fast play-btn-hover"
          >
            Connect with Spotify
          </button>

          <button
            onClick={async () => {
              const { loginWithSpotify } = await import("../lib/spotify");
              loginWithSpotify(true);
            }}
            className="rounded-full border border-[var(--color-border-strong)] bg-transparent px-8 py-3.5 text-[16px] font-semibold text-[var(--color-text-primary)] transition-all duration-fast hover:border-[var(--color-text-primary)] hover:scale-105 active:scale-95"
          >
            I have Premium
          </button>
        </div>

        <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-[var(--color-text-tertiary)]">
          You need a Spotify account to use Vinylify.
          <br />
          A Premium subscription is required for in-app playback.
          Without Premium, Vinylify will send playback to your active Spotify device.
        </p>
      </div>
    );
  }

  // Loading skeletons
  if (view === "home" && homeStatus === "loading") {
    return (
      <div className="flex-1 overflow-y-auto px-4 pb-28 md:px-6">
        <div className="grid grid-cols-1 gap-6 pt-4 lg:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-xl bg-[var(--color-surface)] p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="h-5 w-24 rounded bg-[var(--color-surface-card)] animate-pulse" />
                <div className="h-3 w-8 rounded bg-[var(--color-surface-card)] animate-pulse" />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((j) => (
                  <CardSkeleton key={j} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Home load failed — show error state instead of stuck skeletons
  if (view === "home" && homeStatus === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 pb-24 text-center">
        <div className="h-16 w-16 rounded-full bg-[var(--color-surface)] flex items-center justify-center">
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="text-vinyl-headline text-[var(--color-text-primary)]">
          Couldn&rsquo;t load your music
        </h2>
        <p className="max-w-sm text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          We couldn&rsquo;t connect to Spotify. Please reconnect your account.
        </p>
        <button
          onClick={async () => {
            const { loginWithSpotify } = await import("../lib/spotify");
            loginWithSpotify();
          }}
          className="rounded-full bg-[var(--color-accent)] px-6 py-3 text-[15px] font-bold text-[var(--color-text-on-accent)] transition-all duration-fast play-btn-hover"
        >
          Reconnect with Spotify
        </button>
      </div>
    );
  }

  // Search view
  if (view === "search") {
    if (!searchQuery.trim()) {
      return (
        <div className="flex-1 overflow-y-auto px-4 pb-28 md:px-6">
          <h2 className="text-vinyl-title-lg mt-6 mb-4 text-[var(--color-text-primary)]">
            Quick picks
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {quickPickData(playlists).map((playlist) => {
              const cover = playlist.images?.[0]?.url;

              return (
                <button
                  key={playlist.id}
                  onClick={() => onSelectPlaylist(playlist)}
                  className="group glass-card flex items-center gap-3 overflow-hidden rounded-md p-0 text-left transition-all duration-fast hover:bg-[var(--color-surface-card-hover)]"
                >
                  {cover ? (
                    <img
                      src={cover}
                      alt={playlist.name}
                      className="h-12 w-12 shrink-0 object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-[var(--color-surface-card)]">
                      <span className="text-sm font-bold text-[var(--color-text-tertiary)]">
                        {playlist.name.charAt(0)}
                      </span>
                    </div>
                  )}

                  <span className="truncate pr-3 text-[14px] font-semibold text-[var(--color-text-primary)]">
                    {playlist.name}
                  </span>
                </button>
              );
            })}
          </div>

          {topArtists.length > 0 && (
            <>
              <h2 className="text-vinyl-title-lg mt-8 mb-4 text-[var(--color-text-primary)]">
                Your top artists
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {topArtists.slice(0, 5).map((artist) => (
                  <button
                    key={artist.id}
                    onClick={() => onSelectArtist(artist)}
                    className="glass-card group flex flex-col items-center rounded-xl p-4 transition-all duration-fast hover:bg-[var(--color-surface-card-hover)]"
                  >
                    <div className="mb-3 aspect-square w-full overflow-hidden rounded-full bg-[var(--color-surface-card)] shadow-lg">
                      {artist.images?.[0]?.url ? (
                        <img
                          src={artist.images[0].url}
                          alt={artist.name}
                          className="h-full w-full object-cover transition-transform duration-slow group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <span className="text-3xl">🎵</span>
                        </div>
                      )}
                    </div>

                    <p className="w-full truncate text-center text-[15px] font-semibold text-[var(--color-text-primary)]">
                      {artist.name}
                    </p>

                    <p className="mt-1 w-full truncate text-center text-[13px] text-[var(--color-text-secondary)]">
                      Artist
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}

          {searchResults.length > 0 && (
            <>
              <h2 className="text-vinyl-title-lg mt-8 mb-4 text-[var(--color-text-primary)]">
                Songs
              </h2>
              <div className="space-y-0.5">
                {searchResults.map((track, i) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={i}
                    isActive={currentTrack?.id === track.id}
                    isPlaying={isPlaying}
                    onPlay={() => onPlayTrack(track)}
                    onSelectArtist={onSelectArtist}
                    onSelectAlbum={onSelectAlbum}
                    onNotice={onNotice}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      );
    }

    // Search results
    if (searchResults.length === 0) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 pb-24">
          <div className="h-16 w-16 rounded-full bg-[var(--color-surface)] flex items-center justify-center">
            <span className="text-3xl">🔍</span>
          </div>
          <p className="text-vinyl-headline text-center text-[var(--color-text-primary)]">
            No results for &ldquo;{searchQuery}&rdquo;
          </p>
          <p className="text-center text-[15px] text-[var(--color-text-secondary)]">
            Check your spelling, or try different keywords.
          </p>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto px-4 pb-28 md:px-6">
        <h2 className="text-vinyl-title-lg mt-6 mb-4 text-[var(--color-text-primary)]">
          Songs
        </h2>
        <div className="space-y-0.5">
          {searchResults.map((track, i) => (
            <TrackRow
              key={track.id}
              track={track}
              index={i}
              isActive={currentTrack?.id === track.id}
              isPlaying={isPlaying}
              onPlay={() => onPlayTrack(track)}
              onSelectArtist={onSelectArtist}
              onSelectAlbum={onSelectAlbum}
              onNotice={onNotice}
            />
          ))}
        </div>
      </div>
    );
  }

  // Playlist view
  if (view === "playlist" && selectedPlaylist) {
    const cover = selectedPlaylist.images?.[0]?.url;
    const totalDuration = playlistTracks.reduce(
      (acc, t) => acc + t.duration_ms,
      0
    );

    return (
      <div className="flex-1 overflow-y-auto pb-28">
        {/* Playlist Hero */}
        <div className="relative px-4 pb-6 pt-16 md:px-8">
          {cover ? (
            <img
              src={cover}
              alt={selectedPlaylist.name}
              className="mx-auto mb-6 h-48 w-48 rounded-xl object-cover shadow-2xl sm:h-56 sm:w-56 animate-fade-in"
            />
          ) : (
            <div className="mx-auto mb-6 flex h-48 w-48 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-surface-card)] shadow-2xl sm:h-56 sm:w-56 animate-fade-in">
              <span className="text-4xl">🎵</span>
            </div>
          )}

          <div className="text-center animate-slide-up">
            <p className="text-vinyl-micro mb-1 text-[var(--color-text-secondary)] uppercase">
              Playlist
            </p>

            <h1 className="text-vinyl-display mx-auto mb-4 max-w-2xl truncate px-2 leading-tight text-[var(--color-text-primary)]">
              {selectedPlaylist.name}
            </h1>

            {selectedPlaylist.description && (
              <p className="mx-auto mb-4 max-w-lg truncate text-[15px] text-[var(--color-text-secondary)] italic">
                {selectedPlaylist.description}
              </p>
            )}

            <div className="flex items-center justify-center gap-1 text-[14px] text-[var(--color-text-secondary)]">
              <span className="font-semibold text-[var(--color-text-primary)]">
                {selectedPlaylist.owner?.display_name || "Unknown"}
              </span>

              <span className="mx-1.5">·</span>

              <span>{playlistTracks.length} songs</span>

              {totalDuration > 0 && (
                <>
                  <span className="mx-1.5">·</span>
                  <span>{Math.floor(totalDuration / 60000)} min</span>
                </>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-center animate-slide-up" style={{ animationDelay: "60ms" }}>
            <button
              onClick={() => onPlayContext(selectedPlaylist.uri)}
              className="play-btn-hover flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent)] text-black shadow-lg shadow-black/30 transition-all"
              aria-label="Play playlist"
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden="true">
                <path d="M8 5.14v14l11-7-11-7z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Track List */}
        <div className="px-4 md:px-8">
          {/* Header */}
          <div className="mb-2 flex items-center border-b border-[var(--color-border)] px-3 pb-2 text-[13px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
            <span className="w-10 text-center">#</span>
            <span className="ml-3 flex-1">Title</span>
            <span className="hidden sm:block w-40">Album</span>
            <span className="w-16 text-right">⏱</span>
          </div>

          {playlistTracks.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[17px] text-[var(--color-text-primary)] mb-1 font-medium">
                Add some tracks
              </p>
              <p className="text-[15px] text-[var(--color-text-secondary)]">
                Start building your playlist.
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {playlistTracks.map((track, i) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={i}
                  isActive={currentTrack?.id === track.id}
                  isPlaying={isPlaying}
                  onPlay={() => onPlayTrack(track)}
                  onSelectArtist={onSelectArtist}
                  onSelectAlbum={onSelectAlbum}
                  onNotice={onNotice}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Artist view
  if (view === "artist" && selectedArtist) {
    const artistCover = selectedArtist.images?.[0]?.url;

    return (
      <div className="flex-1 overflow-y-auto pb-28">
        {/* Artist Hero */}
        <div className="relative px-4 pb-6 pt-16 md:px-8">
          {artistCover ? (
            <img
              src={artistCover}
              alt={selectedArtist.name}
              className="mx-auto mb-6 aspect-square h-48 w-48 rounded-full object-cover shadow-2xl sm:h-56 sm:w-56 animate-fade-in"
            />
          ) : (
            <div className="mx-auto mb-6 flex h-48 w-48 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-surface-card)] shadow-2xl sm:h-56 sm:w-56 animate-fade-in">
              <span className="text-4xl">🎵</span>
            </div>
          )}

          <div className="text-center animate-slide-up">
            <p className="text-vinyl-micro mb-1 text-[var(--color-text-secondary)] uppercase">
              Artist
            </p>

            <h1 className="text-vinyl-display mx-auto mb-2 max-w-2xl truncate px-2 leading-tight text-[var(--color-text-primary)]">
              {selectedArtist.name}
            </h1>

            {selectedArtist.genres && selectedArtist.genres.length > 0 && (
              <p className="mb-2 text-[15px] text-[var(--color-text-secondary)]">
                {(selectedArtist.genres ?? []).join(", ")}
              </p>
            )}

            {selectedArtist.followers?.total !== undefined && (
              <p className="text-[14px] text-[var(--color-text-secondary)]">
                {selectedArtist.followers.total.toLocaleString()} followers
              </p>
            )}
          </div>

          <div className="mt-6 flex justify-center animate-slide-up" style={{ animationDelay: "60ms" }}>
            <button
              onClick={() => onPlayContext(`spotify:artist:${selectedArtist.id}`)}
              className="play-btn-hover flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent)] text-black shadow-lg shadow-black/30 transition-all"
              aria-label={`Play ${selectedArtist.name}`}
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden="true">
                <path d="M8 5.14v14l11-7-11-7z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Top Tracks */}
        <div className="px-4 md:px-8">
          <h2 className="mb-2 px-3 text-vinyl-title-lg text-[var(--color-text-primary)]">
            Popular
          </h2>
          <div className="space-y-0.5">
            {artistTracks.length === 0 ? (
              <p className="py-10 text-center text-[15px] text-[var(--color-text-secondary)]">
                No tracks found
              </p>
            ) : (
              artistTracks.map((track, i) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={i}
                  isActive={currentTrack?.id === track.id}
                  isPlaying={isPlaying}
                  onPlay={() => onPlayTrack(track)}
                  onSelectArtist={onSelectArtist}
                  onSelectAlbum={onSelectAlbum}
                  onNotice={onNotice}
                />
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // Album view
  if (view === "album" && selectedAlbum) {
    const albumCover = selectedAlbum.images?.[0]?.url;

    return (
      <div className="flex-1 overflow-y-auto pb-28">
        {/* Album Hero */}
        <div className="relative px-4 pb-6 pt-16 md:px-8">
          {albumCover ? (
            <img
              src={albumCover}
              alt={selectedAlbum.name}
              className="mx-auto mb-6 h-48 w-48 rounded-xl object-cover shadow-2xl sm:h-56 sm:w-56 animate-fade-in"
            />
          ) : (
            <div className="mx-auto mb-6 flex h-48 w-48 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-surface-card)] shadow-2xl sm:h-56 sm:w-56 animate-fade-in">
              <span className="text-4xl">🎵</span>
            </div>
          )}

          <div className="text-center animate-slide-up">
            <p className="text-vinyl-micro mb-1 text-[var(--color-text-secondary)] uppercase">
              Album
            </p>

            <h1 className="text-vinyl-display mx-auto mb-2 max-w-2xl truncate px-2 leading-tight text-[var(--color-text-primary)]">
              {selectedAlbum.name}
            </h1>

            <div className="flex items-center justify-center gap-1 text-[14px] text-[var(--color-text-secondary)]">
              {selectedAlbum.artists && selectedAlbum.artists.length > 0 && (
                <>
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    {(selectedAlbum.artists ?? [])[0].name}
                  </span>
                  <span className="mx-1.5">·</span>
                </>
              )}
              <span>{selectedAlbum.release_date?.slice(0, 4)}</span>
              <span className="mx-1.5">·</span>
              <span>{albumTracks.length} songs</span>
            </div>
          </div>

          <div className="mt-6 flex justify-center animate-slide-up" style={{ animationDelay: "60ms" }}>
            <button
              onClick={() => onPlayContext(`spotify:album:${selectedAlbum.id}`)}
              className="play-btn-hover flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent)] text-black shadow-lg shadow-black/30 transition-all"
              aria-label={`Play ${selectedAlbum.name}`}
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden="true">
                <path d="M8 5.14v14l11-7-11-7z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Track List */}
        <div className="px-4 md:px-8">
          <div className="mb-2 flex items-center border-b border-[var(--color-border)] px-3 pb-2 text-[13px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
            <span className="w-10 text-center">#</span>
            <span className="ml-3 flex-1">Title</span>
            <span className="w-16 text-right">⏱</span>
          </div>

          {albumTracks.length === 0 ? (
            <p className="py-16 text-center text-[15px] text-[var(--color-text-secondary)]">
              No tracks found
            </p>
          ) : (
            <div className="space-y-0.5">
              {albumTracks.map((track, i) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={i}
                  isActive={currentTrack?.id === track.id}
                  isPlaying={isPlaying}
                  onPlay={() => onPlayTrack(track)}
                  onSelectArtist={onSelectArtist}
                  onSelectAlbum={onSelectAlbum}
                  onNotice={onNotice}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Liked Songs view
  if (view === "liked") {
    const totalDuration = likedTracks.reduce((acc, t) => acc + t.duration_ms, 0);

    return (
      <div className="flex-1 overflow-y-auto pb-28">
        {/* Liked Hero */}
        <div className="relative px-4 pb-6 pt-16 md:px-8">
          <div className="mx-auto mb-6 flex h-48 w-48 items-center justify-center rounded-xl bg-gradient-to-br from-[#450af5] via-[#1ed760] to-[#2997ff] shadow-2xl sm:h-56 sm:w-56 animate-fade-in">
            <svg viewBox="0 0 24 24" className="h-20 w-20 fill-white" aria-hidden="true">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>

          {/* Refresh */}
          <div className="absolute right-4 top-16 md:right-8">
            <button
              onClick={onRefreshLiked}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-interactive)] hover:text-[var(--color-text-primary)]"
              aria-label="Refresh liked songs"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
              </svg>
            </button>
          </div>

          <div className="text-center animate-slide-up">
            <h1 className="text-vinyl-display mx-auto mb-2 text-[var(--color-text-primary)]">
              Liked Songs
            </h1>

            <p className="text-[14px] text-[var(--color-text-secondary)]">
              {likedStatus === "loading"
                ? `Loading ${likedLoaded.toLocaleString()} of ${likedTotal.toLocaleString()} songs…`
                : `${likedTotal.toLocaleString()} songs${
                    totalDuration > 0
                      ? ` · ${Math.floor(totalDuration / 3600000)} hr ${Math.floor(
                          (totalDuration % 3600000) / 60000
                        )} min`
                      : ""
                  }`}
            </p>

            {likedStatus === "loading" && likedTotal > 0 && (
              <div className="mx-auto mt-3 h-1 w-40 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300"
                  style={{ width: `${(likedLoaded / likedTotal) * 100}%` }}
                />
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-center animate-slide-up" style={{ animationDelay: "60ms" }}>
            <button
              onClick={() => onPlayContext("spotify:collection:tracks")}
              disabled={likedStatus === "ready" && likedTotal === 0}
              className="play-btn-hover flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent)] text-black shadow-lg shadow-black/30 transition-all disabled:opacity-50"
              aria-label="Play Liked Songs"
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden="true">
                <path d="M8 5.14v14l11-7-11-7z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Track List */}
        <div className="px-4 md:px-8">
          {likedTracks.length === 0 ? (
            likedStatus === "loading" ? (
              <div className="space-y-0.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <TrackRowSkeleton key={i} />
                ))}
              </div>
            ) : (
              <p className="py-16 text-center text-[15px] text-[var(--color-text-secondary)]">
                You haven&rsquo;t liked any songs yet.
              </p>
            )
          ) : (
            <div className="space-y-0.5">
              {likedTracks.map((track, i) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={i}
                  isActive={currentTrack?.id === track.id}
                  isPlaying={isPlaying}
                  onPlay={() => onPlayTrack(track)}
                  onSelectArtist={onSelectArtist}
                  onSelectAlbum={onSelectAlbum}
                  onNotice={onNotice}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Home view — Apple Music "Listen Now" style
  const quickPicks = quickPickData(playlists);
  const hero = quickPicks[0] || playlists[0] || null;
  const heroCover = hero?.images?.[0]?.url;

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user?.display_name?.split(" ")[0] || "";
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-28 md:px-6">
      {/* Greeting */}
      <div className="mt-4">
        <p className="text-apple-caption uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
          {dateLabel}
        </p>
        <h2 className="mt-1 text-apple-display text-[var(--color-text-primary)] md:text-[40px]">
          {greeting}{firstName ? `, ${firstName}` : ""}
        </h2>
      </div>

      {/* Featured hero — made for you */}
      {hero && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelectPlaylist(hero)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSelectPlaylist(hero);
          }}
          className="group relative mt-6 block aspect-[2.4/1] w-full cursor-pointer overflow-hidden rounded-2xl text-left shadow-xl shadow-black/30 animate-fade-in sm:aspect-[2.8/1]"
        >
          {heroCover ? (
            <img
              src={heroCover}
              alt={hero.name}
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[320ms] group-hover:opacity-80"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent)] via-[#1db954] to-[#7c2dff]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent home-hero-glow" />

          <div className="relative flex h-full flex-col items-start justify-end p-4 sm:p-6">
            <p className="text-apple-caption uppercase tracking-[0.14em] text-[var(--color-text-primary)]/70">
              Made for you
            </p>
            <h3 className="mt-1 max-w-[80%] truncate text-apple-title2 text-[var(--color-text-primary)] lg:text-[2rem]">
              {hero.name}
            </h3>
            <p className="mt-1 max-w-[80%] truncate text-apple-footnote text-[var(--color-text-secondary)]">
              {hero.description ||
                (hero.tracks?.total ? `${hero.tracks.total} songs` : "Your personal collection")}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlayContext(hero.uri);
              }}
              className="play-btn-hover mt-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-black"
              aria-label={`Play ${hero.name}`}
            >
              <PlayIcon className="h-5 w-5 fill-current" />
            </button>
          </div>
        </div>
      )}

      {/* Recently Played */}
      {recent.length > 0 && (
        <HomeRow title="Recently Played">
          <div className="snap-row -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:-mx-6 md:px-6">
            {recent.slice(0, 12).map((track) => (
              <TrackCoverCard
                key={track.id}
                title={track.name}
                subtitle={track.artists?.[0]?.name || ""}
                image={track.album?.images?.[1]?.url || track.album?.images?.[0]?.url}
                onClick={() => onPlayTrack(track)}
              />
            ))}
          </div>
        </HomeRow>
      )}

      {/* Made For You — playlists as mixes */}
      {quickPicks.length > 0 && (
        <HomeRow title="Made For You">
          <div className="snap-row -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:-mx-6 md:px-6">
            {quickPicks.map((playlist) => (
              <TrackCoverCard
                key={playlist.id}
                title={playlist.name}
                subtitle={`${playlist.tracks?.total || 0} songs`}
                image={playlist.images?.[0]?.url}
                onClick={() => onSelectPlaylist(playlist)}
              />
            ))}
          </div>
        </HomeRow>
      )}

      {/* Top Artists */}
      {topArtists.length > 0 && (
        <HomeRow title="Top Artists">
          <div className="snap-row -mx-4 flex gap-5 overflow-x-auto px-4 pb-1 md:-mx-6 md:px-6">
            {topArtists.slice(0, 12).map((artist) => (
              <button
                key={artist.id}
                onClick={() => onSelectArtist(artist)}
                className="snap-start w-24 shrink-0 text-left"
              >
                <div className="aspect-square w-full overflow-hidden rounded-full bg-[var(--color-surface-card)] shadow-md">
                  {artist.images?.[0]?.url ? (
                    <img
                      src={artist.images[0].url}
                      alt={artist.name}
                      className="h-full w-full object-cover transition-opacity duration-[320ms] group-hover:opacity-80"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl">🎵</div>
                  )}
                </div>
                <p className="mt-2 w-full truncate text-center text-apple-footnote font-medium text-[var(--color-text-primary)]">
                  {artist.name}
                </p>
                <p className="w-full truncate text-center text-apple-caption text-[var(--color-text-tertiary)]">
                  Artist
                </p>
              </button>
            ))}
          </div>
        </HomeRow>
      )}

      {/* Top Tracks — numbered list */}
      {topTracks.length > 0 && (
        <HomeRow title="Top Tracks">
          <div className="space-y-1">
            {topTracks.slice(0, 10).map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                index={i}
                isActive={currentTrack?.id === track.id}
                isPlaying={isPlaying}
                onPlay={() => onPlayTrack(track)}
                onSelectArtist={onSelectArtist}
                onSelectAlbum={onSelectAlbum}
                onNotice={onNotice}
              />
            ))}
          </div>
        </HomeRow>
      )}
    </div>
  );
}

function TrackCoverCard({
  title,
  subtitle,
  image,
  onClick,
}: {
  title: string;
  subtitle: string;
  image?: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="group snap-start w-32 shrink-0 text-left sm:w-36 md:w-40">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[var(--color-surface-card)] shadow-md">
        {image ? (
          <img
            src={image}
            alt={title}
            className="h-full w-full object-cover transition-opacity duration-[320ms] group-hover:opacity-80"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl">🎵</div>
        )}
        <span className="absolute bottom-2 left-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-black opacity-0 shadow-lg transition-opacity duration-[200ms] group-hover:opacity-100">
          <PlayIcon className="ml-0.5 h-4 w-4 fill-current" />
        </span>
      </div>
      <p className="mt-2 w-full truncate text-apple-footnote font-medium text-[var(--color-text-primary)]">
        {title}
      </p>
      <p className="w-full truncate text-apple-caption text-[var(--color-text-tertiary)]">
        {subtitle}
      </p>
    </button>
  );
}

function HomeRow({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h3 className="mb-3 text-apple-headline text-[var(--color-text-primary)]">{title}</h3>
      {children}
    </section>
  );
}
