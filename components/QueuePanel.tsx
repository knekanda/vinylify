"use client";

import { useEffect, useState, useCallback } from "react";
import { CloseIcon, PauseIcon, PlayIcon } from "./icons";
import Image from "next/image";
import { getQueue, playTrack } from "../lib/spotify";
import type { SpotifyTrack } from "../types/spotify";

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
  onClose: () => void;
};

export default function QueuePanel({ currentTrack, isPlaying, onClose }: Props) {
  const [queue, setQueue] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getQueue().then((data) => {
      if (cancelled) return;
      if (data) setQueue(data.queue);
      setLoading(false);
    });
    const interval = setInterval(() => {
      getQueue().then((data) => {
        if (cancelled) return;
        if (data) setQueue(data.queue);
      });
    }, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  const handlePlay = useCallback(async (track: SpotifyTrack) => {
    const result = await playTrack(track.uri);
    if (result.ok) {
      setQueue((prev) => prev.filter((t) => t.uri !== track.uri));
    }
  }, []);

  return (
    <>
      {/* Desktop sidebar panel */}
      <aside
        className={`hidden md:flex w-80 shrink-0 flex-col overflow-hidden border-l border-[var(--color-border-soft)] bg-[var(--color-surface)] transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex flex-col h-full px-6 pt-4 pb-6">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-vinyl-headline text-[var(--color-text-primary)]">
              Queue
            </h3>
            <button
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-interactive)] hover:text-[var(--color-text-primary)]"
              aria-label="Close"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Now Playing */}
            {currentTrack && (
              <div className="mb-4">
                <p className="mb-2 text-[13px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Now Playing
                </p>
                <div className="flex items-center gap-3 rounded-md bg-[var(--color-surface-interactive)] px-3 py-2">
                  {currentTrack.album?.images?.[0]?.url ? (
                    <Image
                      src={currentTrack.album.images[0].url}
                      alt={currentTrack.name}
                      width={160}
                      height={160}
                      className="h-10 w-10 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--color-surface-card)]">
                      <span className="text-xs font-bold text-[var(--color-text-tertiary)]">♪</span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-[var(--color-accent)]">
                      {currentTrack.name}
                    </p>
                    <p className="truncate text-[13px] text-[var(--color-text-secondary)]">
                      {currentTrack.artists?.map((a) => a.name).join(", ") || "Unknown Artist"}
                    </p>
                  </div>
                  {isPlaying ? (
                    <PauseIcon className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
                  ) : (
                    <PlayIcon className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
                  )}
                </div>
              </div>
            )}

            {/* Up Next */}
            <div>
              <p className="mb-2 text-[13px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Up Next
              </p>
              {loading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 animate-pulse">
                      <div className="h-10 w-10 rounded bg-[var(--color-surface-card)]" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 rounded bg-[var(--color-surface-card)] w-3/5" />
                        <div className="h-3 rounded bg-[var(--color-surface-card)] w-2/5" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : queue.length === 0 ? (
                <p className="py-8 text-center text-[15px] text-[var(--color-text-secondary)]">
                  No tracks in queue
                </p>
              ) : (
                <div className="space-y-0.5">
                  {queue.map((track, i) => (
                    <div
                      key={`${track.uri}-${i}`}
                      className="group flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-[var(--color-surface-interactive)] cursor-pointer"
                      onClick={() => handlePlay(track)}
                    >
                      {track.album?.images?.[0]?.url ? (
                        <Image
                          src={track.album.images[0].url}
                          alt={track.name}
                          width={160}
                          height={160}
                          className="h-10 w-10 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--color-surface-card)]">
                          <span className="text-xs font-bold text-[var(--color-text-tertiary)]">♪</span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-[var(--color-text-primary)]">
                          {track.name}
                        </p>
                        <p className="truncate text-[13px] text-[var(--color-text-secondary)]">
                          {track.artists?.map((a) => a.name).join(", ") || "Unknown Artist"}
                        </p>
                      </div>
                      <span className="tabular-nums text-[13px] text-[var(--color-text-tertiary)] shrink-0">
                        {formatDuration(track.duration_ms)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      <div
        role="button"
        tabIndex={0}
        className="md:hidden fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[var(--color-surface)] px-4 pb-12 pt-12 text-center text-[var(--color-text-primary)]"
        onClick={handleClose}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleClose(); }}
        aria-label="Close queue"
      >
        <div
          className="flex w-full max-w-md flex-col gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-vinyl-headline text-[var(--color-text-primary)]">
              Queue
            </h3>
            <button
              onClick={handleClose}
              className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
              aria-label="Close"
            >
              <CloseIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[60vh]">
            {currentTrack && (
              <div className="mb-4">
                <p className="mb-2 text-[13px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Now Playing
                </p>
                <div className="flex items-center gap-3 rounded-md bg-[var(--color-surface-interactive)] px-3 py-2">
                  {currentTrack.album?.images?.[0]?.url ? (
                    <Image
                      src={currentTrack.album.images[0].url}
                      alt={currentTrack.name}
                      width={160}
                      height={160}
                      className="h-10 w-10 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--color-surface-card)]">
                      <span className="text-xs font-bold text-[var(--color-text-tertiary)]">♪</span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-[15px] font-medium text-[var(--color-accent)]">
                      {currentTrack.name}
                    </p>
                    <p className="truncate text-[13px] text-[var(--color-text-secondary)]">
                      {currentTrack.artists?.map((a) => a.name).join(", ") || "Unknown Artist"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <p className="mb-2 text-[13px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Up Next
            </p>
            {queue.length === 0 ? (
              <p className="py-8 text-center text-[15px] text-[var(--color-text-secondary)]">
                No tracks in queue
              </p>
            ) : (
              <div className="space-y-0.5">
                {queue.map((track, i) => (
                  <div
                    key={`${track.uri}-${i}`}
                    className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-[var(--color-surface-interactive)]"
                    onClick={() => handlePlay(track)}
                  >
                    {track.album?.images?.[0]?.url ? (
                      <Image
                        src={track.album.images[0].url}
                        alt={track.name}
                        width={160}
                        height={160}
                        className="h-10 w-10 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--color-surface-card)]">
                        <span className="text-xs font-bold text-[var(--color-text-tertiary)]">♪</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-[15px] font-medium text-[var(--color-text-primary)]">
                        {track.name}
                      </p>
                      <p className="truncate text-[13px] text-[var(--color-text-secondary)]">
                        {track.artists?.map((a) => a.name).join(", ") || "Unknown Artist"}
                      </p>
                    </div>
                    <span className="tabular-nums text-[13px] text-[var(--color-text-tertiary)] shrink-0">
                      {formatDuration(track.duration_ms)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
