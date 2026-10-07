# Arrowfall — Art Bible

One page that every asset, prompt and shader answers to. When an asset and this page disagree, change the asset or change this page on purpose; never let them drift.

## The look in one line

**Chibi cel-shaded hunters and monsters with bold ink outlines, in a painterly moonlit forest lit by one enormous moon.**

References: MapleStory archers (proportion, silhouette, a single accent), graphic chibi illustration (limited palette, one spot colour, black-and-white graphic shapes), moonlit-archery key art (giant moon, silhouetted trees, cold blue night, silver rim light).

## Pillars

1. **Silhouette first.** Every character must be identifiable as a solid black shape at 48 px tall. If two silhouettes could be confused, one changes.
2. **One light.** The moon sits high behind-left of camera. Every asset is lit from it: cool key from upper-left, silver rim on the right/top edges, a soft shadow cast down-right on the ground. No asset is lit from anywhere else.
3. **Ink and two tones.** Cel shading with exactly two tones per material (lit and shadow), a hard terminator, a coloured ink outline, and a silver rim highlight. No gradients on characters; gradients live only in the sky, fog and glows.
4. **Colour is meaning.** The hunter and the hunter's light are silver/white. Every threat is blood-red. The third colour is reserved (see Palette). Nothing else may introduce a hue.
5. **The world is darker than anything that moves.** The forest floor and trees stay low-value blue-black so every glowing element pops, at 350 enemies as at one.

## Camera and projection

- **3/4 view.** The orthographic render camera sits 40° above the horizon. Characters are drawn standing upright, so you see faces, bows and silhouettes.
- **Gameplay is unchanged.** The simulation stays flat 2D with the same coordinates, radii and hitboxes. A sprite's feet sit at its entity position, sprites are sorted by Y, and a contact shadow marks the hitbox footprint on the ground. No vertical squash is applied to the world, so distances on screen remain truthful.
- **Directions.** Characters render in 8 directions; the 3 left-facing directions are mirrored from the right-facing ones, so 5 are unique renders. The aim angle picks the nearest direction, and the bow arm rotates freely on top for precise aim.

## Proportions

| Character       | Heads tall    | In-game height                    | Notes                                                           |
| --------------- | ------------- | --------------------------------- | --------------------------------------------------------------- |
| Hunter          | 2.5           | 72 px                             | big hood, readable face, long cloak tail, bow held forward      |
| Regular enemies | 1.5–3 by type | 36–80 px                          | sized to collision radius; never larger than the hitbox implies |
| Bosses          | —             | 3–4× a regular enemy (160–200 px) | weak point is the brightest pixel on the body                   |

## Palette

Held in `src/data/art.ts` `PALETTE`; this table is the source the code mirrors.

| Role                  | Value                                          | Use                                                       |
| --------------------- | ---------------------------------------------- | --------------------------------------------------------- |
| Night base            | `#060a16`                                      | clear colour, deepest shadow                              |
| Ground                | `#070c18` → `#121d31`, moss `#14233a`          | forest floor, low contrast                                |
| Moonlight             | `#c4d4ff`                                      | key light tint, fog, ground light                         |
| Silver (the hunter)   | body `#e6ecf5`, shade `#9eabc0`, rim `#ffffff` | hunter, arrows, pickups                                   |
| Blood-red (threats)   | base `#c8323c`, rim `#ff6670`, darker per type | every enemy, telegraph, enemy projectile                  |
| Elite                 | body `#ff4d58`, outline `#fff2f3`              | brighter body plus pale outline                           |
| Violet (earned power) | `#9b6bff`                                      | perfect window, Focus, Deadeye, cards, evolutions, relics |
| Weak point            | `#ffe7a8`                                      | boss weak points only                                     |

**Violet means power you earned** (decided): the perfect window and release, Focus, Deadeye, upgrade cards, evolutions and relics. Elites stay in the red family. The GDD tri-colour table matches.

## Line and shading spec (render pipeline)

- **Outline.** 2 px at in-game size (4 px at the 2× render). The colour is the darkest tone of the material, not pure black: ink for silver is `#1b2233`, ink for red is `#3a0a10`.
- **Shading.** Two-band toon ramp, with the terminator at N·L = 0.35. The shadow tone is the lit tone shifted 15% toward `#1a2340` (cool shadows).
- **Rim.** Silver `#ffffff` at 60% where the view-space normal faces the moon side (top/right), 1–2 px wide.
- **Emissive.** The glowing quiver, eyes and weak points are flat emissive and feed the bloom pass.
- **Contact shadow.** A soft ellipse of 60% night base, offset down-right, scaled to the collision radius.

