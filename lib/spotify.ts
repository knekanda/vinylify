import type {
  SpotifyAlbum,
  SpotifyArtist,
  SpotifyDevice,
  SpotifyPlaylist,
  SpotifyTrack,
  SpotifyUser,
  PlaybackState,
  QueueResponse,
  SearchResults,
  ArtistTopTracks,
} from "../types/spotify";

// ─── Active Device + SDK fast-path ─────────────────────────────
// Vinylify registers its Web Playback SDK player as the active device so all
// control commands target it (instead of whatever device Spotify last used,
// e.g. the desktop app). When the SDK is connected we bypass the REST API for
// transport commands for instant response.

export type SdkControlAdapter = {
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  toggle: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  setVolume: (volumePercent: number) => Promise<void>;
};

let activeDeviceId: string | null = null;
let sdkControl: SdkControlAdapter | null = null;
let sdkDeviceId: string | null = null;

export function getActiveDeviceId(): string | null {
  return activeDeviceId;
}

export function setActiveDeviceId(id: string | null): void {
  activeDeviceId = id;
}

export function registerSdkControl(
  adapter: SdkControlAdapter | null,
  deviceId: string | null
): void {
  sdkControl = adapter;
  sdkDeviceId = adapter ? deviceId : null;
}

function sdkCanControl(): boolean {
  return Boolean(sdkControl && activeDeviceId === sdkDeviceId);
}

export function getSdkDeviceId(): string | null {
  return sdkDeviceId;
}

function deviceParam(): string {
  return activeDeviceId
    ? `device_id=${encodeURIComponent(activeDeviceId)}`
    : "";
}

function withDeviceQuery(path: string, existingQuery?: string): string {
  const dev = deviceParam();
  if (!dev) {
    return existingQuery ? `${path}?${existingQuery}` : path;
  }
  return `${path}?${existingQuery ? `${existingQuery}&` : ""}${dev}`;
}

function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage full or blocked — silently continue
  }
}

function safeRemoveItem(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // silently continue
  }
}

export function clearAuthState(): void {
  safeRemoveItem("spotify_access_token");
  safeRemoveItem("spotify_refresh_token");
  safeRemoveItem("spotify_token_expires_at");
  safeRemoveItem("spotify_state");
  safeRemoveItem("spotify_code_verifier");
}

function getAccessToken(): string | null {
  return safeGetItem("spotify_access_token");
}

export function hasAccessToken(): boolean {
  return Boolean(safeGetItem("spotify_access_token"));
}

async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = safeGetItem("spotify_refresh_token");
  if (!refreshToken) return null;

  try {
    const response = await fetch("/api/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    const data = await response.json();

    if (data.access_token) {
      safeSetItem("spotify_access_token", data.access_token);

      if (data.expires_in) {
        const newExpiresAt = Date.now() + data.expires_in * 1000;
        safeSetItem("spotify_token_expires_at", newExpiresAt.toString());
      }

      return data.access_token;
    }
  } catch {
    return null;
  }

  return null;
}

export async function getValidAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const token = getAccessToken();
  const expiresAt = safeGetItem("spotify_token_expires_at");

  if (token) {
    const now = Date.now();
    const expiry = expiresAt ? parseInt(expiresAt, 10) : NaN;

    if (Number.isNaN(expiry) || now < expiry - 60_000) {
      return token;
    }
  }

  return tryRefreshToken();
}

