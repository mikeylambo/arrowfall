# Arrowfall — GPT image spec

What to generate with GPT (image), in priority order. Each batch says what it is for, the exact size and format, and a prompt to paste. Every prompt starts with the **style block** below; paste it first, then the batch prompt.

**Delivery.** Upload the PNGs to `art-source/gpt/<batch>/` on GitHub (drag and drop on the `claude/arrowfall-v2-stabilize-visuals-stj0lv` branch), or attach them in chat. Name files as listed (`ground-moss.png`, …). Don't worry about perfect tiling, exact palette or trimming: I make tiles seamless, match the palette and cut sprites on our side.

**Rules that keep it in the game's look.**

- Only three hues may appear: cold moonlit blue-greys (the world), silver-white (the hunter's light), blood-red (threats). Violet is reserved for earned power and appears only where a batch says so.
- No text, no logos, no frames, no watermarks, no characters unless the batch asks for one.
- Low contrast for anything the player walks on; the hunter and enemies must stay the brightest things on screen.

---

## Style block (paste first, every time)

> Style: hand-painted chibi fantasy game art, cel-shaded with soft painterly texture, clean dark outlines, moonlit night. Palette strictly limited to cold desaturated navy and slate blue-greys (#060a16, #0c1424, #14233a, #2a3a55, #6f84a8), with pale moonlight highlights (#c4d4ff) on the top-right edges. Light comes from a full moon above and to the right. No warm colours, no green, no brown unless told otherwise. Matte, low-saturation, readable at small size. No text, no logo, no border, no watermark.

---

## Batch 1 — Ground textures (highest impact)

**For:** the forest floor, which fills most of the screen and is currently procedural noise. Tiled under everything.
**Format:** 1024×1024 PNG, **straight top-down view** (camera looking straight down, no horizon, no perspective), even lighting with no cast shadows, low contrast, with no single object that stands out (it repeats).

| File                | Prompt (after the style block)                                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ground-moor.png`   | Seamless tileable texture, top-down: dark moorland floor of short matted grass, moss patches and scattered tiny pebbles, very low contrast, deep navy slate.     |
| `ground-moss.png`   | Seamless tileable texture, top-down: thick soft moss carpet with a few curled fern fronds and fallen needles, very low contrast, cold blue-grey.                 |
| `ground-path.png`   | Seamless tileable texture, top-down: a worn forest footpath of packed earth, small flat stones and faint hoof prints, slightly lighter than the grass around it. |
| `ground-mire.png`   | Seamless tileable texture, top-down: shallow bog water over dark mud, reeds poking through, faint moon glints on the water surface, murky navy.                  |
| `ground-camp.png`   | Seamless tileable texture, top-down: trampled campsite earth with ash smudges, scattered twigs and a few leaves, cold blue-grey.                                 |
| `ground-barrow.png` | Seamless tileable texture, top-down: thin grass over stony burial ground, small grey stones and bone fragments half buried, cold slate.                          |

---

## Batch 2 — Ground decals (scatter details)

**For:** small details scattered over the ground so it never reads as a repeating tile. They don't block movement, so they must stay flat and quiet.
**Format:** 1024×1024 PNG with a **transparent background**, laid out as a **3×3 grid of nine separate variations** (I slice them). Viewed from above at a slight angle (about 60° down), flat to the ground, no cast shadows.

| File                  | Prompt (after the style block)                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `decal-ferns.png`     | A 3×3 grid of nine separate small fern and grass clumps on a transparent background, each different, flat on the ground.            |
| `decal-leaves.png`    | A 3×3 grid of nine separate small piles and scatters of fallen leaves and pine needles, transparent background.                     |
| `decal-mushrooms.png` | A 3×3 grid of nine separate small mushroom clusters and fairy rings, caps pale moonlit grey, transparent background.                |
| `decal-roots.png`     | A 3×3 grid of nine separate gnarled tree roots and fallen twigs lying flat on the ground, transparent background.                   |
| `decal-stones.png`    | A 3×3 grid of nine separate pebble groups and flat stepping stones, transparent background.                                         |
| `decal-bones.png`     | A 3×3 grid of nine separate small scatters of old animal bones, antler fragments and skulls, bleached grey, transparent background. |
| `decal-puddles.png`   | A 3×3 grid of nine separate shallow puddles reflecting faint moonlight, transparent background.                                     |

---

## Batch 3 — Landmark concepts (feed Meshy image-to-3D)

**For:** the eight Hollowmoor landmarks. Meshy turns one clean image into a 3D model, which goes through our sprite pipeline like the characters did. A GPT image here replaces Meshy's own concept step, so it skips the Meshy concept step (about 9 credits each); the model itself is about 30.
**Format:** 1024×1024 PNG, **one object, centred, fully in frame**, three-quarter view from the front-left and slightly above, **plain flat light-grey background**, soft even lighting, no cast shadow on the background, nothing else in the scene. For these, drop the palette lines of the style block: Meshy reads shapes better from naturally lit colour, and our pipeline recolours them.

| File                    | Prompt (after the style block, minus its palette lines)                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `landmark-moonwell.png` | A sacred stone well in a forest clearing: a ring of ten carved standing stones around a round pool of glowing moonlit water, crescent moon carvings, moss on the stones. |
| `landmark-stones.png`   | A ring of six weathered ancient standing stones (menhirs) of different heights, faint spiral carvings, lichen, one stone fallen over.                                    |
| `landmark-lodge.png`    | A ruined wooden hunting lodge: collapsed roof beams, one standing stone chimney, antlers over the broken door, overgrown with vines.                                     |
| `landmark-tower.png`    | A ruined round stone watchtower, half collapsed, broken spiral stair visible inside, a tattered banner pole on top.                                                      |
| `landmark-barrow.png`   | An ancient grassy burial mound with a stone-lined entrance passage, two upright stones flanking a dark doorway, small cairns around it.                                  |
| `landmark-shrine.png`   | A small open stone shrine of a silver knightly order: four pillars, a peaked roof, a silver crescent emblem, candles and offerings on a stone altar.                     |
| `landmark-campfire.png` | A hunter's campfire: a ring of stones around crossed logs, a cooking spit, a log bench and a bedroll beside it.                                                          |
| `landmark-tent.png`     | A small canvas hunter's tent with a wooden pole frame, a hide flap tied open, a lantern hanging at the entrance.                                                         |

Send the best take of each, plus a second angle if GPT gives you a good one (it helps Meshy).

---

## Batch 4 — Icons (upgrades, tools, evolutions, boons)

**For:** the level-up cards, pause build view and Altar, which currently use small vector glyphs.
**Format:** 1024×1024 PNG, **transparent background**, **3×3 grid of nine icons** (I slice them), each a single bold symbol, centred, silver-white line art with a dark navy fill. The one accent colour is violet `#9b6bff` and appears only on evolution icons (sheets E1–E2). Must read at 48 px.

Add to the style block: _"Game UI icon set, consistent line weight, one symbol per cell, no background shapes, no text."_ Then: _"A 3×3 grid of nine icons, in this order left to right, top to bottom: …"_ followed by one of these lists:

- **U1:** Quick Nock (arrow being notched fast), Draw Strength (flexed bow), Taut String (bowstring vibrating), Steady Hand (open palm, level line), Heavy Bow (thick bow with weight), Swift Bow (bow with speed lines), Eagle Eye (eagle eye), Broadhead (wide arrowhead), Far Sight (eye with distance rings)
- **U2:** Moonwell (well with moon), Executioner (arrow through a skull), Piercer (arrow through three discs), Longshaft (very long arrow), Broadshaft (thick arrow), Barbed Arrow (barbed head), Ember Arrow (arrow with flame), Frost Arrow (arrow with ice crystals), Storm Arrow (arrow with lightning)
- **U3:** Venom Arrow (arrow dripping venom), Rupture (cracked burst), Lightfoot (winged boot), Windstep (gust swirl around a foot), Evasive Shot (arrow leaving a dodging figure), Backstep (footprint with a back arrow), Phantom Step (ghostly footprint), Blood Trail (drops in a line), Predator (fanged eye)
- **U4:** Chain Kill (linked chain with arrow), Last Arrow (single arrow in an empty quiver), Ricochet (arrow bouncing off an angle), Splitshot (arrow splitting into three), Starfall (falling stars), Moonseeker (curving arrow toward a crescent), Echo Shot (arrow with echo ghosts), Still Water (calm ripple), Briar Shot (arrow wrapped in thorns)
- **U5:** Lifedraw (heart pierced by a glowing arrow), Moonraven (raven silhouette with moon), Thornsnare (thorn snare trap), Hunter's Lantern (hanging lantern), Might (clenched fist), Vigor (heart with plus), Swiftness (feather with speed lines), Keen Eye (eye with sparkle), Greed (silver coins)
- **U6:** Growth (sprout with arrow up), Magnet (horseshoe magnet), Reroll (circular arrows around a card), Banish (card with X), Skip (card with forward arrow), Fourth Card (four fanned cards), Second Wind (heart with a wing), blank, blank
- **E1 (evolutions, violet accent):** Barrage (rain of arrows), Worldpiercer (arrow through a planet), Deadshot (crosshair over a skull), Hellfire (flaming arrow spiral), Frostbite (shattering ice arrow), Thunderstorm (cloud with lightning arrows), Phantom Hunt (ghost hunter silhouette with bow), Red Harvest (scythe moon dripping red), Apex Hunter (crowned bow)

---

## Batch 5 — Screen backgrounds (lower priority)

**For:** full-screen menus behind the panels, in the same style as the title key art.
**Format:** 1536×1024 PNG (landscape). Keep the left third dark and empty, since menus sit there.

| File            | Prompt (after the style block)                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `bg-camp.png`   | Wide shot of a hunter's camp in a moonlit forest clearing: campfire glow, tents, a bow rack, a target, giant moon behind pines. |
| `bg-trail.png`  | A forest trail leading into a misty moonlit moor, a signpost, distant red eyes in the dark trees.                               |
| `bg-altar.png`  | A stone altar under a starry sky where constellations glow faint violet, a silver bowl of moonlight on the altar.               |
| `bg-fallen.png` | A dropped bow and scattered arrows on mossy ground under a pale moon, red eyes watching from the trees (game-over screen).      |

---

## Status (after round 1)

Batches 1–5 are in the game. Batches 1, 2, 4 and 5 were used as delivered; batch 3 is used as 2D sprites (no Meshy). Still open: **U1 redo**, **U7** (three icons the first spec missed), **Batch 6** (forest) and **Batch 7** (camp stations). Everything below uses the same style block.

---

## Batch 4 redo — U1 and U7 icons

**Why the redo:** the first U1 came back with a checkerboard _painted into_ the image instead of real transparency, and in a flatter style than U2–U6. Match the other sheets exactly; a solid background is fine because I place the icons on dark card slots anyway.

**Format:** 1024×1024 PNG, **3×3 grid of nine icons** (I slice them), each icon on its **own solid dark navy square (#070b16), edge to edge, no gaps or gutters, no checkerboard**. Same rendering as the U2–U6 sheets: silver-white and slate-blue painted symbol with soft moonlit glow, dark outline, bold silhouette that reads at 48 px. No text.

Prompt (after the style block):

> Game UI icon sheet: a 3×3 grid of nine square icons, each filling its cell on a solid dark navy background (#070b16), no borders between cells, no checkerboard, no transparency pattern. Painted silver-white and slate-blue symbols with a soft moonlit glow and dark outlines, matching a set of fantasy archery skill icons. In this order, left to right, top to bottom: …

- **U1:** Quick Nock (a hand snapping an arrow onto a bowstring, speed lines), Draw Strength (a bow bent deep, string pulled to the cheek), Taut String (a bowstring vibrating with ripple lines), Steady Hand (an open gloved palm, perfectly level, a calm horizontal line through it), Heavy Bow (a thick recurve bow with iron fittings), Swift Bow (a slim bow with wind streaks), Eagle Eye (an eagle's head, eye glinting), Broadhead (a wide heavy arrowhead), Far Sight (an eye with concentric distance rings and a small arrow on the horizon)
- **U7** (only three cells; leave the other six as plain navy): Hunter's Mark (a target sigil branded over a wolf's head), Fletcher's Craft (crossed feathers and a small knife over an arrow shaft), Heaven's Volley (**evolution: add violet #9b6bff accent**: a fan of glowing arrows falling from a crescent moon)

---

## Batch 6 — Forest (replaces the low-poly trees and rocks)

**For:** the cover the hunter fights around: trees, dead trees, boulders, stumps. These are the most common objects in the world, so they decide the look more than anything else after the ground. They block arrows and movement in game.
**Format:** 1024×1024 PNG with a **real transparent background** (ask for "transparent PNG, no background"; if GPT paints a checkerboard, ask again for a **plain flat light-grey background** instead and I will key it out). **3×3 grid of nine separate variations**, each fully inside its cell with a little space around it. Viewed from the front and **above at about 45°** (same angle as the barrow mound and shrine you made), standing upright, base at the bottom of the cell, **no ground patch, no cast shadow** (I add a shadow under each).

Add to the style block: _"Top-down three-quarter view game sprites for a dark moonlit forest, matching hand-painted landmark sprites; muted cold slate-blue and navy foliage with pale moonlight on the top-right edges; dark outline; readable silhouettes; no ground, no shadow, transparent background."_

| File                | Prompt (after the style block)                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `forest-pines.png`  | A 3×3 grid of nine separate tall pine and fir trees, varied heights and shapes (one leaning, one young, one ancient and broad), dense dark blue-green needles kept very desaturated. |
| `forest-oaks.png`   | A 3×3 grid of nine separate broad leafy forest trees (oak, ash, beech), round heavy canopies with a visible trunk base, gnarled roots at the foot.                                   |
| `forest-dead.png`   | A 3×3 grid of nine separate dead and twisted trees: bare clawing branches, hollow trunks, one split by lightning, one with a hanging lantern, one with a raven perched.              |
| `forest-rocks.png`  | A 3×3 grid of nine separate boulders and rock clusters, mossy, some cracked, two tall jagged standing rocks, one flat slab with a carved crescent moon.                              |
| `forest-stumps.png` | A 3×3 grid of nine separate tree stumps, fallen logs and root tangles, some overgrown with ferns and pale mushrooms, one hollow log big enough to crawl through.                     |

**Size relationship:** the hunter is about one third the height of a pine. Keep the trees tall and narrow at the base: the trunk base is the part that blocks movement, and a wide skirt of foliage at the bottom would look like it should block too.

---

## Batch 7 — Camp stations (replace the hand-drawn camp props)

**For:** the six stations at the Hunter's Camp. Two of them show progress, so they need to be painted **empty**: I hang the trophies and bows on them in code as you unlock them.
**Format:** 1024×1024 PNG, **one object, centred**, same three-quarter view from above as the camp tent and campfire you made, **plain flat light-grey background** (keyed out the same way as the landmarks). Naturally lit colour is fine (I recolour), but keep it wood, iron, stone and canvas: no bright paint.

| File                | Prompt (after the style block, minus its palette lines)                                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `camp-fletcher.png` | A fletcher's workbench: a heavy wooden bench with feathers, arrow shafts, a small knife and twine on it, and behind it an **empty** wooden bow rack with six empty pegs.     |
| `camp-target.png`   | A straw archery target on a wooden tripod stand, painted rings faded, two arrows stuck in it, a hay bale at its foot.                                                        |
| `camp-altar.png`    | A low round stone altar with a shallow silver bowl on top, faint moon carvings on its sides, a few candles at its base. Nothing floating above it.                           |
| `camp-trophies.png` | A rough timber trophy wall: two posts, a crossbeam and a plank backboard with **empty** iron hooks and pegs, nothing hanging on it.                                          |
| `camp-log.png`      | A wooden lectern holding a large open leather-bound book, a quill in an inkpot and a lit candle on the lectern's edge.                                                       |
| `camp-signpost.png` | A weathered wooden signpost with two arrow-shaped boards pointing in different directions, a small crescent moon carved into the top board, a lantern hanging from the post. |

If you have energy for one extra: `camp-banner.png`, a tall pole with a tattered hunt banner, used to mark each Moon Phase you have opened.

---

## What happens next

For the remaining batches: drop the PNGs (or a zip) here in chat as before. U1/U7 slot straight into the icon atlas; batch 6 replaces the forest sprites; batch 7 replaces the camp props, with trophies, bows and pennants still added as you progress.

Round 1, for reference:

1. Batch 1: I make each texture seamless, match it to the palette and replace the procedural floor. Each landmark area gets its own ground (moss in the Dead Grove, mire water in the Mire, path along the trails).
2. Batch 2: scattered by seed over the moor, culled off screen like the existing decals.
3. Batch 3: each image goes to Meshy image-to-3D (~30 credits each), then through the sprite pipeline.
4. Batch 4: sliced into an icon atlas for the cards, the build view and the Altar.
5. Batch 5: behind the menu panels, with a dark scrim so text stays readable.
