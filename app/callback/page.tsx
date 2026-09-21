"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

let exchangePromise: Promise<boolean> | null = null;

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage full or blocked — silently continue
  }
}

function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // silently continue
  }
}

async function consumeAuthorizationCode(
  setStatus: (value: string) => void
): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);

  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");

  if (error) {
    setStatus(`Spotify authorization failed: ${error}`);
    return false;
  }

  if (!code || !state) {
    setStatus("Missing authorization information.");
    return false;
  }

  const savedState = safeGetItem("spotify_state");
  const codeVerifier = safeGetItem("spotify_code_verifier");

  if (!savedState || state !== savedState) {
    setStatus("Security check failed. Please try connecting again.");
    return false;
  }

  if (!codeVerifier) {
    setStatus("Missing PKCE code verifier. Please try connecting again.");
    return false;
  }

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 15000);

  try {
    const response = await fetch("/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
        redirect_uri: `${window.location.origin}/callback`,
      }),
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Spotify token exchange failed:", data);
      if (data.error === "invalid_grant") {
        setStatus(
          "This connection link has expired. Please try connecting again."
        );
      } else {
        setStatus(
          `Spotify error: ${data.error_description || data.error || "Unknown error"}`
        );
      }
      return false;
    }

    safeSetItem("spotify_access_token", data.access_token);

    if (data.expires_in) {
      safeSetItem(
        "spotify_token_expires_at",
        (Date.now() + data.expires_in * 1000).toString()
      );
    }

    if (data.refresh_token) {
      safeSetItem("spotify_refresh_token", data.refresh_token);
    }

    safeRemoveItem("spotify_state");
    safeRemoveItem("spotify_code_verifier");

    return true;
  } catch (error) {
    console.error(error);

    if (error instanceof DOMException && error.name === "AbortError") {
      setStatus("Connection timed out. Please check your network and try again.");
    } else {
      setStatus("Something went wrong connecting to Spotify.");
    }
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export default function CallbackPage() {
  const router = useRouter();

  const [status, setStatus] = useState("Connecting to Spotify...");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // Already authenticated — clean up PKCE artifacts and go home immediately.
    // No state update here: this view unmounts right away.
    if (safeGetItem("spotify_access_token")) {
      safeRemoveItem("spotify_state");
      safeRemoveItem("spotify_code_verifier");
      router.replace("/");
      return;
    }

    // If an exchange is already in flight (React StrictMode double-mount or
    // an HMR re-render), don't start a second one — wait for it and redirect
    // once it succeeds.
    if (!exchangePromise) {
      exchangePromise = Promise.resolve()
        .then(() => consumeAuthorizationCode(setStatus))
        .finally(() => {
          exchangePromise = null;
        });
    }

    exchangePromise.then((success) => {
      if (cancelled) return;
      if (success) {
        setStatus("Spotify connected!");
        setProgress(100);
        router.replace("/");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6">
      <div className="flex flex-col items-center gap-8">
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[#1DB954] shadow-[0_0_60px_rgba(29,185,84,0.3)]">
          <svg viewBox="0 0 24 24" fill="black" className="h-10 w-10">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#1DB954]" style={{ animationDuration: "1.5s" }} />
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {status}
          </h1>

          <p className="mt-3 text-sm text-[#a7a7a7]">
            Please wait...
          </p>
        </div>

        <div className="h-1 w-48 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#1DB954] transition-all duration-500 ease-out"
            style={{ width: status === "Spotify connected!" ? "100%" : status.includes("failed") || status.includes("error") || status.includes("wrong") ? "0%" : `${Math.min(progress, 90)}%` }}
          />
        </div>
      </div>
    </main>
  );
}