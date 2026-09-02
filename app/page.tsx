"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import ContentGrid from "../components/ContentGrid";
import PlayerBar from "../components/PlayerBar";
import NowPlayingPanel from "../components/NowPlayingPanel";
import Image from "next/image";
import QueuePanel from "../components/QueuePanel";
import { useSpotifyPlayer } from "../hooks/useSpotifyPlayer";
import { useMediaSession } from "../hooks/useMediaSession";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import {
  fetchPlaylistTracks,
  fetchRecentlyPlayed,
  fetchTopArtists,
  fetchTopTracks,
  fetchUserPlaylists,
  fetchUserProfile,
  fetchPlaybackState,
  fetchAllLikedTracks,
  getArtistTopTracks,
  getAlbumTracks,
  getAlbum,
  playContext,
  playTrack,
  searchTracks,
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
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
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

  useKeyboardShortcuts({
    onPlayPause: handlePlayPause,
    onNext: handleNext,
    onPrevious: handlePrevious,
    onMuteToggle: handleMuteToggle,
    onSearchFocus: handleSearchFocus,
    onSeek: handleSeek,
    onVolume: handleVolumeDelta,
  });

  // Auth + data loading
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!localStorage.getItem("spotify_access_token")) return;

    let cancelled = false;

    void (async () => {
      setHomeStatus("loading");

      try {
        const profile = await fetchUserProfile();

        if (cancelled) return;

        setConnected(true);

        if (profile) setUser(profile);
        else {
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

        if (cancelled) return;

        setPlaylists(playlistItems);
        setTopArtists(artistItems);
        setTopTracks(trackItems);
        setRecent(recentItems);
        setHomeStatus("ready");
      } catch (error) {
        console.error("Failed to load Spotify data:", error);
        if (!cancelled) setHomeStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Connect SDK when authenticated
  useEffect(() => {
    if (connected && !sdk.playerReady) {
      sdk.connect();
    }
  }, [connected, sdk.playerReady, sdk.connect]);

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
      if (state?.repeat_state) setRepeat(state.repeat_state);
      if (state?.progress_ms !== undefined) setProgressMs(state.progress_ms);
      if (state?.item?.duration_ms) setDurationMs(state.item.duration_ms);
    }

    pollPlayback();
    const interval = setInterval(pollPlayback, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [connected, sdk.playerReady]);

  // Progress timer for non-SDK path
  useEffect(() => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }

    if (isPlaying && !sdk.playerReady) {
      progressInterval.current = setInterval(() => {
        setProgressMs((prev) => Math.min(prev + 250, durationMs));
      }, 250);
    }

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [isPlaying, durationMs, sdk.playerReady]);

  // Search debounced
  useEffect(() => {
    if (!connected || !searchQuery.trim() || view !== "search") return;

    const timer = setTimeout(async () => {
      setSearchResults(await searchTracks(searchQuery));
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, view, connected]);

  function showNotice(message: string) {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3500);
  }

  function handleSearchChange(query: string) {
    setSearchQuery(query);
    if (query.trim()) {
      setView("search");
    } else {
      setView("home");
    }
  }

  function handleBack() {
    setView("home");
    setSearchQuery("");
  }

  async function handleSelectPlaylist(playlist: SpotifyPlaylist) {
    setSelectedPlaylist(playlist);
    setView("playlist");
    const tracks = await fetchPlaylistTracks(playlist.id);
    setPlaylistTracks(tracks);
  }

  async function handlePlayTrack(track: SpotifyTrack) {
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
    }
  }

  async function handlePlayContext(contextUri: string) {
    const result = await playContext(contextUri);
    if (!result.ok && result.message) showNotice(result.message);
  }

  async function handleSelectArtist(artist: SpotifyArtist) {
    setSelectedArtist(artist);
    setView("artist");
    const tracks = await getArtistTopTracks(artist.id);
    setArtistTracks(tracks);
  }

  async function handleSelectAlbum(album: SpotifyAlbum) {
    setSelectedAlbum(album);
    setView("album");
    const tracks = await getAlbumTracks(album.id);
    const albumInfo = await getAlbum(album.id);
    if (albumInfo) {
      setAlbumTracks(
        tracks.map((t) => ({ ...t, album: albumInfo }))
      );
    } else {
      setAlbumTracks(tracks);
    }
  }

  async function handleSelectLiked() {
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
  }

  function handleRefreshLiked() {
    likedCacheRef.current = null;
    setLikedStatus("idle");
    likedLoadingRef.current = false;
    void handleSelectLiked();
  }

  const albumImageUrl = currentTrack?.album?.images?.[0]?.url;

  return (
    <div className="relative flex h-screen flex-col bg-[var(--color-bg)] text-[var(--color-text-primary)] overflow-hidden">
      {/* Dynamic Background */}
      <div className="dynamic-bg">
        {albumImageUrl ? (
          <Image
            key={albumImageUrl}
            src={albumImageUrl}
            alt=""
            width={1600}
            height={900}
            className="dynamic-bg-image"
            aria-hidden="true"
          />
        ) : (
          <div className="absolute inset-0 bg-[var(--color-surface)]" />
        )}
        <div className="dynamic-bg-overlay" />
      </div>

      {/* App Shell: Sidebar + Main + NowPlaying */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        <Sidebar
          connected={connected}
          view={view}
          playlists={playlists}
          onSelectView={(v) => {
            setView(v);
            setSearchQuery("");
          }}
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
              searchResults={searchResults}
              selectedArtist={selectedArtist}
              artistTracks={artistTracks}
              selectedAlbum={selectedAlbum}
              albumTracks={albumTracks}
              likedTracks={likedTracks}
              likedStatus={likedStatus}
              likedLoaded={likedLoaded}
              likedTotal={likedTotal}
              onRefreshLiked={handleRefreshLiked}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onSelectPlaylist={handleSelectPlaylist}
              onPlayTrack={handlePlayTrack}
              onPlayContext={handlePlayContext}
              onSelectArtist={handleSelectArtist}
              onSelectAlbum={handleSelectAlbum}
              onNotice={showNotice}
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
                onOpenQueue={() => {
                  setNowPlayingOpen(false);
                  setQueueOpen(true);
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
      </div>

      {/* Player Bar — fixed bottom */}
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
      />
    </div>
  );
}
