# Arrowfall tuning

GDD numeric bow, dodge, Focus, XP, enemy, upgrade and tool defaults are retained. Boss HP and boon prices are working defaults where the GDD provides no number.

Corrections from verification:
- Dodge integration clamps the final partial tick, preserving exactly 140 px of travel.
- Brief key taps are latched in the upstream shell input source so Escape is observed between animation frames.
- Dodge and Deadeye requests survive perfect-shot hitstop through buffered simulation input.
- Forest tile sprites are culled outside the camera; the starting clearing excludes cover within 380 px to preserve room to aim while keeping groves visible.

Not yet certified: 35/45/45/70-second boss TTK; all level targets and density pressure through human playtests; 60 fps on target hardware.

## Performance pass: 350 enemies / 600 arrows

Gate: `tests/e2e/performance.spec.ts`. The scene is `Hunt.stressFill()`: 350 enemies and 600 live arrows, topped up every step, with piercer, fletcher, ember, barbed and storm active. The gate measures 600 steps after 120 warm-up steps and drains events every frame like the real loop. It fails above **simulation p99 12 ms**. A Node bench of the same scene runs with `npm run bench [frames]`.

The previous gate timed 180 cold steps with no JIT warm-up and only 350 enemies plus incidental arrows. That method reported 18.4 ms (GPT package environment) and 16.9 ms here. Most of that p99 was warm-up and GC.

| Measurement (this container, 4 vCPU, software WebGL) | Before | After |
| --- | --- | --- |
| Browser gate, sim p99 over 5 runs | 6.8–10.0 ms | 5.2–7.3 ms |
| Browser gate, sim mean | 2.7–3.3 ms | 1.3–1.5 ms |
| Node bench (3000 steps), mean | 2.0–2.8 ms | 0.74–0.76 ms |
| Node bench, p99 | 4.8–9.1 ms | 2.7–3.3 ms |
| Node bench, bytes allocated per 3000 steps | 2.1 GB | 0.44 GB |
| Normal hunt frame time (swiftshader, 1440×900) | 300 ms | 100 ms |
| GPU submit per frame, normal hunt / stress | 9.3 / 7.9 ms | 2.0 / 4.3 ms |

Changes:
- `sim/pool.ts`: the pool's `acquire()` resumes from the last slot instead of rescanning from 0. This matters most for the 2000-slot particle pool on every `burst()`.
- `sim/grid.ts`: a uniform-grid spatial index rebuilt by counting sort into typed arrays. `query()` fills a caller-owned buffer with no closures. It replaces the callback `SpatialHash` for enemies and cover.
- `updateArrows`: closure-free. Bramble walls are gathered once per step; previously every arrow scanned all 300 threat slots. Upgrade ranks and evolution flags are hoisted out of the loop.
- `Math.hypot` is replaced by `len()` (`Math.sqrt`). V8 boxed every hypot result, and that was the largest allocation source.
- Pickup magnet uses squared distance. Sim events are recycled instead of allocated. `Object.assign` literals on pooled entities became field writes. Thunderstorm's per-hit `Set` became a fixed buffer, and the Rupture `filter()` became a count.
- `burst()` reads a per-step crowd count instead of recounting the 500-slot pool on every hit.
- Renderer: all baked art shares one 1024² atlas so sprites batch across types. Landmark rings are tessellated once per attach instead of every frame. MSAA is off; sprites are pre-antialiased canvas art.

Software WebGL frame rate is not a target-device measurement. Steam Deck and laptop iGPU budgets remain open (see BUILD_STATUS.md).

## Ground and atmosphere cost

`render/ground.ts` draws:
- one world-anchored `TilingSprite` with a 512² seamless fbm moor texture, tinted with moonlight;
- decals from the shared atlas in 1024² chunks, culled whole;
- two fog `TilingSprite` sheets: 1.06× parallax below the actors and 1.3× above, both drifting;
- one stretched vignette sprite.

The old floor was a 15000×8500 `Graphics` rect plus about 510 tile sprites, and the tiles were culled by their top-left corner.

- CPU: `Atmosphere.update` costs 0.06–0.14 ms per frame at stress (350 enemies / 600 arrows). The stress gate fails if it reaches 1 ms (`state.timing.atmosphere`).
- GPU: the ground replaces the old floor's full-screen pass. Fog and vignette add three alpha-blended full-screen quads, and visible decals batch with the atlas. In software WebGL, submit time with atmosphere on versus off varied 11–36 ms between runs, too noisy to isolate. On-device GPU timing (Steam Deck / iGPU) is still open.
- Off switch for profiling: `__ARROWFALL__.atmosphere(false)`.
