# Vinylify

A Spotify web player built with Next.js (App Router), React 19, and Tailwind CSS. Play your library right in the browser via the Spotify Web Playback SDK, with fallback to control of whatever active Spotify device you choose.

## Quick start

1. **Create a Spotify Developer App**
   - Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and create an app.
   - Set your **Redirect URI** to `http://127.0.0.1:3000/callback` (this project uses PKCE and calls `/app/callback`).

2. **Configure environment variables**
   - Copy the values into `.env.local` (created locally; `.env.local` is gitignored):
     ```ini
     NEXT_PUBLIC_SPOTIFY_CLIENT_ID=your_client_id
     NEXT_PUBLIC_SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/callback
     ```
   - `NEXT_PUBLIC_SPOTIFY_REDIRECT_URI` must match exactly the redirect URI registered in the dashboard.

3. **Install**
   ```bash
   npm install
   ```

4. **Run the dev server**
   ```bash
   npm run dev
   ```
   Open `http://127.0.0.1:3000`.

5. **Tests**
   ```bash
   npm run test        # single run
   npm run test:watch  # watch mode
   ```

## Environment variables

| Variable                          | Where it's used                          | Required |
| --------------------------------- | ---------------------------------------- | -------- |
| `NEXT_PUBLIC_SPOTIFY_CLIENT_ID`   | Login, token exchange, token refresh     | Yes      |
| `NEXT_PUBLIC_SPOTIFY_REDIRECT_URI`| OAuth callback redirect                  | Yes      |

There is no server-only client secret in this project — auth uses the **PKCE** flow, which only needs the public client ID.

## Required Spotify scopes

Requested at login (`lib/spotify.ts`):

```
user-read-private user-read-email user-read-playback-state user-modify-playback-state
user-read-currently-playing user-read-recently-played user-top-read
playlist-read-private playlist-read-collaborative user-library-read
user-library-modify streaming
```

The `streaming` scope and Web Playback SDK are what enable in-app playback.

## How playback works & limitations

- **Premium is required for in-app playback.** Spotify's Web Playback SDK only works for Spotify Premium accounts.
- When the SDK connects it registers a "Vinylify Web Player" device and tries to transfer playback to it automatically.
- **Without Premium,** Vinylify can control your active Spotify device instead (desktop/mobile app). You'll see playback-command errors rather than in-app audio.
- If no active device is found, Vinylify tries to re-transfer to its SDK device, fall back to whatever device is active, then list your available devices before giving up with a clear error.

## Common commands

| Command            | Purpose                          |
| ------------------ | -------------------------------- |
| `npm run dev`      | Start the development server     |
| `npm run build`    | Production build                 |
| `npm run start`    | Serve the production build       |
| `npm run lint`     | Run ESLint                       |
| `npm run test`     | Run unit tests (Vitest)          |

## Tests

Unit tests use [Vitest](https://vitest.dev) + Testing Library and live in `tests/`. They cover the core hooks (`useAbortableAsync`, `useSearch`) that guard against stale/out-of-order responses.
