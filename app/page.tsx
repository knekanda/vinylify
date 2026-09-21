"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import ContentGrid from "../components/ContentGrid";
import FreeTierBanner from "../components/FreeTierBanner";
import PlayerBar from "../components/PlayerBar";
import NowPlayingPanel from "../components/NowPlayingPanel";
import Image from "next/image";
import QueuePanel from "../components/QueuePanel";
import { useSpotifyPlayer } from "../hooks/useSpotifyPlayer";
import { useMediaSession } from "../hooks/useMediaSession";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useSearch } from "../hooks/useSearch";
import { SavedTracksProvider } from "../hooks/SavedTracksContext";
import {
  fetchPlaylistTracks,
  fetchRecentlyPlayed,
  fetchTopArtists,
  fetchTopTracks,
  fetchUserPlaylists,
  fetchUserProfile,
  fetchPlaybackState,
  fetchAllLikedTracks,
  getAlbum,
  getAlbumTracks,
  getArtistTopTracks,
  getTrack,
  hasAccessToken,
  normalizeEntityId,
  playContext,
  playTrack,
} from "../lib/spotify";
import type {
  SpotifyAlbum,
  SpotifyArtist,
  SpotifyPlaylist,
  SpotifyTrack,
  SpotifyUser,
} from "../types/spotify";

type View = "home" | "search" | "playlist" | "artist" | "album" | "liked";

