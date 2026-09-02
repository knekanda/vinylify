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
};

export function useKeyboardShortcuts({
  onPlayPause,
  onNext,
  onPrevious,
  onMuteToggle,
  onSearchFocus,
  onSeek,
  onVolume,
}: Props) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        if (e.key === "Escape") {
          (e.target as HTMLElement).blur();
        }
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
  }, [onPlayPause, onNext, onPrevious, onMuteToggle, onSearchFocus, onSeek, onVolume]);
}
