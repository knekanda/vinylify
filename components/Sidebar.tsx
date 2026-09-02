"use client";

import {
  HomeIcon,
  LibraryIcon,
  SearchIcon,
  HeartIcon,
} from "./icons";
import type { SpotifyPlaylist } from "../types/spotify";
import Image from "next/image";

type Props = {
  connected: boolean;
  view: "home" | "search" | "playlist" | "artist" | "album" | "liked";
  playlists: SpotifyPlaylist[];
  onSelectView: (view: "home" | "search") => void;
  onSelectPlaylist: (playlist: SpotifyPlaylist) => void;
  onSelectLiked: () => void;
};

export default function Sidebar({
  connected,
  view,
  playlists,
  onSelectView,
  onSelectPlaylist,
  onSelectLiked,
}: Props) {
  return (
    <aside className="hidden md:flex w-[var(--sidebar-width)] shrink-0 flex-col gap-2 p-2 overflow-hidden">
      {/* Nav section */}
      <div className="rounded-lg bg-[var(--color-surface)] p-2">
        <button
          onClick={() => onSelectView("home")}
          className={`flex w-full items-center gap-4 rounded-md px-3 py-2 text-vinyl-label transition-colors duration-fast ${
            view === "home"
              ? "text-[var(--color-text-primary)]"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          <HomeIcon className="h-6 w-6 shrink-0" />
          <span>Home</span>
        </button>

        <button
          onClick={() => onSelectView("search")}
          className={`flex w-full items-center gap-4 rounded-md px-3 py-2 text-vinyl-label transition-colors duration-fast ${
            view === "search"
              ? "text-[var(--color-text-primary)]"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          <SearchIcon className="h-6 w-6 shrink-0" />
          <span>Search</span>
        </button>
      </div>

      {/* Library section */}
      <div className="flex flex-1 flex-col rounded-lg bg-[var(--color-surface)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 text-[var(--color-text-secondary)]">
            <LibraryIcon className="h-6 w-6 shrink-0" />
            <span className="text-vinyl-label">Your Library</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {connected && (
            <button
              onClick={onSelectLiked}
              className={`group flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors duration-fast hover:bg-[var(--color-surface-interactive)] ${
                view === "liked" ? "bg-[var(--color-surface-interactive)]" : ""
              }`}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[4px] bg-gradient-to-br from-[#450af5] via-[#1ed760] to-[#2997ff]">
                <HeartIcon className="h-5 w-5 fill-white" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-[var(--color-text-primary)]">
                  Liked Songs
                </p>
                <p className="truncate text-[13px] text-[var(--color-text-secondary)]">
                  Playlist · You
                </p>
              </div>
            </button>
          )}

          {connected && playlists.length > 0 ? (
            playlists.map((playlist, i) => {
              const cover = playlist.images?.[0]?.url;

              return (
                <button
                  key={playlist.id}
                  onClick={() => onSelectPlaylist(playlist)}
                  className="group flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors duration-fast hover:bg-[var(--color-surface-interactive)] animate-fade-in"
                  style={{ animationDelay: `${i * 20}ms` }}
                >
                  {cover ? (
                    <Image
                      src={cover}
                      alt={playlist.name}
                      width={160}
                      height={160}
                      className="h-12 w-12 shrink-0 rounded-[4px] object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[4px] bg-[var(--color-surface-card)]">
                      <span className="text-sm font-bold text-[var(--color-text-secondary)]">
                        {playlist.name.charAt(0)}
                      </span>
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-[var(--color-text-primary)]">
                      {playlist.name}
                    </p>
                    <p className="truncate text-[13px] text-[var(--color-text-secondary)]">
                      Playlist · {playlist.owner?.display_name || "You"}
                    </p>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="px-4 py-8 text-center">
              <p className="text-[13px] text-[var(--color-text-tertiary)]">
                {connected
                  ? "Create your first playlist"
                  : "Login to see your playlists"}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
