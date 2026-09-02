"use client";

import { useEffect } from "react";

type Props = {
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onMuteToggle: () => void;
  onSearchFocus: () => void;
};

export function useKeyboardShortcuts({
  onPlayPause,
  onNext,
  onPrevious,
  onMuteToggle,
  onSearchFocus,
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
          }
          break;

        case "ArrowLeft":
          if (e.shiftKey) {
            onPrevious();
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
  }, [onPlayPause, onNext, onPrevious, onMuteToggle, onSearchFocus]);
}
