# Arrowfall v2 — verification status

## Verified locally

- TypeScript and lint checks pass.
- 24 unit/integration tests pass: all six exact bow windows; seeded replay; exact dodge distance; perfect Focus and hold-to-auto-loose; evolution offers; recovery-safe profile round-trip; pooling/hash and off-screen director spawn; each of the 10 evolution effects; an unskipped seeded 20-minute simulation reaching dawn with all four scheduled bosses.
- Shell: 71 tests pass, six generated consumers compile and release-certify (including Pixi/survivor), browser flow checks pass, budget has no violations.
- Game live browser suite covers actual shooting, pause/resume, upgrade selection, results/retry, Camp, Range and reload; Deadeye painting/release; four boss spawn/phase/death checks; a combined evolved build. Screenshots are included in `evidence/` in the review bundle.

- Gameplay browser tests: 4 passed. Stress gate: FAILED, 350 enemies, simulation p99 18.4 ms against 16.7 ms. This failure is retained in the evidence.
- Production smoke passes: title and start flow, no browser errors, no development API even with `?dev=1`. Pixi vendor isolation avoids a production import/startup deadlock.
- Clean `npm ci` from the packaged sibling shell archive passes.

## Acceptance still pending

This is a substantial playable development build, not a claim that the complete GDD release gate passed.

- GPU performance budget on Steam Deck and a representative laptop iGPU. Software Chromium is used here; its FPS must not be substituted for target-device evidence. The full requested 350-enemy/600-arrow/200-projectile/VFX render budget still needs measurement.
- Physical controller playtesting through every Camp station, card and settings flow; no physical controller is attached here.
- Boss TTK/power-curve balance, a real-time human 20-minute playthrough, and all minute-by-minute level targets.
- Complete music-stem transitions, every unique SFX timbre, key-aware harmony per cue, and voice-category caps. Current semantic synthesis is functional but simpler than the full audio production brief.
- Hero painted assets and their full frame animation replacements; current art is procedural stand-in art.
- Final boss mechanics polish: fully authored mounted riders/lanes, Hag illusion presentation, precise crown/head weak-point readability and all higher-Moon additional attacks.
- Ranged-dummy challenge calibration, cosmetic unlock selection, and exact dedicated unlock conditions for the eleven Deed-gated upgrades. UI scale, aim assist, damage-number controls and persisted input rebinding are implemented; human usability checks remain.
- Stronger showcase evidence per evolution and boss attack, including live projectile-driven phase/death proof. The current set-piece test uses development damage/kill hooks after verifying live spawn and phase behavior.
- Source publication, durable shell commit/tag pin, Vercel private-dependency access and a deployed preview. Automatic review rejected the attempted upstream shell upload; it has not been bypassed.

## Source disposition

The original game default branch is untouched. A local `v2` rebuild is prepared. Shell changes are in a separate local `arrowfall-survivor` branch based on the retrieved 6f08d17 source. No remote commit, tag, PR or deployment is claimed.
