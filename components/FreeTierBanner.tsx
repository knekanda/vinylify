"use client";

import { useState, useSyncExternalStore } from "react";
import { CloseIcon } from "./icons";
import type { SpotifyUser } from "../types/spotify";

const BANNER_KEY = "vinylify_hide_free_banner";

function readHidden(): boolean {
  try {
    return localStorage.getItem(BANNER_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeHidden(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function writeHidden(): void {
  try {
    localStorage.setItem(BANNER_KEY, "1");
  } catch {
    // storage unavailable — banner will reappear next load
  }
}

type Props = {
  user: SpotifyUser | null;
};

export default function FreeTierBanner({ user }: Props) {
  const [dismissedNow, setDismissedNow] = useState(false);
  const hiddenFromStorage = useSyncExternalStore(
    subscribeHidden,
    () => readHidden(),
    () => false
  );

  if (
    dismissedNow ||
    hiddenFromStorage ||
    !user ||
    user.product === "premium" ||
    user.product === undefined
  ) {
    return null;
  }

  return (
    <div className="mx-4 mb-1 flex items-center gap-3 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 py-2 text-[13px] text-[var(--color-text-secondary)]">
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-[var(--color-accent)]" aria-hidden="true">
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm-1-15h2v6h-2V7zm0 8h2v2h-2v-2z" />
      </svg>
      <span className="min-w-0 flex-1">
        Free account — in-app playback requires Spotify Premium. Press play to
        send music to your active Spotify device instead.
      </span>
      <button
        onClick={() => {
          setDismissedNow(true);
          writeHidden();
        }}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--color-text-tertiary)] transition-colors duration-fast hover:bg-[var(--color-surface-interactive)] hover:text-[var(--color-text-primary)]"
        aria-label="Dismiss free account notice"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}