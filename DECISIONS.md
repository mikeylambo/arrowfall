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
