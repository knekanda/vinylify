"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-namespace */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getValidAccessToken,
  registerSdkControl,
  setActiveDeviceId,
  transferPlayback,
} from "../lib/spotify";
import type { SdkControlAdapter } from "../lib/spotify";
import type { SpotifyTrack } from "../types/spotify";

declare global {
  interface Window {
    Spotify: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume: number;
      }) => Spotify.Player;
    };
  }
}

namespace Spotify {
  export interface Player {
    connect(): Promise<boolean>;
    disconnect(): void;
    addListener(event: string, cb: (...args: any[]) => void): void;
    removeListener(event: string, cb: (...args: any[]) => void): void;
    getCurrentState(): Promise<any>;
    setName(name: string): Promise<void>;
    setVolume(volume: number): Promise<void>;
    getVolume(): Promise<number>;
    activateElement(): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    togglePlay(): Promise<void>;
    seek(position_ms: number): Promise<void>;
    previousTrack(): Promise<void>;
    nextTrack(): Promise<void>;
  }
}

let sdkScriptLoaded = false;

function loadSdkScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (sdkScriptLoaded && window.Spotify?.Player) {
      resolve();
      return;
    }

    if (document.getElementById("spotify-sdk")) {
      waitForSpotify(resolve);
      return;
    }

    const script = document.createElement("script");
    script.id = "spotify-sdk";
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;

    script.onload = () => {
      sdkScriptLoaded = true;
      waitForSpotify(resolve);
    };

    script.onerror = () => reject(new Error("Failed to load Spotify SDK"));

    document.body.appendChild(script);
  });
}

function waitForSpotify(resolve: () => void) {
  if (window.Spotify?.Player) {
    resolve();
    return;
  }
  const check = setInterval(() => {
    if (window.Spotify?.Player) {
      clearInterval(check);
      resolve();
    }
  }, 50);
  setTimeout(() => {
    clearInterval(check);
    resolve();
  }, 5000);
}

// Activate the SDK element (enables autoplay-safe transfer) and move the
// session to our player. The transfer can 404 right after `ready` because
// the device takes a moment to register server-side, so retry with backoff.
async function activateElementAndTransfer(
  player: Spotify.Player,
  deviceId: string
): Promise<void> {
  try {
    await player.activateElement();
  } catch {}

  const delays = [0, 500, 1200, 2500];
  for (const delayMs of delays) {
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    const result = await transferPlayback(deviceId);
    if (result.ok) return;
  }
}

type PlayerState = {
  track: SpotifyTrack | null;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
  shuffle: boolean;
  repeat: string;
  volume: number;
  muted: boolean;
  error: string | null;
};

type UseSpotifyPlayerReturn = {
  deviceId: string | null;
  playerReady: boolean;
  state: PlayerState;
  connect: () => Promise<void>;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
};

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 1000;

