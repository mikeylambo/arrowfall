# Arrowfall v2 decisions

- The attached GDD is authoritative for gameplay. The attached build brief is authoritative for architecture; the Steam/Tauri wrapper is excluded by the brief.
- Source was rebuilt from the SLU generator. No old Arrowfall game code was reused.
- SLU source at 6f08d17 was retrieved through the connected GitHub app because direct private-repository cloning is unavailable here. The original commit is the upstream base; the local import commit is not presented as that upstream commit.
- The shell dependency is pinned to `github:mikeylambo/Web-Game-Shell-v1.02#d5bdb4ae2ac09109088a5f0e524badd60996ee3b` (branch `arrowfall-survivor`), replacing the sibling `file:../slu-web-shell-1.1.0.tgz` archive. The game needs that branch: it imports `PixiAdapter`, `createSurvivorAssembly` and the latched `BrowserInputSource`, which upstream `main` (6f08d17) does not have.
- `d5bdb4a` is the bundle's shell commit (`3dcd5b8`) cherry-picked straight onto upstream `6f08d17`. The bundle's intermediate "Import shell source" commit was dropped because it vendored `node_modules`. `dist/` was regenerated with `tsc`, and all 71 shell tests pass.
- The shell repository is private. `npm ci` needs GitHub read access to it (SSH key or HTTPS credentials). Vercel or CI builds need a GitHub token with access to `mikeylambo/Web-Game-Shell-v1.02`.
- Bump the pin only to a commit on the shell repository. Do not return to a local archive.
- First-run scripted tutorial enemies are authored encounters inside the starting clearing; normal director/formation spawns remain off-screen. This reconciles section 16’s stationary sweet-spot targets with section 8’s normal spawn law.
- Boss starting HP defaults: 1,800 / 4,500 / 8,500 / 16,000. The GDD specifies TTK targets rather than HP. Those TTK targets still require human playtest tuning.
- The GDD leaves boon costs and most Deed mappings unspecified. Costs start at 50 and increase by 75 per rank; 60 concrete milestone/discovery Deeds are authored in data/meta.ts.
- Hero art currently uses baked procedural stand-ins, as explicitly allowed by the build brief. Final painted sheets and authored music are production replacements.
- The packaged headless Chromium uses software WebGL. It verifies functionality and screenshots, but is not a Steam Deck or laptop iGPU performance certification.

## Stabilize and visual readability pass (2026-10)

- **Pool and spatial index live in the game for now.** `sim/pool.ts` and `sim/grid.ts` keep the shell's `EntityPool` API, plus a cursor acquire and a closure-free grid. They stay in the game so the shell pin did not have to move again mid-pass. They are candidates to upstream into `modules/horde`.
- **Two auto-loose concepts, kept apart.** `T.autoLoose` (tuning, default `false`) decides whether an overdraw releases on its own. The player-facing Auto-Loose assist (loose at full draw, always perfect) is a separate option; its sim field is `Hunt.assistLoose`. The `letoff` bow never auto-releases.
- **Collision is authoritative over art.** Regular enemy sprites scale with their collision radius (`radius / UNIT`). Bosses render at 160–196 px (3–4× a regular enemy) with collision radii unchanged; the extra size is cloak, antlers or thorns around the hit body.
- **Weak points match the mechanics.** Shuck: head (front perfect hits ×1.5). Bramble King: the crown (GDD 10), full damage when an arrow's line of flight passes within 24 px of it, otherwise 25%. This replaced the earlier centre-line band because a crown reads in a 3/4 sprite and a band does not. Hag: lantern heart. Huntmaster: crown.
- **Violet means one thing.** It is used only for the perfect window, Deadeye and Focus. Phantom effects, camp highlights, menu focus and heal pickups moved to silver or warm white. The health bar is silver (the player's); boss bars are red (a threat).
- **Reduced motion keeps hitstop.** Reduced motion turns off shake, scale pulses and fog drift, and cuts flashes to 30%. Hitstop is a pause, not motion, so it stays. The option defaults to `prefers-reduced-motion`.
- **VFX never touches the sim.** `render/vfx.ts` reads sim events, uses its own RNG and has a per-frame budget. In crowds it shows fewer sparks rather than taking longer frames.
- **The hunter draws above all threats.** It sits on a soft navy cutout, so it stays findable in a 350-enemy crowd.
- **Bramble crown is a target of its own.** On the 3/4 sprite the crown sits 148 px above the King's feet, so the old rule (a crown point 42 px up, inside the body) no longer matched the art. Arrows that pass through the visible crown now hit it for full damage even when they clear the body; body hits still take 25%. The arrow search radius grows only while the King is up. With `?sprites=off`, the ring floats above the placeholder art.
