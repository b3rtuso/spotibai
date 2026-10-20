# E2E Test Infra: Spotibai

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation design.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise + Workload Testing.
- Test runner: Vitest / Node test runner or custom headless runner (`npm run test` or `npx vitest run`).

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Cross-Feature) |
|---|---|---|:---:|:---:|:---:|
| F1 | Previous Track (<3s vs >3s) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| F2 | Play/Pause Stability & Stream Sync | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| F3 | Scrubber Motion, Seeking & Volume | ORIGINAL_REQUEST §R1, §R2 | 5 | 5 | ✓ |
| F4 | Like Button (Heart) & State Sync | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| F5 | Offline Download & Blob Storage | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| F6 | Spotify-Style Algorithmic Autoplay | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| F7 | Browser Reload State Persistence (F5) | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |

## Coverage Thresholds
- Tier 1: ≥5 per feature (7 features × 5 = 35 tests)
- Tier 2: ≥5 per feature (7 features × 5 = 35 tests)
- Tier 3: pairwise coverage of major feature interactions (≥10 tests)
- Tier 4: ≥5 realistic real-world application scenarios
- **Total Minimum Test Count**: ~85+ tests.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|---|---|---|
| 1 | Continuous Album Binge with Queue Exhaustion & Autoplay | F1, F2, F3, F6 | High |
| 2 | Offline Flight Mode (Downloaded Track Playback & Like Sync) | F2, F4, F5 | High |
| 3 | Sudden Reload Mid-Playback & Session Resume | F2, F3, F7 | High |
| 4 | Rapid Control DJ Stress (Rapid Shuffle, Repeat, Seek, Volume) | F1, F2, F3, F7 | High |
| 5 | Full Library Discovery & Like & Download Pipeline | F4, F5, F6, F7 | High |

## Test Case Format & Execution
- Runner command: `npm test` or `npx vitest run --run` or `node scripts/run-e2e-tests.mjs`
- Test cases live in: `tests/e2e/`
- Every test must run cleanly in Node / headless environment using mocked browser APIs (indexedDB via fake-indexeddb or in-memory Dexie, audio element mocks, localStorage mock).
