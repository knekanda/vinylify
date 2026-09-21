# Apple Design System Migration — Execution Plan

## Overview
Apply Apple's design philosophy (clarity, deference, depth) across all 6 component files.
267 total changes. All files fixed in one pass, then build verified.

---

## Design Tokens Reference (already in globals.css)

| Token | Tailwind Class | Value |
|---|---|---|
| Off-white text | `text-[var(--color-text-primary)]` | #f5f5f7 |
| Secondary text | `text-[var(--color-text-secondary)]` | #86868b |
| Tertiary text | `text-[var(--color-text-tertiary)]` | #6e6e73 |
| Accent blue | `text-[var(--color-accent)]` / `bg-[var(--color-accent)]` | #2997FF |
| Display heading | `text-apple-display` | 34px/600/-0.01em |
| Title 1 | `text-apple-title1` | 28px/600/0.01em |
| Title 2 | `text-apple-title2` | 22px/600/0.01em |
| Headline | `text-apple-headline` | 17px/600/-0.02em |
| Body | `text-apple-body` | 17px/400/-0.02em |
| Callout | `text-apple-callout` | 16px/400/-0.01em |
| Subhead | `text-apple-subhead` | 15px/400/-0.01em |
| Footnote | `text-apple-footnote` | 13px/400 |
| Caption | `text-apple-caption` | 12px/400/0.01em |

---

## File 1: `app/globals.css` (7 fixes)

### Motion
- Line 231: Replace `0.5s` with `var(--duration-slow)` (2 places)
- Line 360: `ease-in-out` → `var(--ease-apple)` in logoCenterPulse
- Line 364: `ease-in-out` → `var(--ease-apple)` in logoSpecularDrift
- Line 372: `ease-in-out` → `var(--ease-apple)` in logoGlowPulse
- Line 390: `ease-in-out` → `var(--ease-apple)` in logoTextShimmer

### Color
- Line 72: `#48484a` → `var(--color-text-tertiary)` (scrollbar-color)
- Line 80: `#48484a` → `var(--color-text-tertiary)` (scrollbar-thumb)
- Line 382: `#6cb4ee` → `var(--color-accent)` in logo gradient

---

## File 2: `components/TopBar.tsx` (20+ fixes)

### Typography
- Search input: `text-sm` → `text-apple-body`
- Connect button: `font-bold` → `font-semibold`
- Back button label: `font-bold` → `font-semibold`

### Colors (12 instances)
- All `text-white` → `text-[var(--color-text-primary)]`
- All `text-[#a7a7a7]` → `text-[var(--color-text-secondary)]`
- All `placeholder:text-[#727272]` → `placeholder:text-[var(--color-text-tertiary)]`
- All `hover:text-white` → `hover:text-[var(--color-text-primary)]`
- `bg-[#3B82F6]` → `bg-[var(--color-accent)]`

### Spacing
- `gap-1.5` → `gap-2` (6px → 8px)

### Tap Targets (6 instances)
- Back button: `h-8 w-8` → `h-11 w-11` (32→44px)
- Forward button: `h-8 w-8` → `h-11 w-11`
- Clear search: `h-7 w-7` → `h-11 w-11` (28→44px)
- Icons inside: scale up to `h-5 w-5`

### Hover States (4 instances)
- Remove `hover:scale-105` from back/forward/profile/connect buttons
- Add `hover:opacity-80` instead

---

## File 3: `components/ContentGrid.tsx` (120+ fixes — largest file)

### Typography (20+ instances)
- All `font-extrabold` → `font-semibold` (greeting, hero name, search headings, playlist name)
- All `font-bold` → `font-semibold` (section headings, card titles, buttons)
- `font-medium` → `font-semibold` (login error)

### Apple Utility Classes (20+ instances)
- `text-[15px]` → `text-apple-subhead` (track name)
- `text-base` → `text-apple-callout` (card titles, quick picks)
- `text-3xl` → `text-apple-display` (greeting, search headings)
- `text-2xl` → `text-apple-title2` (section headings)
- `text-lg` → `text-apple-body` (hero subtitle)
- `text-sm` → `text-apple-subhead` or `text-apple-footnote` (descriptions, metadata)
- Responsive variants: keep `md:text-3xl lg:text-4xl` but change font weights

### Colors (50+ instances)
- All `text-white` → `text-[var(--color-text-primary)]`
- All `text-white/80` → `text-[var(--color-text-primary)]/80`
- All `text-[#a7a7a7]` → `text-[var(--color-text-secondary)]`
- All `text-[#727272]` → `text-[var(--color-text-tertiary)]`
- All `text-[#3B82F6]` → `text-[var(--color-accent)]`
- All `bg-[#3B82F6]` → `bg-[var(--color-accent)]`
- All `bg-white text-black` (play buttons) → `bg-[var(--color-text-primary)] text-black`

