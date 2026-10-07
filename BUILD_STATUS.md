# Arrowfall v2 — build status

## Verified in this pass (stabilize + visual readability)

`npm ci && npm run check` passes from a clean install against the vendored shell (`vendor/slu-web-shell-1.1.0-d5bdb4a.tgz`, commit `d5bdb4a`). The check runs Prettier, typecheck, lint, 27 unit/integration tests, the production build and 5 browser tests.

- **Stress gate passes.** The scene holds 350 enemies and 600 live arrows. Simulation p99 is 4.6–6.7 ms against a 12 ms budget (previously 18.4 ms measured with a cold 180-frame method). The atmosphere update stays under 1 ms (measured 0.05–0.14 ms). See `TUNING_LOG.md` and `evidence/performance.json`.
- **`T.autoLoose = false`.** The draw holds at overdraw until release. Setting it to `true` restores the auto-release. Both paths are unit-tested.
- **Palette.** It is data-driven in `src/data/art.ts`: silver player, red threat family, violet only for perfect/Deadeye/Focus, deep navy world. A grayscale dev view (F3 or the dev panel) keeps the player and threats distinct.
- **Ground.** Procedural moor ground, decals, two parallax fog sheets and a vignette (`render/ground.ts`).
- **Silhouettes.** One procedural silhouette per enemy type (`data/enemies.ts`). Bosses render at 3–4× scale with mechanic-true weak points (`data/bosses.ts`).
- **Juice.** Arrow trails, impact sparks, death bloom with a red flash, a violet perfect bloom and chime flash, and a Deadeye wash with desaturation and glowing marks. Hitstop, shake and Focus gains are read from tuning (unit-tested). Reduced motion is respected.
- **Diegetic UI.** The bowstring shows tension and the perfect window, an arrow sits nocked on it, Focus gathers as moonlight motes and a halo, and dodge recovery shows as an arc at the hunter's feet. The HUD text is trimmed.

Evidence in `evidence/` is regenerated with `npm run evidence`:

- `hunt.png` (minute four, drawing in the perfect window)
- `deadeye.png`
- `crowd-350.png` (349 enemies / 582 arrows)
- `grayscale.png`
- `boss-0..3.png` (weak points)
- `performance.json`

## Not yet verified

- **GPU budget on target devices** (Steam Deck, laptop iGPU). All numbers here come from software WebGL (swiftshader) in a 4-vCPU container. Frame rate there is fill-rate bound and says nothing about real GPUs.
- **Human playtest** of the new overdraw hold (`autoLoose: false`), Focus/draw readability with the trimmed HUD, and boss weak-point clarity in motion.
- **Art.** The hunter, all 8 enemies and all 4 bosses use 3/4 cel-shaded sprite sheets (`public/art/sprites`). The Night Hag's illusions wear her sheet. `?sprites=off` falls back to the procedural art.
- Physical controller pass, boss TTK balance, full audio production, and Vercel preview (needs a GitHub token with access to the private shell repo). These are carried over from the previous status.
