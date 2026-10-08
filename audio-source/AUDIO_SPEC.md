# Arrowfall — audio generation spec

Every sound in the game is currently synthesised in code. This spec asks for real recordings in the same order of importance as the play: the bow first, then hits and kills, then threats, then the world and menus, then music. Gameplay already emits a semantic event for each of these (the **Event** column), so files drop straight in; anything not delivered keeps its synth fallback.

## How to make them

- **SFX:** a text-to-sound-effect generator (ElevenLabs Sound Effects works well). Generate **3–4 takes per prompt** and send all of them: I pick, trim and layer (a snap from one take and a shimmer tail from another often beats either alone). Variants also stop repeated sounds from feeling mechanical, so for anything marked **×3** I keep three takes and rotate them.
- **Music:** an instrumental music generator (Suno, Udio or ElevenLabs Music). Instrumental only, no vocals. Ask for stems if the tool offers them; a full mix is fine otherwise.
- **Format:** WAV or MP3, any sample rate. I convert to OGG, normalise loudness and cut loops.
- **Naming:** use the file name in the table (takes as `perfect-loose-1.wav`, `-2`, …). A zip per batch, as with the art.

**Style block** (prepend to every SFX prompt): _"Dark fantasy game sound effect, close and dry, crisp transient, no music, no voice, no reverb tail unless stated."_

---

## Batch A — The bow (the most important sounds in the game)

The player hears these hundreds of times per run. They should feel tactile and satisfying, never shrill.

| File | Event | Prompt (after the style block) |
| --- | --- | --- |
| `draw-creak` | draw held | Slow creak of a wooden recurve bow being drawn, string tightening, leather grip, 1.5 seconds, rising tension, seamless to loop. |
| `perfect-window` | `bow.window` | A single soft silver bell chime, clean and short, like a tiny struck crystal, 0.4 seconds. **The most important sound in the game.** Gentle, not piercing. |
| `perfect-loose` ×3 | `bow.perfect` | A bowstring released with a sharp crisp snap, an arrow whooshing away fast, with a faint bright shimmer at the end, 0.6 seconds. |
| `full-loose` ×3 | `bow.full` | A bowstring released with a solid thick snap and a fast arrow whoosh, no shimmer, 0.5 seconds. |
| `quick-loose` ×3 | `bow.quick` | A light weak flick of a half-drawn bowstring and a short soft whoosh, 0.3 seconds. |
| `draw-cancel` | dodge while drawing | A bowstring eased back down slowly and softly, a small wooden creak, 0.4 seconds. |
| `dodge` ×3 | `player.dodge` | A quick cloth and leather rustle with a fast body whoosh and one light footstep on moss, 0.4 seconds. |

## Batch B — Hits, kills and reward

| File | Event | Prompt (after the style block) |
| --- | --- | --- |
| `hit-flesh` ×3 | `enemy.hit.flesh` | An arrow thudding into a creature, a dull wet punch, short, 0.25 seconds. |
| `hit-armor` ×3 | `enemy.hit.armor` | An arrow glancing off old iron armour, a sharp metallic clank and ring, 0.4 seconds. |
| `hit-spectral` | `enemy.hit.spectral` | An arrow passing through a ghost, an airy glassy shimmer with a soft hiss, 0.4 seconds. |
| `hit-bone` ×3 | `enemy.hit.bone` | An arrow striking antler and bone, a dry hollow crack, 0.25 seconds. |
| `crit` ×3 | `hit.crit` | A heavy arrow impact with a deep punchy thump and a crack, very satisfying, 0.35 seconds. |
| `kill` ×3 | `enemy.kill.*` | A dark creature collapsing into dust and shadow, a soft crumbling burst with a breathy exhale, 0.5 seconds. |
| `kill-elite` | `enemy.elite.kill` | A powerful dark creature dying, a heavy crumbling burst with a low rumble and a rising ghostly whoosh, 1 second. |
| `xp` ×3 | `pickup.xp` | A tiny soft crystalline tick, like a grain of moonlight being collected, 0.1 seconds, very quiet. |
| `heal` | `pickup.heal` | A soft warm rising shimmer, gentle and calm, 0.6 seconds. |
| `level-up` | `level.up` | A rising magical swell of silver bells ending in a bright soft chord, 1.2 seconds. |
| `relic` | `relic.open` / `evolution.unlocked` | An ancient chest lid creaking open with a burst of radiant choir-like shimmer, 1.5 seconds, wondrous. |

## Batch C — Focus and Deadeye

