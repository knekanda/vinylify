"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  HeartIcon,
  DeviceIcon,
  PauseIcon,
  PlayIcon,
  QueueIcon,
  RepeatIcon,
  RepeatOneIcon,
  ShuffleIcon,
  SpeakerIcon,
} from "./icons";
import NowPlayingTrack from "./NowPlayingTrack";
import {
  fetchCurrentlyPlaying,
  pause,
  resume,
  next,
  prev,
  seekTo,
  setVolume,
  setRepeat,
  setShuffle,
  saveTrack,
  removeTrack,
  checkSavedTracks,
  getAvailableDevices,
  transferPlayback,
} from "../lib/spotify";
import type { SpotifyDevice, SpotifyTrack } from "../types/spotify";

function formatDuration(ms: number) {
  if (!ms || ms < 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

type Props = {
  currentTrack: SpotifyTrack | null;
  isPlaying: boolean;
  shuffle: boolean;
  repeat: string;
  progressMs: number;
  durationMs: number;
  nowPlayingOpen: boolean;
  queueOpen: boolean;
  onToggleNowPlaying: () => void;
  onToggleQueue: () => void;
  notice: string | null;
  showNotice: (msg: string) => void;
};

export default function PlayerBar({
  currentTrack,
  isPlaying,
  shuffle,
  repeat,
  progressMs,
  durationMs,
  nowPlayingOpen,
  queueOpen,
  onToggleNowPlaying,
  onToggleQueue,
  notice,
  showNotice,
}: Props) {
  const [saving, setSaving] = useState<string | null>(null);
  const [likedTracks, setLikedTracks] = useState<Set<string>>(new Set());
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);
  const [activeDevice, setActiveDevice] = useState<string | null>(null);
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [showDevices, setShowDevices] = useState(false);
  const [volume, setVolumeState] = useState(70);

  const progressBarRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef<number | null>(null);
  const lastSeekTimeRef = useRef<number>(0);

  // Hydrate liked state when track changes
  useEffect(() => {
    if (!currentTrack) return;
    let cancelled = false;
    checkSavedTracks([currentTrack.id]).then((result) => {
      if (cancelled) return;
      if (result[0]) {
        setLikedTracks((prev) => new Set(prev).add(currentTrack.id));
      } else {
        setLikedTracks((prev) => {
          const next = new Set(prev);
          next.delete(currentTrack.id);
          return next;
        });
      }
    });
    return () => { cancelled = true; };
  }, [currentTrack?.id]);

  const handlePause = useCallback(async () => {
    if (isPlaying) {
      const result = await pause();
      if (!result.ok) showNotice("Could not pause playback");
    } else {
      const result = await resume();
      if (!result.ok) showNotice("Could not resume playback");
    }
  }, [isPlaying, showNotice]);

  const handleNext = useCallback(async () => {
    const result = await next();
    if (!result.ok) showNotice("Could not skip to next track");
  }, [showNotice]);

  const handlePrev = useCallback(async () => {
    const result = await prev();
    if (!result.ok) showNotice("Could not skip to previous track");
  }, [showNotice]);

  const handleSaveTrack = useCallback(async () => {
    if (!currentTrack) return;
    const trackId = currentTrack.id;

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
        showNotice("Failed to remove from Library");
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
        showNotice("Failed to add to Library");
      }
    }

    setTimeout(() => setSaving(null), 600);
  }, [currentTrack, likedTracks, showNotice]);

  const handleToggleShuffle = useCallback(async () => {
    const newState = !shuffle;
    const result = await setShuffle(newState);
    if (!result.ok) showNotice("Could not change shuffle");
  }, [shuffle, showNotice]);

  const handleToggleRepeat = useCallback(async () => {
    let newState = "off";
    if (repeat === "off") newState = "track";
    else if (repeat === "track") newState = "context";

    const result = await setRepeat(newState);
    if (!result.ok) showNotice("Could not change repeat mode");
  }, [repeat, showNotice]);

  const prevVolumeRef = useRef<number>(70);

  const handleMute = useCallback(async () => {
    if (volume > 0) {
      prevVolumeRef.current = volume;
      setVolumeState(0);
      const result = await setVolume(0);
      if (!result.ok) showNotice("Could not change volume");
    } else {
      const restore = prevVolumeRef.current > 0 ? prevVolumeRef.current : 70;
      setVolumeState(restore);
      const result = await setVolume(restore);
      if (!result.ok) showNotice("Could not change volume");
    }
  }, [volume, showNotice]);

  const startSeeking = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsSeeking(true);

      const clientX =
        "touches" in e ? e.touches[0].clientX : e.clientX;
      dragOffsetRef.current = clientX;

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

    const result = await seekTo(seekPosition);
    if (!result.ok) showNotice("Could not seek to position");
  }, [isSeeking, seekPosition, showNotice]);

  const handleToggleDevice = useCallback(async () => {
    const show = !showDevices;
    setShowDevices(show);

    if (show) {
      const availableDevices = await getAvailableDevices();
      setDevices(availableDevices);

      const playbackState = await fetchCurrentlyPlaying();
      if (playbackState?.device?.id) {
        setActiveDevice(playbackState.device.id);
      }
    }
  }, [showDevices]);

  const handleTransferPlayback = useCallback(
    async (deviceId: string) => {
      const result = await transferPlayback(deviceId);
      if (result.ok) {
        setActiveDevice(deviceId);
        showNotice("Playback transferred");
      } else {
        showNotice("Could not transfer playback");
      }
    },
    [showNotice]
  );

  useEffect(() => {
    if (!isSeeking) return;

    function handleMouseMove(e: MouseEvent) {
      if (dragOffsetRef.current === null) return;

      const rect = progressBarRef.current?.getBoundingClientRect();
      if (!rect) return;

      const position = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const seekMs = Math.round(position * durationMs);
      setSeekPosition(seekMs);
    }

    function handleMouseUp() {
      handleSeekComplete();
      dragOffsetRef.current = null;
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
      dragOffsetRef.current = null;
    }

    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isSeeking, durationMs, handleSeekComplete]);

  const displayProgress = isSeeking ? seekPosition : progressMs;
  const progressPercent =
    durationMs > 0 ? (displayProgress / durationMs) * 100 : 0;
  const hasValidTrack = currentTrack !== null;

  return (
    <div className="relative z-50 glass-heavy player-bar shrink-0">
      {/* Notice toast */}
      {notice && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[var(--color-surface-card)] px-4 py-2 text-[13px] font-medium text-[var(--color-text-primary)] shadow-xl animate-slide-up z-50 border border-[var(--color-border)]">
          {notice}
        </div>
      )}

      <div className="grid h-20 grid-cols-[1fr_2fr_1fr] items-center px-4 md:px-6">
        {/* Left: Track info + Save */}
        <div className="flex items-center gap-3 min-w-0">
          <NowPlayingTrack
            currentTrack={currentTrack}
            albumImageUrl={currentTrack?.album?.images?.[0]?.url}
            isPlaying={isPlaying}
            onToggleNowPlaying={onToggleNowPlaying}
            nowPlayingOpen={nowPlayingOpen}
          />

          {hasValidTrack && (
            <button
              onClick={handleSaveTrack}
              disabled={saving === currentTrack.id}
              className={`control shrink-0 transition-all duration-normal ${
                saving === currentTrack.id
                  ? "animate-pulse"
                  : likedTracks.has(currentTrack.id)
                    ? "text-[var(--color-accent)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
              aria-label="Save to Library"
              aria-pressed={likedTracks.has(currentTrack.id)}
            >
              <HeartIcon
                className={`h-5 w-5 ${
                  likedTracks.has(currentTrack.id) ? "fill-current" : ""
                }`}
              />
            </button>
          )}
        </div>

        {/* Center: Controls + Progress */}
        <div className="flex flex-col items-center justify-center gap-1">
          <div className="flex items-center gap-4">
            <button
              onClick={handleToggleShuffle}
              className={`control hidden sm:inline-flex ${
                shuffle
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-text-secondary)]"
              }`}
              aria-label="Toggle shuffle"
              aria-pressed={shuffle}
            >
              <ShuffleIcon className="h-4 w-4" />
            </button>

            <button
              onClick={handlePrev}
              className="control text-[var(--color-text-secondary)]"
              aria-label="Previous"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" />
              </svg>
            </button>

            <button
              onClick={handlePause}
              disabled={!hasValidTrack}
              className="play-btn-hover flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-on-accent)] transition-all disabled:opacity-50 disabled:hover:transform-none"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <PauseIcon className="h-4 w-4 fill-current" />
              ) : (
                <PlayIcon className="h-4 w-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={handleNext}
              className="control text-[var(--color-text-secondary)]"
              aria-label="Next"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d="M16 18h2V6h-2v12zM6 18l8.5-6L6 6v12z" />
              </svg>
            </button>

            <button
              onClick={handleToggleRepeat}
              className={`control hidden sm:inline-flex ${
                repeat !== "off"
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-text-secondary)]"
              }`}
              aria-label="Toggle repeat"
              aria-pressed={repeat !== "off"}
            >
              {repeat === "track" ? (
                <RepeatOneIcon className="h-4 w-4" />
              ) : (
                <RepeatIcon className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Progress Bar */}
          <div className="flex w-full max-w-lg items-center gap-2 text-[11px] font-medium tabular-nums text-[var(--color-text-tertiary)]">
            <span className="w-10 text-right">
              {formatDuration(displayProgress)}
            </span>

            <div
              ref={progressBarRef}
              className="progress-bar-container group flex-1"
              onMouseDown={startSeeking}
              onTouchStart={startSeeking}
              role="slider"
              aria-label="Seek position"
              aria-valuemin={0}
              aria-valuemax={durationMs}
              aria-valuenow={displayProgress}
            >
              <div className="progress-bar-track" />
              <div
                className="progress-bar-fill"
                style={{ width: `${progressPercent}%` }}
              />
              <div
                className="progress-bar-thumb"
                style={{ left: `${progressPercent}%` }}
              />
            </div>

            <span className="w-10">
              {formatDuration(durationMs)}
            </span>
          </div>
        </div>

          {/* Right: Volume + Queue + Device */}
        <div className="flex items-center justify-end">
          <button
            onClick={onToggleNowPlaying}
            className={`control hidden md:inline-flex ${
              nowPlayingOpen
                ? "text-[var(--color-accent)]"
                : "text-[var(--color-text-secondary)]"
            }`}
            aria-label="Now Playing"
            aria-pressed={nowPlayingOpen}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </button>

          <button
            onClick={onToggleQueue}
            className={`control hidden sm:inline-flex ${
              queueOpen
                ? "text-[var(--color-accent)]"
                : "text-[var(--color-text-secondary)]"
            }`}
            aria-label="Queue"
            aria-pressed={queueOpen}
          >
            <QueueIcon className="h-4 w-4" />
          </button>

          <div className="relative hidden md:flex items-center gap-1">
            <button
              onClick={handleMute}
              className={`control ${
                volume === 0
                  ? "text-[var(--color-text-tertiary)]"
                  : "text-[var(--color-text-secondary)]"
              }`}
              aria-label={volume === 0 ? "Unmute" : "Mute"}
              aria-pressed={volume === 0}
            >
              <SpeakerIcon className="h-4 w-4" />
            </button>

            <input
              type="range"
              min="0"
              max="100"
              className="h-1 w-24 cursor-pointer accent-[var(--color-text-primary)]"
              value={volume}
              aria-label="Volume"
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setVolumeState(val);
                prevVolumeRef.current = val;
                setVolume(val);
              }}
            />
          </div>

          <div className="relative">
            <button
              onClick={handleToggleDevice}
              className={`control ${
                showDevices
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-text-secondary)]"
              }`}
              aria-label="Devices"
              aria-pressed={showDevices}
            >
              <DeviceIcon className="h-4 w-4" />
            </button>

            {showDevices && (
              <div className="absolute bottom-full right-0 mb-2 w-64 rounded-lg bg-[var(--color-surface-elevated)] p-2 shadow-xl border border-[var(--color-border)] animate-scale-in z-50">
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
                        <p className="truncate text-[13px] font-medium">
                          {device.name}
                        </p>
                        <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">
                          {device.type}
                        </p>
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
      </div>
    </div>
  );
}
