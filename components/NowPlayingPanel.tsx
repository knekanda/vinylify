"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  CloseIcon,
  DeviceIcon,
  HeartIcon,
  PauseIcon,
  PlayIcon,
  QueueIcon,
  RepeatIcon,
  RepeatOneIcon,
  ShuffleIcon,
} from "./icons";
import Image from "next/image";
import {
  next,
  prev,
  pause,
  resume,
  seekTo,
  setRepeat,
  setShuffle,
  saveTrack,
  removeTrack,
  checkSavedTracks,
  getAvailableDevices,
  transferPlayback,
  playTrack,
} from "../lib/spotify";
import { useQueueData } from "../hooks/useQueueData";
import type { SpotifyDevice, SpotifyTrack } from "../types/spotify";

function formatDuration(ms: number) {
  if (!ms || ms < 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

type Props = {
  track: SpotifyTrack | null;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
  shuffle: boolean;
  repeat: string;
  onClose: () => void;
  onOpenQueue?: () => void;
};

export default function NowPlayingPanel({
  track,
  isPlaying,
  progressMs: progressMsProp,
  durationMs,
  shuffle,
  repeat,
  onClose,
}: Props) {
  const [saving, setSaving] = useState<string | null>(null);
  const [likedTracks, setLikedTracks] = useState<Set<string>>(new Set());
  const [progressMs, setProgressMs] = useState(progressMsProp);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [showDevices, setShowDevices] = useState(false);
  const [activeDevice, setActiveDevice] = useState<string | null>(null);
  const [queueDrawer, setQueueDrawer] = useState(false);

  const progressBarRef = useRef<HTMLDivElement>(null);
  const lastSeekTimeRef = useRef<number>(0);

  // Live queue for the mini "Up next" and the side drawer.
  const { queue } = useQueueData(12000);

  useEffect(() => {
    if (!isSeeking) {
      queueMicrotask(() => setProgressMs(progressMsProp));
    }
  }, [progressMsProp, isSeeking]);

  // Escape closes the queue drawer first, then the whole overlay.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (queueDrawer) {
        setQueueDrawer(false);
      } else {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, queueDrawer]);

  // Hydrate liked state when track changes
  useEffect(() => {
    if (!track) return;
    let cancelled = false;
    checkSavedTracks([track.id]).then((result) => {
      if (cancelled) return;
      if (result[0]) {
        setLikedTracks((prev) => new Set(prev).add(track.id));
      } else {
        setLikedTracks((prev) => {
          const next = new Set(prev);
          next.delete(track.id);
          return next;
        });
      }
    });
    return () => { cancelled = true; };
  }, [track?.id]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isPlaying && !isSeeking) {
      interval = setInterval(() => {
        setProgressMs((prev) => Math.min(prev + 1000, durationMs));
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, durationMs, isSeeking]);

  const handlePause = useCallback(async () => {
    if (isPlaying) await pause();
    else await resume();
  }, [isPlaying]);

  const handleNext = useCallback(async () => {
    await next();
  }, []);

  const handlePrev = useCallback(async () => {
    await prev();
  }, []);

  const handleSaveTrack = useCallback(async () => {
    if (!track) return;
    const trackId = track.id;

    setSaving(trackId);

    if (likedTracks.has(trackId)) {
      setLikedTracks((prev) => {
        const next = new Set(prev);
        next.delete(trackId);
        return next;
      });

      const result = await removeTrack(trackId);

      if (!result.ok) {
        setLikedTracks((prev) => new Set(prev).add(trackId));
      }
    } else {
      setLikedTracks((prev) => new Set(prev).add(trackId));

      const result = await saveTrack(trackId);

      if (!result.ok) {
        setLikedTracks((prev) => {
          const next = new Set(prev);
          next.delete(trackId);
          return next;
        });
      }
    }

    setTimeout(() => setSaving(null), 600);
  }, [track, likedTracks]);

  const handleToggleShuffle = useCallback(async () => {
    await setShuffle(!shuffle);
  }, [shuffle]);

  const handleToggleRepeat = useCallback(async () => {
    let newState = "off";
    if (repeat === "off") newState = "track";
    else if (repeat === "track") newState = "context";
    await setRepeat(newState);
  }, [repeat]);

  const handleToggleDevice = useCallback(async () => {
    const show = !showDevices;
    setShowDevices(show);

    if (show) {
      const availableDevices = await getAvailableDevices();
      setDevices(availableDevices);
      const playbackState = await getPlaybackStateForDevice();
      if (playbackState?.id) setActiveDevice(playbackState.id);
    }
  }, [showDevices]);

  const handleTransferPlayback = useCallback(
    async (deviceId: string) => {
      const result = await transferPlayback(deviceId);
      if (result.ok) setActiveDevice(deviceId);
    },
    []
  );

  const startSeeking = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsSeeking(true);

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const rect = progressBarRef.current?.getBoundingClientRect();
      if (!rect) return;

      const position = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const seekMs = Math.round(position * durationMs);
      setSeekPosition(seekMs);
    },
    [durationMs]
  );

  const handleSeekComplete = useCallback(async () => {
    if (!isSeeking) return;

    setIsSeeking(false);

    const now = Date.now();
    if (now - lastSeekTimeRef.current < 1000) return;
    lastSeekTimeRef.current = now;

    await seekTo(seekPosition);
    setProgressMs(seekPosition);
  }, [isSeeking, seekPosition]);

  useEffect(() => {
    if (!isSeeking) return;

    function handleMouseMove(e: MouseEvent) {
      const rect = progressBarRef.current?.getBoundingClientRect();
      if (!rect) return;

      const position = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const seekMs = Math.round(position * durationMs);
      setSeekPosition(seekMs);
    }

    function handleMouseUp() {
      handleSeekComplete();
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isSeeking, durationMs, handleSeekComplete]);

  useEffect(() => {
    if (!isSeeking) return;

    function handleTouchMove(e: TouchEvent) {
      const rect = progressBarRef.current?.getBoundingClientRect();
      if (!rect) return;

      const position = Math.max(
        0,
        Math.min(1, (e.touches[0].clientX - rect.left) / rect.width)
      );
      const seekMs = Math.round(position * durationMs);
      setSeekPosition(seekMs);
    }

    function handleTouchEnd() {
      handleSeekComplete();
    }

    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isSeeking, durationMs, handleSeekComplete]);

  const displayProgress = isSeeking ? seekPosition : progressMs;
  const progressPercent = durationMs > 0 ? (displayProgress / durationMs) * 100 : 0;

  const albumImageUrl = track?.album?.images?.[0]?.url;
  const albumYear = track?.album?.release_date?.slice(0, 4);
  const trackArtists = track?.artists?.map((a) => a.name).join(", ") || "—";
  const isSaved = likedTracks.has(track?.id || "");

  // Queue split: the first entry is usually the current track.
  const nextInQueue = queue.filter((t) => t.id !== track?.id);
  const upNext = nextInQueue.slice(0, 3);

  const queueRows = (item: SpotifyTrack) => {
    const art = item.album?.images?.[2]?.url || item.album?.images?.[1]?.url || item.album?.images?.[0]?.url;
    return (
      <button
        key={item.id}
        onClick={() => void playTrack(item.uri)}
        className="group flex w-full items-center gap-3 rounded-lg p-1.5 text-left transition-colors hover:bg-[var(--color-surface-interactive)]"
      >
        {art ? (
          <Image src={art} alt="" width={160} height={160} className="h-10 w-10 shrink-0 rounded object-cover" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--color-surface-card)] text-base">🎵</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">{item.name}</p>
          <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">{item.artists?.map((a) => a.name).join(", ")}</p>
        </div>
        <PlayIcon className="h-4 w-4 shrink-0 fill-[var(--color-text-secondary)] opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-[#000] text-[var(--color-text-primary)] animate-player-sheet-in"
      role="dialog"
      aria-modal="true"
      aria-label="Now Playing"
    >
      {/* Immersive blurred album backdrop */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {albumImageUrl ? (
          <>
            <Image
              src={albumImageUrl}
              alt=""
              aria-hidden="true"
              width={1600}
              height={900}
              className="absolute -inset-[25%] h-[150%] w-[150%] object-cover opacity-25 blur-[120px] saturate-150"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/70" />
          </>
        ) : (
          <div className="absolute inset-0 bg-[var(--color-surface)]" />
        )}
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-5 py-4 md:px-8">
        <span className="text-vinyl-headline text-[var(--color-text-primary)]">Now Playing</span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setQueueDrawer((v) => !v)}
            className={`hidden md:flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
              queueDrawer
                ? "text-[var(--color-accent)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-interactive)] hover:text-[var(--color-text-primary)]"
            }`}
            aria-label="Toggle queue"
          >
            <QueueIcon className="h-5 w-5" />
          </button>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-interactive)] hover:text-[var(--color-text-primary)]"
            aria-label="Close now playing"
          >
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Content — mobile vertical / desktop lg split */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto px-5 pb-10 md:px-8 lg:flex-row lg:items-center lg:gap-0 lg:overflow-hidden lg:pb-8">
        {/* Artwork */}
        <div className="flex w-full items-center justify-center lg:h-full lg:w-1/2">
          <div className="w-full max-w-[min(46vh,360px)] lg:max-w-[min(64vh,520px)] animate-now-art-in">
            {albumImageUrl ? (
              <Image
                src={albumImageUrl}
                alt={track?.name || "Album Art"}
                width={460}
                height={460}
                className="w-full aspect-square rounded-xl object-cover hero-album-shadow animate-fade-in"
              />
            ) : (
              <div className="flex w-full aspect-square items-center justify-center rounded-xl bg-[var(--color-surface-card)] hero-album-shadow">
                <span className="text-7xl">🎵</span>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="flex w-full min-w-0 flex-[1.15] flex-col justify-center lg:pl-8 lg:pr-10 animate-now-content-in">
          {/* Track info */}
          <div className="text-center lg:text-left">
            <h2 className="text-[2rem] font-extrabold tracking-tight leading-[1.08] text-[var(--color-text-primary)] line-clamp-2 md:text-[2.5rem] lg:text-[2.75rem]">
              {track?.name || "Not Playing"}
            </h2>
            <p className="mt-1.5 truncate text-lg text-[var(--color-text-secondary)]">
              {trackArtists}
            </p>
            {track && (
              <p className="mt-1 truncate text-sm text-[var(--color-text-tertiary)]">
                {track.album?.name}{albumYear ? ` · ${albumYear}` : ""}
              </p>
            )}
          </div>

          {/* Progress */}
          <div className="mt-6 flex w-full max-w-2xl items-center gap-3 text-[12px] font-medium tabular-nums text-[var(--color-text-tertiary)] lg:mt-8">
            <span className="w-10 text-right">{formatDuration(displayProgress)}</span>
            <div
              ref={progressBarRef}
              className="progress-bar-container group flex-1 now-progress"
              onMouseDown={startSeeking}
              onTouchStart={startSeeking}
              role="slider"
              aria-label="Seek position"
              aria-valuemin={0}
              aria-valuemax={durationMs}
              aria-valuenow={displayProgress}
            >
              <div className="progress-bar-track" />
              <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
              <div className="progress-bar-thumb" style={{ left: `${progressPercent}%` }} />
            </div>
            <span className="w-10">{formatDuration(durationMs)}</span>
          </div>

          {/* Transport */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-5 lg:mt-6 lg:justify-start">
            <button
              onClick={handleToggleShuffle}
              className={`transition-colors ${shuffle ? "text-[var(--color-accent)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}
              aria-label="Toggle shuffle"
            >
              <ShuffleIcon className="h-5 w-5 md:h-6 md:w-6" />
            </button>
            <button
              onClick={handlePrev}
              className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] active:scale-95"
              aria-label="Previous"
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current"><path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" /></svg>
            </button>
            <button
              onClick={handlePause}
              disabled={!track}
              className="play-btn-hover flex h-16 w-16 items-center justify-center rounded-full bg-white text-black shadow-xl shadow-black/30 transition-all disabled:opacity-50 lg:h-20 lg:w-20"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <PauseIcon className="h-8 w-8 fill-current" />
              ) : (
                <PlayIcon className="h-8 w-8 fill-current ml-0.5" />
              )}
            </button>
            <button
              onClick={handleNext}
              className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] active:scale-95"
              aria-label="Next"
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current"><path d="M16 18h2V6h-2v12zM6 18l8.5-6L6 6v12z" /></svg>
            </button>
            <button
              onClick={handleToggleRepeat}
              className={`transition-colors ${repeat !== "off" ? "text-[var(--color-accent)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}
              aria-label="Toggle repeat"
            >
              {repeat === "track" ? (
                <RepeatOneIcon className="h-5 w-5 md:h-6 md:w-6" />
              ) : (
                <RepeatIcon className="h-5 w-5 md:h-6 md:w-6" />
              )}
            </button>
          </div>

          {/* Secondary actions */}
          <div className="mt-5 flex items-center justify-center gap-3 lg:mt-6 lg:justify-start">
            <button
              onClick={handleSaveTrack}
              disabled={!track || saving === track?.id}
              className={`transition-all ${
                saving === track?.id
                  ? "animate-pulse"
                  : isSaved
                    ? "text-[var(--color-accent)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
              aria-label="Save to Library"
            >
              <HeartIcon className={`h-5 w-5 md:h-6 md:w-6 ${isSaved ? "fill-current" : ""}`} />
            </button>

            <button
              onClick={() => setQueueDrawer((v) => !v)}
              className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors md:hidden ${
                queueDrawer
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
              aria-label="Toggle queue"
            >
              <QueueIcon className="h-5 w-5 md:h-6 md:w-6" />
            </button>

            <div className="relative">
              <button
                onClick={handleToggleDevice}
                className={`transition-colors ${showDevices ? "text-[var(--color-accent)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}
                aria-label="Devices"
              >
                <DeviceIcon className="h-5 w-5 md:h-6 md:w-6" />
              </button>

              {showDevices && (
                <div className="absolute bottom-full right-0 mb-2 w-64 rounded-lg bg-[var(--color-surface-elevated)] p-2 shadow-xl border border-[var(--color-border)] animate-scale-in z-20">
                  <p className="px-2 py-1.5 text-[12px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Connect to a device
                  </p>

                  {devices.length === 0 ? (
                    <p className="px-2 py-3 text-[13px] text-[var(--color-text-secondary)]">
                      No devices found
                    </p>
                  ) : (
                    devices.map((device) => (
                      <button
                        key={device.id}
                        onClick={() => handleTransferPlayback(device.id)}
                        className={`flex w-full items-center gap-3 rounded-md px-2 py-2 transition-colors ${
                          activeDevice === device.id
                            ? "bg-[var(--color-surface-interactive)] text-[var(--color-accent)]"
                            : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-interactive)]"
                        }`}
                      >
                        <DeviceIcon className="h-4 w-4 shrink-0" />
                        <div className="min-w-0 text-left">
                          <p className="truncate text-[13px] font-medium">{device.name || device.type}</p>
                          <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">{device.type}</p>
                        </div>
                        {activeDevice === device.id && (
                          <svg viewBox="0 0 24 24" className="ml-auto h-4 w-4 fill-[var(--color-accent)]">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                          </svg>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Mini "Up next" */}
          {!queueDrawer && upNext.length > 0 && (
            <div className="mt-7 w-full max-w-2xl text-center lg:mt-9 lg:text-left">
              <div className="mb-2.5 flex items-center justify-between">
                <p className="text-vinyl-eyebrow text-[var(--color-text-tertiary)]">Next in queue</p>
                <button
                  onClick={() => setQueueDrawer(true)}
                  className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  See queue
                </button>
              </div>
              <div className="space-y-0.5">
                {upNext.map(queueRows)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Queue drawer — slides in from the right */}
      {queueDrawer && (
        <aside
          className="absolute inset-y-0 right-0 z-20 flex w-full flex-col overflow-hidden border-l border-white/10 bg-[rgba(8,8,12,0.92)] backdrop-blur-xl animate-queue-drawer-in sm:w-80"
          aria-label="Queue"
        >
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-vinyl-headline text-[var(--color-text-primary)]">Queue</span>
            <button
              onClick={() => setQueueDrawer(false)}
              className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-interactive)] hover:text-[var(--color-text-primary)]"
              aria-label="Close queue"
            >
              <CloseIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
            {track && (
              <>
                <p className="px-2 py-1.5 text-[12px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Now playing
                </p>
                <div className="flex items-center gap-3 rounded-lg bg-[var(--color-surface-interactive)] p-2">
                  {albumImageUrl ? (
                    <Image src={albumImageUrl} alt="" width={160} height={160} className="h-11 w-11 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-[var(--color-surface-card)] text-base">🎵</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">{track.name}</p>
                    <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">{trackArtists}</p>
                  </div>
                  {isPlaying && (
                    <div className="flex h-4 items-end gap-[3px]" aria-label="Playing">
                      <span className="w-[3px] animate-eq-1 rounded-sm bg-[var(--color-accent)]" />
                      <span className="w-[3px] animate-eq-2 rounded-sm bg-[var(--color-accent)]" />
                      <span className="w-[3px] animate-eq-3 rounded-sm bg-[var(--color-accent)]" />
                    </div>
                  )}
                </div>
              </>
            )}

            <p className="px-2 pb-1.5 pt-4 text-[12px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Next in queue
            </p>

            {nextInQueue.length === 0 ? (
              <p className="px-2 py-3 text-[13px] text-[var(--color-text-secondary)]">
                Nothing queued up yet.
              </p>
            ) : (
              <div className="space-y-0.5">{nextInQueue.map(queueRows)}</div>
            )}

            {track?.album?.name && (
              <p className="px-2 pb-1 pt-6 text-[12px] text-[var(--color-text-tertiary)]">
                Play from: {track.album.name}
              </p>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

// Set the current active device id from playback state (used by the device menu).
async function getPlaybackStateForDevice(): Promise<{ id: string } | null> {
  try {
    const { fetchCurrentlyPlaying } = await import("../lib/spotify");
    const state = await fetchCurrentlyPlaying();
    return state?.device?.id ? { id: state.device.id } : null;
  } catch {
    return null;
  }
}