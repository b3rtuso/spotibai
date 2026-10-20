# Project: Spotibai Full Player Audit, Fix, Autoplay & Persistence

## Architecture
Spotibai is a desktop/web Spotify-like player built with React 19, TypeScript, Vite, Tailwind CSS, Dexie (IndexedDB), Web Audio API, and YouTube IFrame API.
- **Audio Core Subsystem**: `AudioEngine` (Web Audio API graph with 2 channel crossfader, 10-band EQ, masterGain, AnalyserNode) + `YouTubeEngine` (headless iframe embed player). Controlled by `playerStore.ts`.
- **UI Control Subsystem**: `PlayerBar` (bottom player bar with Previous, Play/Pause, Next, Scrubber, Time labels, Like, Download, Volume, Queue, Repeat, Shuffle), `TrackRow` (track lists, search results, library), `SearchView`, `QueueView`.
- **Persistence & Storage Subsystem**: Dexie `SpotibaiDB` (`tracks`, `playlists`, `history`, `settings`), `libraryStore.ts`, `downloadService.ts`, and dual-layer session hydration (`localStorage` + `IndexedDB`).
- **Autoplay Recommendation Subsystem**: `autoplayEngine.ts` (multi-factor recommendation heuristic based on Genre clustering, Artist affinity, Liked status, avoiding recently played tracks), integrated into queue exhaustion event in `playerStore.ts`.

## Feature Inventory
Every feature from the Survey phase and `ORIGINAL_REQUEST.md` is enumerated here with its assigned milestone.
| # | Feature | Description | Milestone | Source |
|---|---|---|---|---|
| F1 | Previous Track Button | <3s switches to previous song in queue; >3s restarts track to 0:00 without crossfade time-leak corruption. | M1 | ORIGINAL_REQUEST §R1 |
| F2 | Play/Pause Stability & Stream Sync | Zero unhandled promise rejections on rapid toggle; crossfade pause event decoupled so UI does not invert to Play at 2s; seamless audio and YouTube pause/resume. | M1 | ORIGINAL_REQUEST §R1 |
| F3 | Scrubber Motion & Time Tracking & Volume | Scrubber advances smoothly in real-time; local `isScrubbing` drag state prevents thumb jitter; loadedmetadata/durationchange guarded against NaN/Infinity; interactive seek immediate; mute/unmute volume restore; fix double attenuation ($vol^2$). | M1 | ORIGINAL_REQUEST §R1, §R2 |
| F4 | Like Button (Heart) & Cross-Store Sync | Toggles favorite state, updates `isLiked` in IndexedDB (`SpotibaiDB`), updates library state, supports `trackFallback` for search results, and syncs `playerStore.currentTrack` and `queue` immediately. | M2 | ORIGINAL_REQUEST §R1 |
| F5 | Offline Download & Blob Storage | Fetches and persists raw audio and artwork blobs into IndexedDB with visible progress and checkmark status without network rejections or fake downloads; regenerates object URLs from Blobs upon reload. | M2 | ORIGINAL_REQUEST §R1 |
| F6 | Spotify-Style Algorithmic Autoplay Engine | When queue finishes or reaches last track, executes Genre clustering, Artist affinity, and Liked-song weights, penalizing recently played tracks from history/queue to automatically queue and play matching songs indefinitely. | M3 | ORIGINAL_REQUEST §R3 |
| F7 | Browser Reload State Persistence (F5) | Persists active track, queue, queueIndex, currentTime, volume, playlists, repeat, and shuffle across browser reloads via dual-layer hydration without wiping session or content. | M4 | ORIGINAL_REQUEST §R4 |
| F8 | Build & E2E Test Suite Acceptance | Zero TypeScript/build errors (`npm run build`, `npx tsc --noEmit`); 100% passing of opaque-box E2E tests (Tiers 1-4) and Tier 5 adversarial coverage hardening. | M5 | ORIGINAL_REQUEST §Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | M1 | Audio Core Engine, Play/Pause, Previous & Scrubber | `AudioEngine.ts`, `YouTubeEngine.ts`, `PlayerBar.tsx`, `colorExtractor.ts`, `playerStore.ts` (playback controls, seek, previousTrack, volume/mute) | none | DONE |
| 2 | M2 | Like System, Offline Download Blobs & DB Consistency | `TrackRow.tsx`, `downloadService.ts`, `libraryStore.ts`, `tagParser.ts`, `database.ts`, `PlayerBar.tsx` (download status) | none | IN_PROGRESS |
| M3 | Algorithmic Autoplay & Continuous Playback Engine | `autoplayEngine.ts`, `playerStore.ts` (nextTrack queue exhaustion, seamless recommendation queuing) | M1 | PLANNED |
| M4 | Browser Reload State Persistence & Session Hydration | Dual-layer persistence (`localStorage` session pointers + IndexedDB catalog/blobs), hydration lifecycle in `playerStore.ts` & `AppLayout.tsx` | M1, M2 | PLANNED |
| M5 | Final Integration & E2E Test Suite Acceptance | Verify 100% pass on E2E Test Suite (Tiers 1-4) and complete Tier 5 Adversarial Coverage Hardening | M1, M2, M3, M4 | PLANNED |

