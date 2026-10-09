# Arrowfall v2

Top-down archery survivors game rebuilt from the attached GDD using TypeScript, PixiJS v8 and the SLU web shell.

## Run the review bundle

The SLU shell is vendored as `vendor/slu-web-shell-1.1.0-d5bdb4a.tgz`, packed from commit `d5bdb4a` of the private `mikeylambo/Web-Game-Shell-v1.02` repository, so `npm ci` needs no GitHub access.

```bash
cd arrowfall
npm ci
npm run dev
```

Open the Vite address. WASD moves, mouse aims, hold/release left click draws and looses, Space dodges, E/right-click activates Deadeye, Escape pauses. Gamepad uses left stick, right stick, RT, LT/A, RB and Start.

`npm run check` runs format check, typecheck, lint, unit/integration tests, production build and browser tests, including the 350-enemy / 600-arrow stress gate. `npm run bench` profiles the simulation headlessly. `npm run evidence` regenerates the screenshots in `evidence/`. `CHROME_BIN` can select a local Chromium executable. Use `?dev=1` for dev tools: F1 opens the dev panel, F2 toggles the perf overlay and F3 toggles the grayscale readability view. Production debug tools are disabled.

## Playtesting

Open the game with `?playtest=1` (or `?playtest=Pixel%207` to name the device). The kit stays on for that device until `?playtest=0`. It works in production builds, with no dev tools shown, and changes nothing in play.

- **Recorded per hunt:** result, cause of death, time, level, kills, perfect %, hits taken, dodges, bow, phase, curses, seed, evolutions, top build, boss kill times, seconds per input device (keyboard, pad, touch), frame-time percentiles, the 10 worst hitches (with enemy, arrow and particle counts) and fps per 30 s.
- **Device:** screen, window, pixel ratio, cores, memory, GPU and connected gamepads.
- **Notes:** **N** (keyboard) or the round button on the left, under the health bar (touch or mouse) opens a note box and pauses the hunt; Enter saves, Esc cancels. **Back / View** on a gamepad drops a marker. Each note stamps the hunt clock, fps, enemies, HP, level, boss and device.
- **Export:** **Options → Playtest Report** (from pause or camp) or **Playtest Report** on the results screen: copy (Markdown summary plus JSON), download or share the file, or start a new session.

Everything is kept in local storage, including a hunt cut short by closing the tab. A session restarts automatically when the build changes.

## Architecture

- `src/data`: GDD content and tuning.
- `src/sim`: seeded 60 Hz gameplay, pooled entities, hash collisions and flow field.
- `src/render`: Pixi presentation and baked procedural art.
- `src/audio`: semantic synthesized audio through the shell mixer.
- `src/ui`: controller/KBM controls, Camp and shell screen extensions.
- `tests`: exact bow windows, save/replay, evolution effects, full-night simulation and live browser flow.

Read `BUILD_STATUS.md` for verified checks and remaining release work. This is a development build; a passing bundle build alone does not imply the full release acceptance checklist is complete.