### Spacing (6 instances)
- `py-2.5` → `py-2` (track row)
- `p-2.5` → `p-2` (quick pick)
- `mt-14` → `mt-12` (info box)
- `mt-0.5` → `mt-1` (info box subtitle)
- `space-y-0.5` → `space-y-1` (track lists, 2 places)

### Tap Targets (3 instances)
- Track row play button: `h-8 w-8` → `h-11 w-11`
- Quick pick play button: `h-10 w-10` → `h-11 w-11`
- Icons inside: scale to `h-5 w-5`

### Hover States (6 instances)
- Track row play: remove `hover:scale-110`, use `hover:opacity-80`
- Playlist/Artist/Sample cards: remove `translate-y-2 ... group-hover:translate-y-0`, use opacity-only reveal
- Connect button: remove `hover:scale-105`, use `hover:opacity-80`
- "Play all" link: remove `hover:scale-105`, use `hover:opacity-80`

---

## File 4: `components/PlayerBar.tsx` (60+ fixes)

### Typography
- `text-[11px]` → add `text-apple-caption2` class in globals.css OR keep as-is (11px = caption2)
- Track name: `text-sm font-semibold` → `text-apple-footnote font-semibold`
- Artist: `text-xs` → `text-apple-caption`
- Empty states: apply apple-* classes

### Colors (40+ instances)
- All `text-white` → `text-[var(--color-text-primary)]`
- All `text-[#a7a7a7]` → `text-[var(--color-text-secondary)]`
- All `text-[#727272]` → `text-[var(--color-text-tertiary)]`
- All `text-[#3B82F6]` → `text-[var(--color-accent)]`
- All `hover:text-white` → `hover:text-[var(--color-text-primary)]`
- All `bg-white text-black` (play/pause) → `bg-[var(--color-text-primary)] text-black`

### Spacing (3 instances)
- `py-2.5` → `py-2` (notice banner)
- `gap-1.5` → `gap-2` (center controls)
- `gap-2.5` → `gap-3` (progress area)

### Tap Targets (12 instances)
- Heart button: wrap in `h-11 w-11 flex items-center justify-center`
- Shuffle: wrap in `h-11 w-11 flex items-center justify-center`
- Previous: wrap in `h-11 w-11 flex items-center justify-center`
- Play/Pause: `h-9 w-9` → `h-11 w-11`
- Next: wrap in `h-11 w-11 flex items-center justify-center`
- Repeat: wrap in `h-11 w-11 flex items-center justify-center`
- Lyrics: wrap in `h-11 w-11 flex items-center justify-center`
- Queue: wrap in `h-11 w-11 flex items-center justify-center`
- Device: wrap in `h-11 w-11 flex items-center justify-center`
- Volume/Mute: wrap in `h-11 w-11 flex items-center justify-center`
- Fullscreen: wrap in `h-11 w-11 flex items-center justify-center`
- Icons inside: scale to `h-5 w-5`

### Hover States (12 instances)
- Album art: remove `group-hover:scale-105`, use `group-hover:opacity-80`
- All icon buttons: remove `hover:scale-110`, use `hover:opacity-80`

### Motion
- `duration-300` → `duration-[320ms]` (album art transition)

---

## File 5: `components/NowPlayingPanel.tsx` (25+ fixes)

### Typography
- Labels: `font-bold` → `font-semibold` (4 instances)
- Track name: `text-xl font-bold` → `text-xl font-semibold`
- Lyrics: `font-medium` → `font-normal`
- Apply apple-* utility classes where appropriate

### Colors (16 instances)
- All `text-white` → `text-[var(--color-text-primary)]`
- All `text-[#a7a7a7]` → `text-[var(--color-text-secondary)]`
- All `text-[#727272]` → `text-[var(--color-text-tertiary)]`
- All `hover:text-white` → `hover:text-[var(--color-text-primary)]`
- `bg-white text-black` → `bg-[var(--color-text-primary)] text-black`
- `text-white/50` → `text-[var(--color-text-primary)]/50`

### Spacing (2 instances)
- `pt-5` → `pt-6` (20→24px, 2 places)

### Tap Targets (3 instances)
- Close button: `h-8 w-8` → `h-11 w-11` (2 instances)
- Play/pause: `h-10 w-10` → `h-11 w-11`
- Icons inside: scale to `h-5 w-5`

### Hover States (1 instance)
- Play button: remove `hover:scale-110`, use `hover:opacity-80`

---

## File 6: `app/page.tsx` (2 fixes)

### Colors
- Line 166: `text-white` → `text-[var(--color-text-primary)]`
- Line 177: `from-[#0a0a0a] via-[#050508] to-[#0a0a0a]` → `from-[var(--color-bg)] via-[#050508] to-[var(--color-bg)]`

---

## Additional: `app/layout.tsx` (2 fixes)

### Colors
- Line 30: `text-white` → `text-[var(--color-text-primary)]`
- Line 30: `bg-black` → `bg-[var(--color-bg)]`

---

## Post-Execution
1. Run `npx next build` to verify compilation
2. Check for any remaining lint warnings
3. Verify no Spotify integration code was modified