## Interface Contracts
### AudioEngine ↔ playerStore
- `audioEngine.playTrack(track: Track): Promise<void>`: Returns promise, catches all AbortError/DOMException silently, updates active audio element immediately.
- `audioEngine.pause(): void`: Immediately pauses active audio channel and cancels pending crossfade transition timers.
- `audioEngine.seek(timeInSeconds: number): void`: Validates `isFinite(timeInSeconds)` and `isFinite(duration)` before setting `currentTime`.
- `audioEngine.onTimeUpdate`: Callback passing live `(currentTime: number, duration: number)`. Only reports from genuinely active audio index.
- `audioEngine.onPlayStateChange`: Callback passing `(isPlaying: boolean)`. Does not fire when outgoing audio channel pauses at end of crossfade.

### libraryStore ↔ playerStore
- `libraryStore.toggleLike(trackId: string, trackFallback?: Track): Promise<void>`:
  - If track not in `libraryStore.tracks`, uses `trackFallback` or `playerStore.currentTrack` to add to library.
  - Updates `db.tracks` with new `isLiked`.
  - Updates `playerStore.currentTrack` if matching `trackId`.
  - Updates all instances of matching `trackId` in `playerStore.queue`.
- `libraryStore.downloadTrack(track: Track): Promise<void>`:
  - Downloads audio and artwork blobs reliably.
  - Updates `db.tracks` with `isDownloaded: true` and blob records.
  - Updates `playerStore.currentTrack.isDownloaded = true` if matching `trackId`.
  - Updates `playerStore.queue` entries if matching `trackId`.

### autoplayEngine ↔ playerStore
- `getAutoplayRecommendations(currentTrack: Track, allTracks: Track[], recentHistory: HistoryEntry[], currentQueue: Track[], count: number): Track[]`:
  - Scores candidate tracks: Genre match (+40), Artist affinity (+30), Liked status (+25), Year proximity (+10).
  - Penalizes: Recently played in history (-150 to -500), already in current queue (-300).
  - Returns top ranked candidate tracks.
  - Called by `playerStore.nextTrack()` when `nextIdx >= queue.length` and `repeat !== 'all'`.

### Persistence Hydration Contract
- `saveSessionState(state: SessionState): void`: Debounced write to `localStorage` (key: `'spotibai_session'`) containing:
  - `currentTrackId: string | null`
  - `queueTrackIds: string[]`
  - `queueIndex: number`
  - `currentTime: number`
  - `volume: number`
  - `isMuted: boolean`
  - `repeat: 'off' | 'all' | 'one'`
  - `shuffle: boolean`
- `hydrateSessionState(): Promise<void>`: Called during application initialization:
  - Loads catalog and playlists from `SpotibaiDB`.
  - Regenerates fresh `URL.createObjectURL` for all tracks with `audioBlob` or `artworkBlob`.
  - Reads session state from `localStorage`.
  - Reconstructs `currentTrack` and `queue` from catalog tracks.
  - Stages `currentTime` and `volume` into `playerStore` without auto-starting playback (respecting browser autoplay policies).

## Code Layout
- `src/services/audio/AudioEngine.ts` — Web Audio API graph, dual audio elements, EQ, volume, crossfading.
- `src/services/youtube/YouTubeEngine.ts` — Headless YouTube IFrame player wrapper.
- `src/services/recommendation/autoplayEngine.ts` — Algorithmic recommendation scoring engine.
- `src/services/downloader/downloadService.ts` — Offline audio & artwork blob download service.
- `src/services/db/database.ts` — Dexie IndexedDB (`SpotibaiDB`) schema and initial seed data.
- `src/services/metadata/tagParser.ts` — Audio file tag parser & blob URL generation.
- `src/store/playerStore.ts` — Playback state, queue, volume, shuffle, repeat, previousTrack, nextTrack, autoplay hook.
- `src/store/libraryStore.ts` — Library tracks, playlists, liked tracks, download status.
- `src/components/player/PlayerBar.tsx` — Full bottom player bar controls, scrubber, time displays, heart, download checkmark.
- `src/components/common/TrackRow.tsx` — Track item row in lists and search results with like and download buttons.
- `src/utils/colorExtractor.ts` — Time formatter (`formatTime`) and color utilities.