## Characters

### The hunter (default until named)

A hooded night hunter of the Silver Order (GDD section 2):

- deep hood shading the face, with two bright eyes visible;
- a long cloak that tails behind and swings on the run;
- a recurve bow held forward;
- a quiver of moonlight arrows glowing on the back, which is the emissive accent;
- a silver-white cloak lining, with dark slate boots and gloves.

The silhouette must read as "archer" without the bow.

### Enemies (GDD section 9 shape language)

| Enemy         | Silhouette                                           | Signature detail                                       |
| ------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| Husk          | hunched round blob, arms dragging                    | hollow glowing eye holes                               |
| Moonhound     | low, long wedge; legs splayed                        | red glint on crouch                                    |
| Wisp          | flame teardrop trailing tongues                      | hollow bright core; shimmers when faded                |
| Poacher       | upright, narrow, hood and bow line                   | mirrors the hunter, in red                             |
| Hollow Stag   | wide antlered mass                                   | antlers are the read                                   |
| Barrow Knight | broad shield slab facing forward                     | the shield covers the front 120° and must look like it |
| Barrow Worm   | segmented arc breaching the ground                   | dirt trail when underground                            |
| Changeling    | sits as a fake XP shard, then a spiky shard creature | the disguise must be almost, not quite, an XP shard    |

### Bosses (GDD section 10)

| Boss             | Read                                                                   | Weak point                                                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The Black Shuck  | giant spectral black hound, burning eyes, smoke mane                   | head / front arc                                                                                                                                                            |
| The Bramble King | crowned tangle of thorns, never turns                                  | the glowing **crown** on top of the sprite is a hit target of its own (`BOSSES[1].crown`, 148 px above the feet): an arrow through it deals full damage, the body takes 25% |
| The Night Hag    | flying hunched crone, tattered cloak, casts a moon-shadow              | the real one's ground shadow; heart lantern                                                                                                                                 |
| The Huntmaster   | antler-crowned mirror archer, cape; mounts a spectral stag in phase II | head and crown; red perfect-window flash when drawing                                                                                                                       |

## Animation set

Clips are rendered at 12 fps.

| Character     | Clips (frames)                                                           |
| ------------- | ------------------------------------------------------------------------ |
| Hunter        | idle 8, run 8, draw 6 (the last frame holds), release 4, dodge 6, hurt 3 |
| Regular enemy | move 6, telegraph 4, attack 4 (death is handled by VFX)                  |
| Boss          | idle/move 8, each telegraph 4–6, each attack 4–6, phase change 6         |

## Sprite and memory budget (2019 MacBook Pro floor)

- Render at 2× in-game size, so the hunter cell is 192 px and enemy cells are 96–160 px. Pack into 2048² atlas pages.
- Total sprite texture memory is capped at 96 MB (6 pages of RGBA). A page that would exceed this triggers a down-res or frame trim, never a silent overflow.
- Polycount targets for Meshy (offline renders only, never drawn live): hunter 15k triangles, enemies 4–8k, bosses 20k.
- Full-screen effects (bloom, fog, vignette) render at half resolution on Retina and scale with a quality setting.

## Production pipeline

1. **Concept.** Meshy text-to-image (`nano-banana-pro`), multi-view and A-pose, using the shared style prompt in `art-source/prompts.json`. One approved concept sheet per character.
2. **Model.** Meshy image-to-3d from the approved concept, smart topology at the triangle budget above, textured.
3. **Rig and animate.** Meshy rigging gives the walk and run clips; other clips come from the animation catalog, mapped to the set above.
4. **Render.** `tools/render-sprites` (three.js, headless) renders the 8 directions × clips with the toon ramp, ink outline, rim and contact shadow, and packs the frames into atlas pages and a manifest.
5. **Integrate.** The manifest feeds `src/data/art.ts`, and the renderer swaps procedural stand-ins for sprite sheets per character id.

**Credit savers.** Quadrupeds (Moonhound, Hollow Stag) are model-only: no remesh or rig. Their gallop, lunge and charge come from renderer-side motion (`tools/render-sprites/procedural.ts` `RIGID`). The Wisp and Barrow Worm are built in code. The Bramble King and Night Hag are model-only too (the King renders the front view only, since it never turns). Bosses reuse models where the read allows: the Huntmaster reuses the Poacher, and the Black Shuck reuses the Moonhound.

**Gate.** The hunter goes through the whole pipeline first and is judged in-game before any other character is made.
