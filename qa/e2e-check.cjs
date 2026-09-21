/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("@playwright/test");

const BASE = "http://127.0.0.1:3000";

function trackObj(id, name, artist = "Mock Artist", album = "Mock Album") {
  return {
    id,
    name,
    uri: `spotify:track:${id}`,
    duration_ms: 210000,
    preview_url: null,
    artists: [{ id: `a-${id}`, name: artist, uri: `spotify:artist:a-${id}` }],
    album: {
      id: `alb-${id}`,
      name: album,
      uri: `spotify:album:alb-${id}`,
      images: [{ url: "", height: 640, width: 640 }],
    },
  };
}

const profiles = { p1: { id: "p1", display_name: "Mock User", product: "free", followers: { total: 3 }, images: [] } };

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrors = [];
  const pageErrors = [];
  const apiCalls = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("request", (r) => { if (r.url().includes("api.spotify.com")) apiCalls.push(r.method() + " " + r.url()); });

  function fulfill(route, status, body, ctype) {
  const opts = { status };
  if (status === 204) {
    opts.contentType = "application/json";
    opts.body = "";
  } else {
    opts.contentType = ctype || "application/json";
    opts.body = JSON.stringify(body);
  }
  return route.fulfill(opts);
}

  // Mock Spotify API
  let pollCount = 0;
  await page.route("**/api.spotify.com/**", (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const m = req.method();

    const track = trackObj("tr-1", "Mock Song One", "Artist Beta", "Album Alpha");
    const track2 = trackObj("tr-2", "Mock Song Two", "Artist Beta", "Album Alpha");

    if (m === "GET" && path === "/v1/me") return fulfill(route, 200, profiles.p1);
    if (m === "GET" && path === "/v1/me/playlists") {
      return fulfill(route, 200, { items: [
        { id: "pl-1", name: "Chill Mix", uri: "spotify:playlist:pl-1", description: "Mock chill", tracks: { total: 12 }, images: [], owner: { display_name: "Mock User" } },
        { id: "pl-2", name: "Workout", uri: "spotify:playlist:pl-2", description: "", tracks: { total: 5 }, images: [], owner: { display_name: "Mock User" } },
      ] });
    }
    if (m === "GET" && path === "/v1/me/top/artists") {
      return fulfill(route, 200, { items: [{ id: "a-1", name: "Artist Beta", images: [], genres: ["synthwave"], followers: { total: 100 } }] });
    }
    if (m === "GET" && path === "/v1/me/top/tracks") {
      return fulfill(route, 200, { items: [track, track2] });
    }
    if (m === "GET" && path === "/v1/me/player/recently-played") {
      return fulfill(route, 200, { items: [{ track, played_at: "2026-01-01T00:00:00Z" }, { track: track2, played_at: "2026-01-01T01:00:00Z" }] });
    }
    if (m === "GET" && path === "/v1/me/player") {
      // Simulate a continuously playing session so the non-SDK progress timer
      // stays active while we test the search debounce.
      pollCount += 1;
      return fulfill(route, 200, {
        device: { id: "dev-1", name: "Mock Phone", type: "Smartphone", volume_percent: 70 },
        item: track,
        is_playing: true,
        shuffle_state: false,
        repeat_state: "off",
        progress_ms: 10000 + pollCount * 1000,
      });
    }
    if (m === "GET" && path === "/v1/me/player/currently-playing") return fulfill(route, 204);
    if (m === "GET" && path === "/v1/me/player/devices") {
      return fulfill(route, 200, { devices: [{ id: "dev-1", name: "Mock Phone", type: "Smartphone", is_active: true, volume_percent: 70 }] });
    }
    if (m === "GET" && path === "/v1/me/tracks/contains") return fulfill(route, 200, [true, false]);
    if (m === "GET" && path === "/v1/search") return fulfill(route, 200, { tracks: { items: [trackObj("tr-s1", "Search Hit One"), trackObj("tr-s2", "Search Hit Two")] } });
    if (m === "GET" && path === "/v1/playlists/pl-1/tracks") return fulfill(route, 200, { items: [{ track, added_at: "2026-01-01" }] });
    if (m === "GET" && path === "/v1/artists/a-1/top-tracks") return fulfill(route, 200, { tracks: [track, track2] });
    if (m === "GET" && path === "/v1/artists/a-tr-1/top-tracks") return fulfill(route, 200, { tracks: [track, track2] });
    if (m === "GET" && path === "/v1/albums/alb-tr-1") return fulfill(route, 200, { id: "alb-tr-1", name: "Album Alpha", release_date: "2025", artists: [{ id: "a-tr-1", name: "Artist Beta" }], images: [] });
    if (m === "GET" && path === "/v1/albums/alb-tr-1/tracks") return fulfill(route, 200, { items: [track, track2] });
    if (m === "GET" && path === "/v1/me/tracks") return fulfill(route, 200, { items: [{ track, added_at: "2026-01-01" }], total: 1 });
    if (m === "PUT" && (path === "/v1/me/player/play" || path === "/v1/me/player/pause" || path === "/v1/me/player/next" || path === "/v1/me/player/previous" || path === "/v1/me/player/seek" || path === "/v1/me/player/shuffle" || path === "/v1/me/player/repeat" || path === "/v1/me/player")) return fulfill(route, 204);
    if (m === "POST" && path === "/v1/me/player/queue") return fulfill(route, 204);
    if ((m === "PUT" || m === "DELETE") && path.startsWith("/v1/tracks")) return fulfill(route, 200, null);

    apiCalls.push(`=> ${m} ${path} 404(unmocked)`);
    return fulfill(route, 404, { error: { status: 404, message: `unmocked ${m} ${path}` } });
  });

  await page.addInitScript(() => {
    localStorage.setItem("spotify_access_token", "fake-token-123");
    localStorage.setItem("spotify_refresh_token", "fake-refresh");
    localStorage.setItem("spotify_token_expires_at", String(Date.now() + 3600000));
  });

  const t0 = Date.now();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  console.log("=== CONNECTED HOME LOAD ===");
  console.log("load ms:", Date.now() - t0);

  // wait for greeting + content
  await page.waitForSelector("text=Mock User", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);

  const bodyText = (await page.locator("body").innerText()).replace(/\n+/g, " | ");
  console.log("body:", bodyText.slice(0, 900));
  const hasHome = bodyText.includes("Recently Played") || bodyText.includes("Made For You") || bodyText.includes("Top Tracks");
  console.log("home content rendered:", hasHome);
  console.log("free banner shown:", bodyText.includes("Free account"));

  // play a track -> should succeed via REST and show notice for free user
  await page.click('text=Mock Song One >> nth=0').catch((e) => console.log("click track failed:", e.message));
  await page.waitForTimeout(1200);
  const noticeAfterPlay = (await page.locator("body").innerText()).includes("active Spotify device");
  console.log("play routes to device + notice:", noticeAfterPlay);

  // Let the progress timer tick for a few seconds while "playing", then search
  // — this catches the stale debounce bug where search never fires during
  // playback because the debounce timer kept getting reset each progress tick.
  await page.waitForTimeout(4200);
  const progressTicked = (await page.locator("body").innerText()).includes("Mock Song One");
  console.log("playback simulation still active:", progressTicked);

  // search flow
  await page.fill('input[placeholder="What do you want to play?"]', "search hit");
  await page.waitForTimeout(1600);
  const searchShown = (await page.locator("body").innerText()).includes("Search Hit One");
  console.log("search results appear (while 'playing'):", searchShown);

  // artist page
  await page.click('text=Artist Beta >> nth=0').catch(() => {});
  await page.waitForTimeout(900);
  const artistShown = (await page.locator("body").innerText()).includes("Popular");
  console.log("artist view:", artistShown);

  // album page
  await page.click('text=Album Alpha >> nth=0').catch(() => {});
  await page.waitForTimeout(900);
  const albumBody = (await page.locator("body").innerText()).replace(/\n+/g, " | ");
  const albumShown = albumBody.includes("2025");
  console.log("album view:", albumShown);
  if (!albumShown) console.log("  album body:", albumBody.slice(180, 700));

  // playlist page
  await page.click('text=Chill Mix').catch(() => {});
  await page.waitForTimeout(900);
  const playlistShown = (await page.locator("body").innerText()).includes("songs");
  console.log("playlist view:", playlistShown);

  // liked songs
  await page.click('text=Your Library').catch(() => {});
  await page.click('text=Liked Songs').catch(() => {});
  await page.waitForTimeout(1200);
  const likedShown = (await page.locator("body").innerText()).includes("Liked Songs");
  console.log("liked view renders:", likedShown);

  await page.screenshot({ path: "qa/shot-liked.png" });

  console.log("=== CONSOLE ERRORS ===", consoleErrors.length);
  consoleErrors.slice(0, 20).forEach((e) => console.log("  ", e.slice(0, 200)));
  console.log("=== PAGE ERRORS ===", pageErrors.length);
  pageErrors.slice(0, 20).forEach((e) => console.log("  ", e.slice(0, 200)));
  console.log("=== API CALLS (unique) ===");
  [...new Set(apiCalls)].forEach((c) => console.log("  ", c));

  await browser.close();
}

run().catch((e) => { console.error("HARNESS FAILED:", e.message); process.exit(1); });