export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getValidAccessToken();

  if (!token) {
    throw new Error("Not authenticated");
  }

  const makeRequest = (t: string) =>
    fetch(`https://api.spotify.com/v1${endpoint}`, {
      ...options,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

  let response = await makeRequest(token);

  // Spotify reports 401 with a token we shouldn't have. Force a refresh and
  // retry once — transparently recovering from silently-expired sessions
  // instead of dumping the user into an error screen.
  if (response.status === 401) {
    safeRemoveItem("spotify_access_token");
    safeRemoveItem("spotify_token_expires_at");
    const fresh = await tryRefreshToken();
    if (fresh) {
      response = await makeRequest(fresh);
    } else {
      clearAuthState();
      throw new Error("Spotify API error: 401");
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message && error.message !== "Not authenticated") {
    return error.message.replace(/^Spotify API error: \d+\s*/, "").trim() || fallback;
  }
  return fallback;
}

// ─── Pagination ────────────────────────────────────────────────
// Spotify caps most list endpoints (Saved Tracks 50, playlist/album tracks
// 100/50). This loops through every page sequentially so nothing is silently
// truncated, streaming each page to the caller as it arrives.

type PaginateOptions<T> = {
  limit: number;
  buildUrl: (offset: number) => string;
  mapItem: (raw: unknown) => T;
  onProgress?: (loaded: number, total: number) => void;
  onPage?: (pageItems: T[]) => void;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function paginateAll<T>(
  options: PaginateOptions<T>
): Promise<{ items: T[]; total: number }> {
  const { limit, buildUrl, mapItem, onProgress, onPage } = options;
  const items: T[] = [];
  let offset = 0;
  let total = 0;
  let hasMore = true;

  while (hasMore) {
    let data: { items: unknown[]; total?: number };
    try {
      data = await apiFetch<{ items: unknown[]; total?: number }>(buildUrl(offset));
    } catch (error) {
      const isRateLimited = error instanceof Error && error.message.includes("429");
      if (isRateLimited) {
        await delay(350);
        try {
          data = await apiFetch<{ items: unknown[]; total?: number }>(buildUrl(offset));
        } catch {
          break;
        }
      } else {
        break;
      }
    }

    if (!data) break;

    total = data.total ?? total;
    const pageItems = (data.items || []).map(mapItem);
    items.push(...pageItems);
    onPage?.(pageItems);
    onProgress?.(items.length, total);

    offset += limit;
    hasMore = pageItems.length === limit && items.length < total;
  }

  return { items, total };
}

// ─── User ───────────────────────────────────────────────────────

export async function fetchUserProfile(): Promise<SpotifyUser | null> {
  try {
    return await apiFetch<SpotifyUser>("/me");
  } catch {
    return null;
  }
}

// ─── Playlists ─────────────────────────────────────────────────

export async function fetchUserPlaylists(): Promise<SpotifyPlaylist[]> {
  try {
    const { items } = await paginateAll<SpotifyPlaylist>({
      limit: 50,
      buildUrl: (offset) => `/me/playlists?limit=50&offset=${offset}`,
      mapItem: (item) => item as SpotifyPlaylist,
    });
    return items;
  } catch {
    return [];
  }
}

export async function fetchPlaylistTracks(
  playlistId: string
): Promise<SpotifyTrack[]> {
  try {
    const { items } = await paginateAll<SpotifyTrack | null>({
      limit: 100,
      buildUrl: (offset) =>
        `/playlists/${playlistId}/tracks?limit=100&offset=${offset}`,
      mapItem: (item) => (item as { track: SpotifyTrack | null }).track,
    });
    return items.filter((t): t is SpotifyTrack => t !== null);
  } catch {
    return [];
  }
}

// ─── Top Items ─────────────────────────────────────────────────

export async function fetchTopArtists(): Promise<SpotifyArtist[]> {
  try {
    const data = await apiFetch<{ items: SpotifyArtist[] }>(
      "/me/top/artists?limit=6&time_range=short_term"
    );
    return data.items;
  } catch {
    return [];
  }
}

export async function fetchTopTracks(): Promise<SpotifyTrack[]> {
  try {
    const data = await apiFetch<{ items: SpotifyTrack[] }>(
      "/me/top/tracks?limit=5&time_range=short_term"
    );
    return data.items;
  } catch {
    return [];
  }
}

// ─── Recently Played ──────────────────────────────────────────

export async function fetchRecentlyPlayed(): Promise<SpotifyTrack[]> {
  try {
    const data = await apiFetch<{
      items: { track: SpotifyTrack }[];
    }>("/me/player/recently-played?limit=5");

    return data.items.map((item) => item.track);
  } catch {
    return [];
  }
}

// ─── Search ───────────────────────────────────────────────────

export async function searchTracks(
  query: string,
  signal?: AbortSignal
): Promise<SpotifyTrack[]> {
  try {
    const data = await apiFetch<SearchResults>(
      `/search?q=${encodeURIComponent(query)}&type=track&limit=50`,
      signal ? { signal } : {}
    );
    return data.tracks?.items || [];
  } catch {
    return [];
  }
}

export async function searchMultiType(
  query: string,
  types: string[] = ["track", "artist", "playlist"],
  limit: number = 10
): Promise<SearchResults> {
  try {
    const typeStr = types.join(",");
    return await apiFetch<SearchResults>(
      `/search?q=${encodeURIComponent(query)}&type=${typeStr}&limit=${limit}`
    );
  } catch {
    return {};
  }
}

// ─── Playback ─────────────────────────────────────────────────

export async function fetchPlaybackState(): Promise<PlaybackState | null> {
  try {
    return await apiFetch<PlaybackState>("/me/player");
  } catch {
    return null;
  }
}

export async function fetchCurrentlyPlaying(): Promise<PlaybackState | null> {
  try {
    return await apiFetch<PlaybackState>("/me/player/currently-playing");
  } catch {
    return null;
  }
}

function playbackErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const code = message.replace("Spotify API error: ", "").trim();

  switch (code) {
    case "404":
      return "No active playback device was found. Try playing something in Spotify first, then press play again.";
    case "403":
      return "Spotify Premium is required for playback.";
    case "429":
      return "Spotify is rate-limiting requests. Try again in a moment.";
    case "401":
      return "Your session expired. Please log in again.";
    default:
      return errorMessage(error, "Could not start playback.");
  }
}

function is404(error: unknown): boolean {
  return error instanceof Error && error.message.includes("404");
}

async function tryStartPlayback(
  body: Record<string, unknown>,
  deviceId?: string
): Promise<boolean> {
  const path = deviceId
    ? `/me/player/play?device_id=${encodeURIComponent(deviceId)}`
    : "/me/player/play";
  try {
    await apiFetch(path, { method: "PUT", body: JSON.stringify(body) });
    return true;
  } catch {
    return false;
  }
}

async function activateDeviceAndRetry(
  body: Record<string, unknown>
): Promise<{ ok: boolean; message?: string }> {
  // 1) If the SDK player is connected, re-transfer to it (may need a moment
  //    to register server-side after the initial transfer).
  const sdkId = getSdkDeviceId();
  if (sdkId && activeDeviceId !== sdkId) {
    await delay(500);
    const transferred = await transferPlayback(sdkId);
    if (transferred.ok) {
      if (await tryStartPlayback(body, sdkId)) return { ok: true };
    }
  }

  // 2) Try without specifying a device — lets Spotify pick whatever is active.
  if (await tryStartPlayback(body)) return { ok: true };

  // 3) List available devices and try the first one.
  const devices = await getAvailableDevices();
  for (const dev of devices) {
    if (dev.id) {
      await transferPlayback(dev.id);
      if (await tryStartPlayback(body, dev.id)) return { ok: true };
    }
  }

  return { ok: false, message: playbackErrorMessage(new Error("Spotify API error: 404")) };
}

async function startPlayback(
  body: Record<string, unknown>
): Promise<{ ok: boolean; message?: string }> {
  // First attempt: play on the known active device.
  if (deviceParam()) {
    try {
      await apiFetch(`/me/player/play?${deviceParam()}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      return { ok: true };
    } catch (error) {
      if (is404(error)) return activateDeviceAndRetry(body);
      return { ok: false, message: playbackErrorMessage(error) };
    }
  }

  // No known device — try directly.
  try {
    await apiFetch("/me/player/play", {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return { ok: true };
  } catch (error) {
    if (is404(error)) return activateDeviceAndRetry(body);
    return { ok: false, message: playbackErrorMessage(error) };
  }
}

export async function playTrack(
  trackUri: string
): Promise<{ ok: boolean; message?: string }> {
  return startPlayback({ uris: [trackUri] });
}

export async function playContext(
  contextUri: string
): Promise<{ ok: boolean; message?: string }> {
  return startPlayback({ context_uri: contextUri });
}

export async function pause(): Promise<{ ok: boolean; message?: string }> {
  if (sdkCanControl()) {
    try {
      await sdkControl!.pause();
      return { ok: true };
    } catch {
      // fall through to the Web API
    }
  }

  try {
    await apiFetch(withDeviceQuery("/me/player/pause"), { method: "PUT" });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: errorMessage(error, "Could not pause playback") };
  }
}

export async function resume(): Promise<{ ok: boolean; message?: string }> {
  if (sdkCanControl()) {
    try {
      await sdkControl!.resume();
      return { ok: true };
    } catch {
      // fall through to the Web API
    }
  }

  return startPlayback({});
}

export async function next(): Promise<{ ok: boolean; message?: string }> {
  if (sdkCanControl()) {
    try {
      await sdkControl!.next();
      return { ok: true };
    } catch {
      // fall through to the Web API
    }
  }

  try {
    await apiFetch(withDeviceQuery("/me/player/next"), { method: "POST" });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: errorMessage(error, "Could not skip to next track") };
  }
}

export async function prev(): Promise<{ ok: boolean; message?: string }> {
  if (sdkCanControl()) {
    try {
      await sdkControl!.prev();
      return { ok: true };
    } catch {
      // fall through to the Web API
    }
  }

  try {
    await apiFetch(withDeviceQuery("/me/player/previous"), { method: "POST" });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: errorMessage(error, "Could not skip to previous track") };
  }
}

export async function seekTo(positionMs: number): Promise<{ ok: boolean; message?: string }> {
  if (sdkCanControl()) {
    try {
      await sdkControl!.seek(positionMs);
      return { ok: true };
    } catch {
      // fall through to the Web API
    }
  }

  try {
    await apiFetch(
      withDeviceQuery("/me/player/seek", `position_ms=${positionMs}`),
      {
        method: "PUT",
      }
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, message: errorMessage(error, "Could not seek") };
  }
}

export async function setVolume(volumePercent: number): Promise<{ ok: boolean; message?: string }> {
  if (sdkCanControl()) {
    try {
      await sdkControl!.setVolume(volumePercent);
      return { ok: true };
    } catch {
      // fall through to the Web API
    }
  }

  try {
    await apiFetch(
      withDeviceQuery("/me/player/volume", `volume_percent=${volumePercent}`),
      {
        method: "PUT",
      }
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, message: errorMessage(error, "Could not change volume") };
  }
}

export async function setShuffle(
  state: boolean
): Promise<{ ok: boolean; message?: string }> {
  try {
    await apiFetch(
      withDeviceQuery("/me/player/shuffle", `state=${state}`),
      { method: "PUT" }
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, message: errorMessage(error, "Could not change shuffle") };
  }
}

export async function setRepeat(
  state: string
): Promise<{ ok: boolean; message?: string }> {
  try {
    await apiFetch(
      withDeviceQuery("/me/player/repeat", `state=${state}`),
      { method: "PUT" }
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, message: errorMessage(error, "Could not change repeat mode") };
  }
}

// ─── Library ──────────────────────────────────────────────────

export async function saveTrack(
  trackId: string
): Promise<{ ok: boolean }> {
  try {
    await apiFetch("/me/tracks", {
      method: "PUT",
      body: JSON.stringify({ ids: [trackId] }),
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function removeTrack(
  trackId: string
): Promise<{ ok: boolean }> {
  try {
    await apiFetch("/me/tracks", {
      method: "DELETE",
      body: JSON.stringify({ ids: [trackId] }),
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function checkSavedTracks(
  trackIds: string[]
): Promise<boolean[]> {
  try {
    const ids = trackIds.join(",");
    return await apiFetch<boolean[]>(`/me/tracks/contains?ids=${ids}`);
  } catch {
    return trackIds.map(() => false);
  }
}

export async function fetchAllLikedTracks(options?: {
  onProgress?: (loaded: number, total: number) => void;
  onPage?: (pageItems: SpotifyTrack[]) => void;
}): Promise<{ tracks: SpotifyTrack[]; total: number }> {
  try {
    const { items, total } = await paginateAll<SpotifyTrack>({
      limit: 50,
      buildUrl: (offset) => `/me/tracks?limit=50&offset=${offset}`,
      mapItem: (item) => (item as { track: SpotifyTrack }).track,
      onProgress: options?.onProgress,
      onPage: options?.onPage,
    });
    return { tracks: items.filter(Boolean), total };
  } catch {
    return { tracks: [], total: 0 };
  }
}

// ─── Devices ──────────────────────────────────────────────────

export async function getAvailableDevices(): Promise<SpotifyDevice[]> {
  try {
    const data = await apiFetch<{ devices: SpotifyDevice[] }>(
      "/me/player/devices"
    );
    return data.devices;
  } catch {
    return [];
  }
}

export async function transferPlayback(
  deviceId: string
): Promise<{ ok: boolean }> {
  try {
    await apiFetch("/me/player", {
      method: "PUT",
      body: JSON.stringify({ device_ids: [deviceId] }),
    });
    activeDeviceId = deviceId;
    // Direct SDK transport only applies while Vinylify's SDK device is active.
    if (deviceId !== sdkDeviceId) {
      sdkControl = null;
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// ─── Queue ────────────────────────────────────────────────────

export async function getQueue(): Promise<QueueResponse | null> {
  try {
    return await apiFetch<QueueResponse>("/me/player/queue");
  } catch {
    return null;
  }
}

export async function addToQueue(
  trackUri: string
): Promise<{ ok: boolean }> {
  try {
    await apiFetch(`/me/player/queue?uri=${encodeURIComponent(trackUri)}`, {
      method: "POST",
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function removeFromQueue(
  trackUri: string
): Promise<{ ok: boolean; message?: string }> {
  try {
    await apiFetch(`/me/player/queue?uri=${encodeURIComponent(trackUri)}`, {
      method: "DELETE",
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: errorMessage(error, "Could not remove from queue") };
  }
}

// ─── Albums ───────────────────────────────────────────────────

export function normalizeEntityId(
  id: string | null | undefined
): string | null {
  if (!id) return null;
  const clean = String(id).trim();
  if (!clean) return null;
  // SDK-sourced objects may carry a full URI (e.g. "spotify:album:abc") or an
  // empty id; reduce to the plain base62 entity id or reject it.
  const parts = clean.split(":");
  const last = parts[parts.length - 1]?.trim() ?? "";
  if (!last) return null;
  if (/[^0-9A-Za-z_-]/.test(last)) return null;
  return last;
}

export async function getAlbumTracks(
  albumId: string
): Promise<SpotifyTrack[]> {
  const id = normalizeEntityId(albumId);
  if (!id) return [];
  try {
    const { items } = await paginateAll<SpotifyTrack>({
      limit: 50,
      buildUrl: (offset) => `/albums/${id}/tracks?limit=50&offset=${offset}`,
      mapItem: (item) => item as SpotifyTrack,
    });
    return items;
  } catch {
    return [];
  }
}

export async function getAlbum(
  albumId: string
): Promise<SpotifyAlbum | null> {
  const id = normalizeEntityId(albumId);
  if (!id) return null;
  try {
    return await apiFetch<SpotifyAlbum>(`/albums/${id}`);
  } catch {
    return null;
  }
}

export async function getTrack(trackId: string): Promise<SpotifyTrack | null> {
  const id = normalizeEntityId(trackId);
  if (!id) return null;
  try {
    return await apiFetch<SpotifyTrack>(`/tracks/${id}`);
  } catch {
    return null;
  }
}

// ─── Artists ──────────────────────────────────────────────────

export async function getArtistTopTracks(
  artistId: string,
  market: string = "US"
): Promise<SpotifyTrack[]> {
  const id = normalizeEntityId(artistId);
  if (!id) return [];
  try {
    const data = await apiFetch<ArtistTopTracks>(
      `/artists/${id}/top-tracks?market=${market}`
    );
    return data.tracks;
  } catch {
    return [];
  }
}

export async function getArtist(
  artistId: string
): Promise<SpotifyArtist | null> {
  try {
    return await apiFetch<SpotifyArtist>(`/artists/${artistId}`);
  } catch {
    return null;
  }
}

// ─── Auth ─────────────────────────────────────────────────────

function generateRandomString(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let result = "";
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  for (let i = 0; i < length; i++) {
    result += chars[values[i] % chars.length];
  }
  return result;
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest("SHA-256", data);
}

function base64urlencode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (const byte of bytes) {
    str += String.fromCharCode(byte);
  }
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function getRedirectUri(): string {
  // Always redirect back to the origin that started the login so the PKCE
  // state/verifier stored in that origin's localStorage actually match.
  // Keep localhost/127.0.0.1 consistent: whichever origin the user opens the
  // app on is the one Spotify must redirect to. Register BOTH
  // http://localhost:3000/callback and http://127.0.0.1:3000/callback in the
  // Spotify Developer Dashboard.
  if (typeof window !== "undefined") {
    return `${window.location.origin}/callback`;
  }
  return (
    process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI || "http://127.0.0.1:3000/callback"
  );
}

export async function loginWithSpotify(): Promise<{ ok: boolean; error?: string }> {
  try {
    const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;

    if (!clientId) {
      return { ok: false, error: "Spotify client ID not configured" };
    }

    const redirectUri = getRedirectUri();

    if (!redirectUri) {
      return { ok: false, error: "Redirect URI not configured" };
    }

    if (typeof window !== "undefined" && !window.isSecureContext) {
      return {
        ok: false,
        error:
          "Login requires a secure context — open the app via http://localhost:3000 or http://127.0.0.1:3000",
      };
    }

    const state = generateRandomString(16);
    const codeVerifier = generateRandomString(64);
    const codeChallenge = base64urlencode(
      await sha256(codeVerifier)
    );

    safeSetItem("spotify_state", state);
    safeSetItem("spotify_code_verifier", codeVerifier);

    const scopes = [
      "user-read-private",
      "user-read-email",
      "user-read-playback-state",
      "user-modify-playback-state",
      "user-read-currently-playing",
      "user-read-recently-played",
      "user-top-read",
      "playlist-read-private",
      "playlist-read-collaborative",
      "user-library-read",
      "user-library-modify",
      "streaming",
    ];

    const authUrl = new URL("https://accounts.spotify.com/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes.join(" "));
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("code_challenge", codeChallenge);

    window.location.href = authUrl.toString();

    return { ok: true };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}