export default function Home() {
  const [connected, setConnected] = useState(false);
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [topArtists, setTopArtists] = useState<SpotifyArtist[]>([]);
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [recent, setRecent] = useState<SpotifyTrack[]>([]);

  const [homeStatus, setHomeStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const [view, setView] = useState<View>("home");
  const [searchQuery, setSearchQuery] = useState("");
  const search = useSearch<SpotifyTrack[]>();
  const [selectedPlaylist, setSelectedPlaylist] =
    useState<SpotifyPlaylist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<SpotifyTrack[]>([]);

  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState("off");
  const [progressMs, setProgressMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Artist view
  const [selectedArtist, setSelectedArtist] = useState<SpotifyArtist | null>(null);
  const [artistTracks, setArtistTracks] = useState<SpotifyTrack[]>([]);

  // Album view
  const [selectedAlbum, setSelectedAlbum] = useState<SpotifyAlbum | null>(null);
  const [albumTracks, setAlbumTracks] = useState<SpotifyTrack[]>([]);

  // Liked Songs view
  const [likedTracks, setLikedTracks] = useState<SpotifyTrack[]>([]);
  const [likedStatus, setLikedStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [likedLoaded, setLikedLoaded] = useState(0);
  const [likedTotal, setLikedTotal] = useState(0);
  const likedCacheRef = useRef<{ tracks: SpotifyTrack[]; total: number } | null>(null);
  const likedLoadingRef = useRef(false);
  const noticeTimer = useRef<number | null>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const sdk = useSpotifyPlayer();
  const sdkConnect = sdk.connect;
  const sdkPlayerReady = sdk.playerReady;

  // Media Session — OS-level media controls
  const handlePlayPause = useCallback(async () => {
    if (!currentTrack) return;

    if (isPlaying) {
      const { pause } = await import("../lib/spotify");
      await pause();
    } else {
      const { resume } = await import("../lib/spotify");
      await resume();
    }

    setIsPlaying(!isPlaying);
  }, [isPlaying, currentTrack]);

  const handleNext = useCallback(async () => {
    const { next } = await import("../lib/spotify");
    await next();
  }, []);

  const handlePrevious = useCallback(async () => {
    const { prev } = await import("../lib/spotify");
    await prev();
  }, []);

  const handleMuteToggle = useCallback(() => {
    sdk.toggleMute();
  }, [sdk]);

  const handleSeek = useCallback(
    (deltaMs: number) => {
      void (async () => {
        const { seekTo } = await import("../lib/spotify");
        const target = Math.max(0, Math.min(durationMs || 0, progressMs + deltaMs));
        const result = await seekTo(target);
        if (result.ok) setProgressMs(target);
      })();
    },
    [durationMs, progressMs]
  );

  const handleVolumeDelta = useCallback(
    (delta: number) => {
      const next = Math.max(0, Math.min(100, sdk.state.volume * 100 + delta));
      sdk.setVolume(next);
    },
    [sdk]
  );

  const handleSearchFocus = useCallback(() => {
    const input = document.querySelector<HTMLInputElement>(
      'input[placeholder="What do you want to play?"]'
    );
    input?.focus();
  }, []);

  useMediaSession({
    track: currentTrack,
    isPlaying,
    onPlayPause: handlePlayPause,
    onNext: handleNext,
    onPrevious: handlePrevious,
  });

  // Escape dismisses any open side panels first.
  const handleEscape = useCallback(() => {
    if (nowPlayingOpen) {
      setNowPlayingOpen(false);
      return;
    }
    if (queueOpen) {
      setQueueOpen(false);
    }
  }, [nowPlayingOpen, queueOpen]);

  useKeyboardShortcuts({
    onPlayPause: handlePlayPause,
    onNext: handleNext,
    onPrevious: handlePrevious,
    onMuteToggle: handleMuteToggle,
    onSearchFocus: handleSearchFocus,
    onSeek: handleSeek,
    onVolume: handleVolumeDelta,
    onEscape: handleEscape,
  });

  // Auth + data loading
  const mountedRef = useRef(true);
  const loadHome = useCallback(async () => {
    if (!hasAccessToken()) return;

    setHomeStatus("loading");

    try {
      const profile = await fetchUserProfile();

      if (!mountedRef.current) return;

      if (profile) {
        setUser(profile);
        setConnected(true);
      } else {
        // Token present but Spotify rejected it — surface a recovery path
        // (the hero/Connect state) instead of a stuck connected screen.
        setHomeStatus("error");
        return;
      }

      const [playlistItems, artistItems, trackItems, recentItems] =
        await Promise.all([
          fetchUserPlaylists(),
          fetchTopArtists(),
          fetchTopTracks(),
          fetchRecentlyPlayed(),
        ]);

      if (!mountedRef.current) return;

      setPlaylists(playlistItems);
      setTopArtists(artistItems);
      setTopTracks(trackItems);
      setRecent(recentItems);
      setHomeStatus("ready");
    } catch (error) {
      console.error("Failed to load Spotify data:", error);
      if (mountedRef.current) setHomeStatus("error");
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (typeof window !== "undefined" && hasAccessToken()) {
      queueMicrotask(() => void loadHome());
    }
    return () => {
      mountedRef.current = false;
    };
  }, [loadHome]);

  // Connect SDK when authenticated. In-app playback requires a Premium
  // account; non-Premium users use the active-device REST path instead.
  useEffect(() => {
    if (connected && user?.product !== "premium") return;
    if (connected && !sdkPlayerReady) {
      sdkConnect();
    }
  }, [connected, user?.product, sdkPlayerReady, sdkConnect]);

  // Sync SDK state to page state
  useEffect(() => {
    if (!(sdk.playerReady && sdk.state.track)) return;
    const s = sdk.state;
    queueMicrotask(() => {
      setCurrentTrack(s.track);
      setIsPlaying(s.isPlaying);
      setShuffle(s.shuffle);
      setRepeat(s.repeat);
      setProgressMs(s.progressMs);
      setDurationMs(s.durationMs);
    });
  }, [sdk.playerReady, sdk.state]);

  // The Web SDK exposes artists only with empty ids and album ids as URIs.
  // Fetch the real REST track so artist/album click-through navigation works
  // even while playback is SDK-driven.
  useEffect(() => {
    const track = sdk.state.track;
    if (!(sdk.playerReady && track?.id)) return;

    let cancelled = false;

    void getTrack(track.id)
      .then((full) => {
        if (!cancelled && full && full.id === track.id) {
          setCurrentTrack((prev) =>
            prev && prev.id === full.id
              ? { ...prev, artists: full.artists, album: full.album }
              : prev
          );
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdk.playerReady, sdk.state.track?.id]);

  // API polling fallback (non-SDK)
  useEffect(() => {
    if (!connected || sdk.playerReady) return;

    let cancelled = false;

    async function pollPlayback() {
      const state = await fetchPlaybackState();
      if (cancelled) return;

      if (state?.item) {
        setCurrentTrack(state.item);
      }
      setIsPlaying(Boolean(state?.is_playing));
      if (state?.shuffle_state !== undefined) setShuffle(state.shuffle_state);
      if (state?.repeat_state !== undefined) setRepeat(state.repeat_state);
      if (state?.progress_ms !== undefined) setProgressMs(state.progress_ms);
      if (state?.item?.duration_ms) setDurationMs(state.item.duration_ms);
      if (state?.device?.volume_percent !== undefined) {
        sdk.syncVolume(state.device.volume_percent);
      }
    }

    pollPlayback();
    const interval = setInterval(pollPlayback, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, sdk.playerReady]);

  // Progress timer for non-SDK path
  useEffect(() => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }

    if (isPlaying && !sdk.playerReady) {
      progressInterval.current = setInterval(() => {
        setProgressMs((prev) => Math.min(prev + 1000, durationMs));
      }, 1000);
    }

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [isPlaying, durationMs, sdk.playerReady]);

  // Search debounced (aborts in-flight requests so a slow old query can never
  // overwrite a newer one).
  const runSearch = search.run;
  const cancelSearch = search.cancel;

  useEffect(() => {
    if (!connected || view !== "search" || !searchQuery.trim()) return;

    const timer = setTimeout(() => {
      runSearch(searchQuery);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, view, connected, runSearch, cancelSearch]);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3500);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      setView("search");
    } else {
      setView("home");
    }
  }, []);

  const handleBack = useCallback(() => {
    setView("home");
    setSearchQuery("");
  }, []);

  const handleSelectView = useCallback((v: View) => {
    setView(v);
    setSearchQuery("");
  }, []);

  const handleSelectPlaylist = useCallback(async (playlist: SpotifyPlaylist) => {
    setSelectedPlaylist(playlist);
    setView("playlist");
    const tracks = await fetchPlaylistTracks(playlist.id);
    setPlaylistTracks(tracks);
  }, []);

  const handlePlayTrack = useCallback(
    async (track: SpotifyTrack) => {
      setCurrentTrack(track);
      setIsPlaying(true);

      const result = await playTrack(track.uri);
      if (!result.ok) {
        showNotice(result.message || "Could not start playback");
        // Only revert the optimistic state if nothing is actually playing.
        const live = await fetchPlaybackState();
        if (!live?.item) {
          setCurrentTrack(null);
          setIsPlaying(false);
        }
      } else if (user && user.product !== "premium") {
        showNotice("Playing on your active Spotify device (in-app playback requires Premium)");
      }
    },
    [user, showNotice]
  );

  const handlePlayContext = useCallback(
    async (contextUri: string) => {
      const result = await playContext(contextUri);
      if (!result.ok && result.message) {
        showNotice(result.message);
      } else if (result.ok && user && user.product !== "premium") {
        showNotice("Playing on your active Spotify device (in-app playback requires Premium)");
      }
    },
    [user, showNotice]
  );

  const handleSelectArtist = useCallback(async (artist: SpotifyArtist) => {
    const artistId = normalizeEntityId(artist.id);
    if (!artistId) {
      showNotice("Could not open this artist");
      return;
    }
    setSelectedArtist(artist);
    setView("artist");
    const tracks = await getArtistTopTracks(artistId);
    setArtistTracks(tracks);
  }, [showNotice]);

  const handleSelectAlbum = useCallback(async (album: SpotifyAlbum) => {
    const albumId = normalizeEntityId(album.id);
    if (!albumId) {
      showNotice("Could not open this album");
      return;
    }
    setSelectedAlbum(album);
    setView("album");
    const tracks = await getAlbumTracks(albumId);
    const albumInfo = await getAlbum(albumId);
    // Enrich the hero with the full album object (release date, cover, etc.) —
    // the object we clicked is the simplified one attached to a track.
    if (albumInfo) {
      setSelectedAlbum((prev) => ({ ...(prev || {}), ...albumInfo }));
    }
    setAlbumTracks(
      albumInfo
        ? tracks.map((t) => ({ ...t, album: albumInfo }))
        : tracks
    );
  }, [showNotice]);

  const handleSelectLiked = useCallback(async () => {
    setView("liked");

    if (likedCacheRef.current) {
      setLikedTracks(likedCacheRef.current.tracks);
      setLikedTotal(likedCacheRef.current.total);
      setLikedLoaded(likedCacheRef.current.tracks.length);
      setLikedStatus("ready");
      return;
    }

    if (likedLoadingRef.current) return;
    likedLoadingRef.current = true;

    setLikedStatus("loading");
    setLikedTracks([]);
    setLikedLoaded(0);
    setLikedTotal(0);

    const result = await fetchAllLikedTracks({
      onProgress: (loaded, total) => {
        setLikedLoaded(loaded);
        setLikedTotal(total);
      },
      onPage: (pageItems) => {
        setLikedTracks((prev) => [...prev, ...pageItems]);
      },
    });

    likedLoadingRef.current = false;
    likedCacheRef.current = result;
    setLikedTracks(result.tracks);
    setLikedTotal(result.total);
    setLikedLoaded(result.tracks.length);
    setLikedStatus("ready");
  }, []);

  const handleRefreshLiked = useCallback(() => {
    likedCacheRef.current = null;
    setLikedStatus("idle");
    likedLoadingRef.current = false;
    void handleSelectLiked();
  }, [handleSelectLiked]);

  const handleRemoveLikedTrack = useCallback((trackId: string) => {
    setLikedTracks((prev) => prev.filter((t) => t.id !== trackId));
    setLikedTotal((prev) => Math.max(0, prev - 1));
    if (likedCacheRef.current) {
      likedCacheRef.current = {
        tracks: likedCacheRef.current.tracks.filter((t) => t.id !== trackId),
        total: Math.max(0, likedCacheRef.current.total - 1),
      };
    }
  }, []);

  const albumImageUrl = currentTrack?.album?.images?.[0]?.url;

  return (
    <SavedTracksProvider>
      <div className="relative flex h-screen flex-col bg-[var(--color-bg)] text-[var(--color-text-primary)] overflow-hidden">
      {/* Dynamic Background */}
      <div className="dynamic-bg" aria-hidden="true">
        {albumImageUrl ? (
          <Image
            key={albumImageUrl}
            src={albumImageUrl}
            alt=""
            width={480}
            height={480}
            className="dynamic-bg-image"
            aria-hidden="true"
          />
        ) : (
          <div className="absolute inset-0 bg-[var(--color-surface)]" />
        )}
        <div className="dynamic-bg-overlay" />
      </div>

      {/* App Shell: Sidebar + Main + NowPlaying */}
      <main className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <Sidebar
          connected={connected}
          view={view}
          playlists={playlists}
          activePlaylistId={
            view === "playlist" ? selectedPlaylist?.id ?? null : null
          }
          onSelectView={handleSelectView}
          onSelectPlaylist={handleSelectPlaylist}
          onSelectLiked={handleSelectLiked}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top Bar spans main content */}
          <TopBar
            connected={connected}
            user={user}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onBack={handleBack}
          />

          {connected && user && user.product !== "premium" && (
            <FreeTierBanner user={user} />
          )}

          {/* Content area */}
          <div className="flex min-h-0 flex-1">
            <ContentGrid
              connected={connected}
              homeStatus={homeStatus}
              user={user}
              view={view}
              searchQuery={searchQuery}
              playlists={playlists}
              topArtists={topArtists}
              topTracks={topTracks}
              recent={recent}
              selectedPlaylist={selectedPlaylist}
              playlistTracks={playlistTracks}
              searchResults={search.data ?? []}
              searchLoading={search.loading}
              selectedArtist={selectedArtist}
              artistTracks={artistTracks}
              selectedAlbum={selectedAlbum}
              albumTracks={albumTracks}
              likedTracks={likedTracks}
              likedStatus={likedStatus}
              likedLoaded={likedLoaded}
              likedTotal={likedTotal}
              onRefreshLiked={handleRefreshLiked}
              onRemoveLikedTrack={handleRemoveLikedTrack}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onSelectPlaylist={handleSelectPlaylist}
              onPlayTrack={handlePlayTrack}
              onPlayContext={handlePlayContext}
              onSelectArtist={handleSelectArtist}
              onSelectAlbum={handleSelectAlbum}
              onNotice={showNotice}
              onRetryHome={loadHome}
            />

            {nowPlayingOpen && (
              <NowPlayingPanel
                track={currentTrack}
                isPlaying={isPlaying}
                progressMs={progressMs}
                durationMs={durationMs}
                shuffle={shuffle}
                repeat={repeat}
                onClose={() => setNowPlayingOpen(false)}
                onNotice={showNotice}
                onSelectArtist={(artist) => {
                  setNowPlayingOpen(false);
                  void handleSelectArtist(artist);
                }}
                onSelectAlbum={(album) => {
                  setNowPlayingOpen(false);
                  void handleSelectAlbum(album);
                }}
              />
            )}

            {queueOpen && (
              <QueuePanel
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onClose={() => setQueueOpen(false)}
              />
            )}
          </div>
        </div>
      </main>

      {/* Player Bar — fixed bottom */}
      <footer>
        <PlayerBar
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        shuffle={shuffle}
        repeat={repeat}
        progressMs={progressMs}
        durationMs={durationMs}
        nowPlayingOpen={nowPlayingOpen}
        queueOpen={queueOpen}
        onToggleNowPlaying={() => setNowPlayingOpen((open) => !open)}
        onToggleQueue={() => setQueueOpen((open) => !open)}
        notice={notice}
        showNotice={showNotice}
        volume={Math.round((sdk.state.volume ?? 0.7) * 100)}
        muted={sdk.state.muted}
        onVolumeChange={(v) => sdk.setVolume(v / 100)}
        onMuteToggle={() => sdk.toggleMute()}
        onSelectArtist={handleSelectArtist}
        onSelectAlbum={handleSelectAlbum}
      />
      </footer>
      </div>
    </SavedTracksProvider>
  );
}
