"use client";

import { useEffect } from "react";

type Props = {
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onMuteToggle: () => void;
  onSearchFocus: () => void;
  onSeek?: (deltaMs: number) => void;
  onVolume?: (delta: number) => void;
  onEscape?: () => void;
};

export function useKeyboardShortcuts({
  onPlayPause,
  onNext,
  onPrevious,
  onMuteToggle,
  onSearchFocus,
  onSeek,
  onVolume,
  onEscape,
}: Props) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        if (e.key === "Escape") {
          (target as HTMLElement).blur();
        }
        return;
      }

      // Close transient panels (now playing / queue) before falling through
      // to transport shortcuts.
      if (e.key === "Escape") {
        if (onEscape) {
          onEscape();
          return;
        }
      }

      // Let interactive elements handle Space natively (click) so we don't
      // double-fire toggle when a button is focused.
      if (
        e.key === " " &&
        target &&
        (target.closest("button, [role='button'], a, [contenteditable='true']"))
      ) {
        return;
      }

      switch (e.key) {
        case " ":
          e.preventDefault();
          onPlayPause();
          break;

        case "ArrowRight":
          if (e.shiftKey) {
            onNext();
          } else if (onSeek) {
            e.preventDefault();
            onSeek(10000);
          }
          break;

        case "ArrowLeft":
          if (e.shiftKey) {
            onPrevious();
          } else if (onSeek) {
            e.preventDefault();
            onSeek(-10000);
          }
          break;

        case "ArrowUp":
          if (onVolume) {
            e.preventDefault();
            onVolume(5);
          }
          break;

        case "ArrowDown":
          if (onVolume) {
            e.preventDefault();
            onVolume(-5);
          }
          break;

        case "m":
        case "M":
          onMuteToggle();
          break;

        case "/":
        case "k":
        case "K":
          e.preventDefault();
          onSearchFocus();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onPlayPause, onNext, onPrevious, onMuteToggle, onSearchFocus, onSeek, onVolume, onEscape]);
}
