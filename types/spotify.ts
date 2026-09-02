export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  uri?: string;
  images?: SpotifyImage[];
  genres?: string[];
  popularity?: number;
  followers?: { total: number };
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
  release_date?: string;
  total_tracks?: number;
  album_type?: string;
  artists?: SpotifyArtist[];
  uri?: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album?: SpotifyAlbum;
  duration_ms: number;
  uri: string;
  preview_url: string | null;
  track_number?: number;
  disc_number?: number;
  popularity?: number;
  explicit?: boolean;
  is_local?: boolean;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  images: SpotifyImage[];
  owner: { display_name: string; id?: string };
  tracks: { total: number };
  uri: string;
  type?: string;
  public?: boolean;
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  images: SpotifyImage[];
  product?: string;
}

export interface SpotifyDevice {
  id: string;
  is_active: boolean;
  name: string;
  type: string;
  volume_percent: number;
  supports_volume?: boolean;
}

export interface PlaybackState {
  is_playing: boolean;
  item: SpotifyTrack | null;
  progress_ms: number;
  shuffle_state: boolean;
  repeat_state: string;
  device?: SpotifyDevice;
  context?: {
    uri: string;
    type: string;
    href?: string;
  };
  currently_playing_type?: string;
  timestamp?: number;
}

export interface QueueResponse {
  currently_playing: SpotifyTrack | null;
  queue: SpotifyTrack[];
}

export interface SearchResults {
  tracks?: { items: SpotifyTrack[]; total: number };
  artists?: { items: SpotifyArtist[]; total: number };
  albums?: { items: SpotifyAlbum[]; total: number };
  playlists?: { items: SpotifyPlaylist[]; total: number };
}

export interface PlaylistTracks {
  items: { track: SpotifyTrack | null }[];
  next: string | null;
  total: number;
}

export interface AlbumTracks {
  items: SpotifyTrack[];
  next: string | null;
  total: number;
}

export interface ArtistTopTracks {
  tracks: SpotifyTrack[];
}