export function useSpotifyPlayer(): UseSpotifyPlayerReturn {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [state, setState] = useState<PlayerState>({
    track: null,
    isPlaying: false,
    progressMs: 0,
    durationMs: 0,
    shuffle: false,
    repeat: "off",
    volume: 0.7,
    muted: false,
    error: null,
  });

  const playerRef = useRef<Spotify.Player | null>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastStateUpdate = useRef<number>(0);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isConnecting = useRef(false);
  const prevVolumeRef = useRef<number | null>(null);
  const volumeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startProgressTimer = useCallback(() => {
    if (progressInterval.current) clearInterval(progressInterval.current);

    progressInterval.current = setInterval(() => {
      setState((prev) => {
        if (!prev.isPlaying) return prev;
        return {
          ...prev,
          progressMs: Math.min(prev.progressMs + 250, prev.durationMs),
        };
      });
    }, 250);
  }, []);

  const stopProgressTimer = useCallback(() => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
  }, []);

  const scheduleReconnectRef = useRef<() => void>(() => {});
  useEffect(() => {
    scheduleReconnectRef.current = () => {
    if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
      setState((prev) => ({
        ...prev,
        error: "Player disconnected. Please refresh the page.",
      }));
      return;
    }

    const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts.current);
    reconnectAttempts.current += 1;

    reconnectTimeout.current = setTimeout(() => {
      if (playerRef.current && !playerReady) {
        playerRef.current.connect().catch(() => {});
      }
    }, delay);
  };
  }, [playerReady, setState]);

  const scheduleReconnect = useCallback(() => {
    scheduleReconnectRef.current();
  }, []);

  const handlePlayerStateRef = useRef<(playerState: any) => void>(() => {});
  useEffect(() => {
    handlePlayerStateRef.current = (playerState: any) => {
    if (!playerState) {
      setState((prev) => ({ ...prev, isPlaying: false }));
      stopProgressTimer();
      return;
    }

    const track = playerState.track_window?.current_track || null;
    const isPlaying = !playerState.paused;
    const progressMs = playerState.position || 0;
    const durationMs = playerState.duration || 0;
    const shuffle = playerState.shuffle || false;
    const repeat =
      playerState.repeat_mode === 2
        ? "track"
        : playerState.repeat_mode === 1
          ? "context"
          : "off";

    const now = Date.now();
    const timeSinceLastUpdate = now - lastStateUpdate.current;

    if (timeSinceLastUpdate > 500 || track?.id !== state.track?.id) {
      lastStateUpdate.current = now;

      setState((prev) => ({
        track: track
          ? {
              id: track.id,
              name: track.name,
              artists: track.artists.map((a: any) => ({
                id: "",
                name: a.name,
              })),
              album: track.album
                ? {
                    id: track.album.uri,
                    name: track.album.name,
                    images: (track.album.images || []).map((img: any) => ({
                      url: img.url,
                      height: img.height || null,
                      width: img.width || null,
                    })),
                  }
                : undefined,
              duration_ms: durationMs,
              uri: track.uri,
              preview_url: null,
            }
          : null,
        isPlaying,
        progressMs,
        durationMs,
        shuffle,
        repeat,
        volume: prev.volume,
        muted: prev.muted,
        error: null,
      }));

      if (isPlaying) {
        startProgressTimer();
      } else {
        stopProgressTimer();
      }
    } else {
      setState((prev) => ({
        ...prev,
        isPlaying,
        progressMs,
        durationMs,
        shuffle,
        repeat,
      }));

      if (isPlaying && !progressInterval.current) {
        startProgressTimer();
      } else if (!isPlaying) {
        stopProgressTimer();
      }
    }
  };
  }, [state, setState, startProgressTimer, stopProgressTimer]);

  const handlePlayerState = useCallback(
    (playerState: any) => {
      handlePlayerStateRef.current(playerState);
    },
    []
  );

  const buildSdkAdapter = useCallback(
    (player: Spotify.Player): SdkControlAdapter => ({
      pause: () => player.pause(),
      resume: () => player.resume(),
      toggle: () => player.togglePlay(),
      next: () => player.nextTrack(),
      prev: () => player.previousTrack(),
      seek: (positionMs: number) => player.seek(positionMs),
      setVolume: (volumePercent: number) =>
        player.setVolume(Math.min(1, Math.max(0, volumePercent / 100))),
    }),
    []
  );

  const connect = useCallback(async () => {
    if (isConnecting.current) return;
    isConnecting.current = true;

    try {
      await loadSdkScript();

      if (playerRef.current) {
        try {
          playerRef.current.disconnect();
        } catch {}

        playerRef.current = null;
        setPlayerReady(false);
        setDeviceId(null);
      }

      registerSdkControl(null, null);

      const player = new window.Spotify.Player({
        name: "Vinylify Web Player",
        getOAuthToken: async (cb) => {
          try {
            const token = await getValidAccessToken();
            if (token) {
              cb(token);
            } else {
              console.warn("No valid Spotify token available for player");
            }
          } catch {
            console.warn("Failed to get token for Spotify player");
          }
        },
        volume: 0.7,
      });

      playerRef.current = player;

      // Some browsers block media started without a user gesture; the first
      // click (play buttons, etc.) unlocks autoplay for the SDK transfer.
      const handleGesture = () => {
        playerRef.current?.activateElement().catch(() => {});
        window.removeEventListener("pointerdown", handleGesture);
      };
      window.addEventListener("pointerdown", handleGesture);

      player.addListener(
        "ready",
        ({ device_id }: { device_id: string }) => {
          setDeviceId(device_id);
          setPlayerReady(true);
          reconnectAttempts.current = 0;
          isConnecting.current = false;

          // Make Vinylify's own player the active Spotify device and register
          // the instant in-browser transport path used by lib/spotify.
          setActiveDeviceId(device_id);
          registerSdkControl(buildSdkAdapter(player), device_id);

          void activateElementAndTransfer(player, device_id);
        }
      );

      player.addListener("player_state_changed", handlePlayerState);

      player.addListener(
        "initialization_error",
        ({ message }: { message: string }) => {
          console.error("Spotify SDK initialization error:", message);
          setState((prev) => ({
            ...prev,
            error: "Player initialization failed",
          }));
          isConnecting.current = false;
          scheduleReconnect();
        }
      );

      player.addListener(
        "authentication_error",
        ({ message }: { message: string }) => {
          console.error("Spotify SDK authentication error:", message);
          setPlayerReady(false);
          registerSdkControl(null, null);
          setState((prev) => ({
            ...prev,
            error: "Authentication expired. Please log in again.",
          }));
          isConnecting.current = false;
        }
      );

      player.addListener(
        "account_error",
        ({ message }: { message: string }) => {
          console.error("Spotify SDK account error:", message);
          setState((prev) => ({
            ...prev,
            error: "Spotify Premium is required for in-app playback",
          }));
          isConnecting.current = false;
        }
      );

      player.addListener(
        "playback_error",
        ({ message }: { message: string }) => {
          console.error("Spotify SDK playback error:", message);
          setState((prev) => ({
            ...prev,
            error: "Playback error. Retrying...",
          }));
          scheduleReconnect();
        }
      );

      player.addListener("autoplay_failed", () => {
        console.warn("Spotify SDK autoplay blocked by browser");
        setState((prev) => ({
          ...prev,
          error: "Autoplay blocked. Click play to start.",
        }));
      });

      await player.connect();
    } catch (err) {
      console.error("Failed to connect Spotify player:", err);
      isConnecting.current = false;
      scheduleReconnect();
    }
  }, [buildSdkAdapter, handlePlayerState, scheduleReconnect]);

  useEffect(() => {
    return () => {
      stopProgressTimer();
      registerSdkControl(null, null);

      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }

      if (playerRef.current) {
        try {
          playerRef.current.disconnect();
        } catch {}

        playerRef.current = null;
      }
    };
  }, [stopProgressTimer]);

  const applyVolumeToSDK = useCallback((v: number) => {
    playerRef.current?.setVolume(Math.min(1, Math.max(0, v))).catch(() => {});
  }, []);

  // Debounced volume: update UI immediately, flush the SDK call after a pause
  // so rapid slider input doesn't spam the SDK.
  const setVolume = useCallback(
    (v: number) => {
      setState((prev) => ({ ...prev, volume: v, muted: v === 0 }));
      if (volumeDebounceRef.current) {
        clearTimeout(volumeDebounceRef.current);
      }
      volumeDebounceRef.current = setTimeout(() => {
        applyVolumeToSDK(v);
        volumeDebounceRef.current = null;
      }, 250);
    },
    [applyVolumeToSDK]
  );

  const toggleMute = useCallback(() => {
    setState((prev) => {
      if (prev.muted) {
        // unmute -> restore previous volume
        const restore = prevVolumeRef.current ?? 0.7;
        applyVolumeToSDK(restore);
        prevVolumeRef.current = null;
        return { ...prev, volume: restore, muted: false };
      }
      // mute -> store current then go to 0
      prevVolumeRef.current = prev.volume > 0 ? prev.volume : 0.7;
      applyVolumeToSDK(0);
      return { ...prev, volume: 0, muted: true };
    });
  }, [applyVolumeToSDK]);

  useEffect(() => {
    return () => {
      if (volumeDebounceRef.current) {
        window.clearTimeout(volumeDebounceRef.current);
      }
    };
  }, []);

  return {
    deviceId,
    playerReady,
    state,
    connect,
    setVolume,
    toggleMute,
  };
}
