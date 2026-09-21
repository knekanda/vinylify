"use client";

import { memo, useState, useEffect, useRef } from "react";
import { loginWithSpotify, clearAuthState } from "../lib/spotify";
import Logo from "./Logo";
import {
  ArrowLeftIcon,
  CloseIcon,
  SearchIcon,
} from "./icons";
import type { SpotifyUser } from "../types/spotify";
import Image from "next/image";

type Props = {
  connected: boolean;
  user: SpotifyUser | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onBack: () => void;
};

const TopBar = memo(function TopBar({
  connected,
  user,
  searchQuery,
  onSearchChange,
  onBack,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showProfileMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showProfileMenu]);

  async function handleLogin() {
    setLoginError(null);
    const result = await loginWithSpotify();
    if (!result.ok && result.error) {
      setLoginError(result.error);
      setTimeout(() => setLoginError(null), 4000);
    }
  }

  function handleLogout() {
    clearAuthState();
    window.location.reload();
  }

  const avatar = user?.images?.[0]?.url;
  const displayName = user?.display_name || "Profile";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="flex items-center gap-3 px-4 py-3 md:px-6 shrink-0">
      <Logo className="hidden lg:flex shrink-0" />

      {/* Back button */}
      <button
        onClick={onBack}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] transition-colors duration-fast hover:bg-[var(--color-surface-interactive)] hover:text-[var(--color-text-primary)] active:scale-95 shrink-0"
        aria-label="Back"
      >
        <ArrowLeftIcon className="h-4 w-4" />
      </button>

      {/* Search pill */}
      <div
        className={`nav-pill flex h-10 flex-1 max-w-2xl items-center gap-3 rounded-full px-4 ${
          focused ? "" : ""
        }`}
      >
        <SearchIcon className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />

        <input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="What do you want to play?"
          className="w-full bg-transparent text-[15px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
        />

        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-interactive)] text-[var(--color-text-secondary)] transition-colors duration-fast hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)]"
            aria-label="Clear search"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center shrink-0">
        {connected ? (
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setShowProfileMenu((open) => !open)}
              className="flex items-center gap-2 rounded-full bg-[var(--color-surface-elevated)] p-1 pr-3 transition-colors duration-fast hover:bg-[var(--color-surface-interactive)]"
            >
              {avatar ? (
                <Image
                  src={avatar}
                  alt={displayName}
                  width={160}
                  height={160}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] text-[13px] font-bold text-[var(--color-text-on-accent)]">
                  {initial}
                </span>
              )}

              <span className="hidden max-w-32 truncate text-[14px] font-semibold text-[var(--color-text-primary)] md:block">
                {displayName}
              </span>
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-lg bg-[var(--color-surface-elevated)] p-2 shadow-xl border border-[var(--color-border)] animate-scale-in z-50">
                <div className="mb-2 border-b border-[var(--color-border-soft)] px-2 pb-2">
                  <p className="truncate text-[14px] font-semibold text-[var(--color-text-primary)]">
                    {displayName}
                  </p>
                  <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">
                    @{user?.id || ""}
                  </p>
                  <p className="mt-1 inline-block rounded-full bg-[var(--color-surface-interactive)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                    {user?.product === "premium" ? "Premium" : user?.product || "Free"}
                  </p>
                </div>

                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-[14px] text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-interactive)]"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                    <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
                  </svg>
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="relative">
            <button
              onClick={handleLogin}
              className="rounded-full bg-[var(--color-text-primary)] px-6 py-2 text-[14px] font-bold text-[var(--color-text-on-accent)] transition-all duration-fast hover:scale-105 hover:shadow-[0_4px_20px_rgba(255,255,255,0.15)] active:scale-95"
            >
              Connect Spotify
            </button>
            {loginError && (
              <div className="absolute top-full right-0 mt-2 whitespace-nowrap rounded-lg bg-[var(--color-danger)] px-4 py-2 text-[13px] font-medium text-white shadow-xl animate-slide-up z-50">
                {loginError}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
});

export default TopBar;
