# Arrowfall v2

Top-down archery survivors game rebuilt from the attached GDD using TypeScript, PixiJS v8 and the SLU web shell.

## Run the review bundle

Keep `arrowfall/` and the sibling `slu-web-shell-1.1.0.tgz` in the supplied folder arrangement.

```bash
cd arrowfall
npm ci
npm run dev
```

Open the Vite address. WASD moves, mouse aims, hold/release left click draws and looses, Space dodges, E/right-click activates Deadeye, Escape pauses. Gamepad uses left stick, right stick, RT, LT/A, RB and Start.

`npm run check` runs typecheck, lint, unit/integration tests, production build and browser tests. `CHROME_BIN` can select a local Chromium executable. Use `?dev=1` for F1/F2 tools in development. Production debug tools are disabled.

## Architecture

- `src/data`: GDD content and tuning.
- `src/sim`: seeded 60 Hz gameplay, pooled entities, hash collisions and flow field.
- `src/render`: Pixi presentation and baked procedural art.
- `src/audio`: semantic synthesized audio through the shell mixer.
- `src/ui`: controller/KBM controls, Camp and shell screen extensions.
- `tests`: exact bow windows, save/replay, evolution effects, full-night simulation and live browser flow.

Read `BUILD_STATUS.md` for verified checks and remaining release work. This is a development build; a passing bundle build alone does not imply the full release acceptance checklist is complete.

The sibling shell source is a separate repository based on 6f08d17. Its adapter, survivor frame, horde utilities and input fix have passed full shell verification. The production GitHub pin and Vercel preview are pending authorized upstream publication.
