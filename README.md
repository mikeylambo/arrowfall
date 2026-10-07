# ARROWFALL

**20 Minutes. One Hunter. Endless Arrows.**

Arrowfall is a browser-first top-down action roguelite built around one idea: make archery itself the game.

## Build 01 — The Bow

The first vertical slice intentionally focuses on bow feel before the full survivor layer:

- WASD movement
- 360° mouse aiming
- Quick Shot / Drawn Shot / Perfect Draw
- Manual fire control
- Projectile collision and piercing
- Dash
- Enemy pursuit and archetypes
- XP and level-up choices
- Hit feedback, particles, screen shake
- Responsive presentation shell

The production architecture will grow from this foundation into the 20-minute hunt, arrow evolutions, events, elites, Huntmaster boss, Hunter's Camp, Hunter's Log, achievements, persistence, audio, and final presentation.

## Development

```bash
npm install
npm run dev
```

Then open the local Vite URL.

This repository is the source of truth for Arrowfall. Other repositories are reference material only.

## Playtesting

- **Perfect Draw:** hold to draw, release while the gold ring is showing (about 0.66–0.86s). Holding longer than that overdraws the bow and loses the guaranteed crit.
- **Debug keys** (on in `npm run dev`, or add `?debug` to the URL): `]` skips ahead 2:00, `\` jumps to the Huntmaster, `L` gives a level-up, `H` restores full health. Any run that used them is flagged in the log.
- **Run log:** every run records its outcome, cause of death, upgrade picks, evolutions, and a snapshot each minute. Export it as JSON from Options → Playtest Log.