| File | Event | Prompt (after the style block) |
| --- | --- | --- |
| `deadeye-enter` | `deadeye.enter` | Time slowing down: a deep low whoosh that falls in pitch, the world muffling, a faint heartbeat, 1 second. |
| `deadeye-mark` ×3 | `deadeye.mark` | A soft violet magical ping marking a target, small and precise, 0.2 seconds. |
| `deadeye-release` | `deadeye.release` | A volley of many arrows released at once, a rapid ripple of bowstring snaps and whooshes, 1 second. |
| `deadeye-strike` ×3 | `deadeye.strike` | A magical arrow striking home with a bright impact and a violet shimmer, 0.3 seconds. |

## Batch D — Threats and telegraphs (they warn the player, so each must be distinct)

| File | Event | Prompt (after the style block) |
| --- | --- | --- |
| `telegraph` | `enemy.telegraph` | A short tense low hiss rising sharply, a warning of an incoming attack, 0.5 seconds. |
| `enemy-loose` ×3 | `enemy.loose` | A distant crude crossbow or bow firing, a dull twang, 0.3 seconds. |
| `hound-crouch` | `enemy.hound.crouch` | A large wolf-like beast growling low and crouching to pounce, 0.8 seconds. |
| `hurt` ×3 | `player.hurt` | A sharp painful hit on a hooded hunter, a muffled grunt-free impact with cloth and a low thud, 0.3 seconds. No voice. |
| `death` | `player.death` | A heavy body falling to the forest floor, a long exhale of wind, the world going quiet, 1.5 seconds. |
| `formation` | `formation.arrival` | Many creatures closing in through the dark forest, rustling undergrowth and low snarls building, 2 seconds. |
| `boss-intro` | `boss.intro` | A huge ancient horror arriving: a deep booming impact, a distant roar and a rising dread drone, 3 seconds. |
| `boss-phase` | `boss.phase` | A monster enraged: a heavy roar layered with a cracking burst of dark energy, 1.5 seconds. |
| `boss-fall` | `boss.fall` | A colossal creature collapsing, a long thunderous crumble fading into wind, 3 seconds. |

## Batch E — World and menus

| File | Event | Prompt (after the style block) |
| --- | --- | --- |
| `midnight` | `world.midnight` | A distant church bell tolling once at midnight across a misty moor, long reverb tail allowed, 4 seconds. |
| `discover` | `world.discover` | A soft mysterious harp shimmer, a sense of finding an old place, 1.2 seconds. |
| `event` | `world.event` | A low ominous horn sounding far away across the moor, reverb allowed, 2 seconds. |
| `ui-select` | `ui.select` | A soft dry wooden tick, a menu cursor moving, 0.1 seconds. |
| `ui-confirm` | `ui.confirm` | A soft wooden knock with a faint silver ting, confirming a choice, 0.25 seconds. |
| `ambience-moor` | (loop) | Night ambience on a misty moor: soft wind through grass, distant owls, very occasional far-off wolf, crickets, seamless loop, 60 seconds. Reverb allowed. |
| `ambience-camp` | (loop) | A small campfire crackling at night in a forest clearing, gentle wind in trees, seamless loop, 60 seconds. Reverb allowed. |

---

## Music

D minor, around 80 BPM, dark folk-orchestral: low strings, frame drum, hurdy-gurdy or nyckelharpa drone, solo cello or wooden flute for melody, sparse choir pads. Instrumental only. Each piece should loop cleanly.

| File | Use | Prompt |
| --- | --- | --- |
| `music-hunt-early` | first minutes of a hunt | Dark folk orchestral game music, D minor, 80 BPM, sparse and tense, low string drone, soft frame drum heartbeat, distant wooden flute, misty moonlit moor, instrumental, loopable, 2 minutes. |
| `music-hunt-late` | after midnight | Same style and key, building intensity: driving frame drums, hurdy-gurdy, low choir, urgent cello ostinato, instrumental, loopable, 2 minutes. |
| `music-boss` | boss fights | Same style and key, epic and dangerous: pounding war drums, aggressive low strings, choir, dissonant brass swells, instrumental, loopable, 2 minutes. |
| `music-camp` | camp and menus | Same style and key, calm and warm: solo nyckelharpa or cello over a soft drone, campfire mood, gentle and reflective, instrumental, loopable, 2 minutes. |
| `music-dawn` | surviving the night | Same style, resolving to D major: a hopeful rising string swell with choir, sunrise after a long night, 30 seconds, ends cleanly. |

If the tool gives stems (drums, bass, melody, other), send them: the game layers stems as the night deepens instead of cutting between tracks.

---

## What happens next

Drop each batch here as a zip. I add a sample player under the existing audio contract: semantic event → file with rotating takes, pitch and volume jitter, buses for music, SFX and UI, and the current synth as the fallback for anything missing. The perfect-window chime keeps following the music's key. Batch A alone will change how the game feels the most.
