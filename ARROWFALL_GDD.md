# Arrowfall — Game Design Document v1

Sep 26, 2026 · @Michael

## 1. Vision

Arrowfall is a top-down survivors-like where archery itself is the game: you draw, time, and loose every arrow while a folklore horde pours out of the forest under a cursed moon.

**Tagline:** 20 Minutes. One Hunter. Endless Arrows.

**Target:** Steam + Steam Deck (primary), web build for development and demos. Desktop first; gamepad is a first-class input. Keyboard + mouse fully supported.

### Pillars

1. **The Draw.** Every shot is a commitment. Drawing slows you, a perfect window at full draw rewards timing, and a dodge cancels the draw. This is the skill ceiling.
2. **Deadeye.** Perfect looses fill Focus. Spend it to slow time, sweep marks across the horde, and loose them all at once. The skill you show on every shot pays off in one spectacle moment.
3. **Range is a resource.** A visible sweet-spot band around the hunter rewards holding the right distance. Too close is dangerous and weak; the band is where crits live.

Everything that is not the bow is automatic: the Hunter's Tools (raven, snares, lantern) fight on their own, preserving the genre's power-fantasy autopilot around a manual core.

### Position

- **Halls of Torment** has an archer class; Arrowfall is an archer _game_.
- **20 Minutes Till Dawn** is the closest competitor (manual aim, 20-minute runs). It uses guns with a reload rhythm and a flat arena. Arrowfall differs on the verb (draw commitment and a true perfect window), the payoff (manual Deadeye screen-clears), and the space (range bands and a forest with cover).
- **Archero** proved touch archery works; a later mobile port maps cleanly (drag-aim, hold to draw, lift to loose).

### Design laws

- **No useless upgrades.** Every card must change how you play or what you aim for.
- **Nothing teleports.** Every threat is telegraphed and readable.
- **Verified, not reported.** A feature is done when the player can see it do its job in a real run, not when the code exists.

## 2. Fiction & tone

Once a generation the Hunt Moon rises wrong: cracked, bleeding light, and everything in the old stories crawls out beneath it. You are the last of an order of night hunters who draw moonlight itself as arrows. A run is one night; survive until dawn, and face what the moon has become.

**Tone:** mythic, lonely, and beautiful rather than grimdark. Folklore, not gore. The forest is gorgeous and wrong. All-ages readable.

**The night is the clock.** The 20-minute run maps to one night: moonrise, the first howl, deep night, midnight (the moon turns red), the witching hours, false dawn, and the final hunt. The moon's position in the sky is the timer.

### Tri-color meaning

| Color     | Means                 | Used for                                                                                |
| --------- | --------------------- | --------------------------------------------------------------------------------------- |
| Silver    | Your light            | The hunter, arrows, Moonraven, XP and pickups                                           |
| Blood-red | The moon's corruption | Every enemy threat **including elites**, enemy projectiles, telegraphs, low-HP warnings |
| Violet    | Power you earned      | The perfect window and release, Focus, Deadeye, upgrade cards, evolutions, relics       |

Violet pairs the core skill (the perfect release) with every reward it leads to, so the colour itself becomes the reward signal. Elites stay red because at 350 enemies "red means danger" must have no exceptions.

Before midnight the world leans cold silver-blue. At the 10:00 moon turn the sky and ambient light shift toward blood-red, and the palette never fully recovers until dawn.

### The hunter

A hooded night hunter of the Silver Order. Silhouette first: long cloak, bow held forward, a glowing quiver. No name locked yet (see Open items).

## 3. Core combat

The loop is DISTANCE → AIM → DRAW → RELEASE → REPOSITION, and every number below is a starting value for tuning. Values are for the starter Hunter's Recurve.

### Controls

| Action       | Mouse + keyboard          | Gamepad                                   |
| ------------ | ------------------------- | ----------------------------------------- |
| Move         | WASD                      | Left stick                                |
| Aim          | Mouse (free aim)          | Right stick (soft aim assist, toggleable) |
| Draw / loose | Hold / release left mouse | Hold / release RT                         |
| Dodge        | Space                     | LT or A                                   |
| Deadeye      | Right mouse or E          | RB                                        |
| Pause        | Esc                       | Start                                     |

Gamepad: right-trigger rumble builds with draw tension and snaps at the perfect window.

### The Draw

- **Draw time:** 0.60 s from rest to full draw.
- **Damage by draw:** quick release (under 50% draw) deals 40% damage; damage scales linearly to 100% at full draw.
- **Perfect window:** opens the instant full draw is reached and lasts 110 ms. A release inside it is a **perfect loose**: guaranteed crit (×2.0), +1 pierce, +12 Focus, faster arrow (+25% speed), and the perfect audio-visual cue.
- **Overdraw:** after the window closes, full-draw damage holds but aim sway ramps up over 0.35 s.
- **Hold-to-auto-loose:** if the button is still held when overdraw ends, the bow auto-looses a full-draw shot (no perfect) and immediately begins the next draw. Holding the button is a steady, playable stream; releasing in the window is the skill layer. This prevents hand fatigue across \~20 minutes.
- **Movement while drawing:** 65% speed. Move speed returns instantly on release.
- **Dodge cancels the draw** (draw resets to 0).

### Dodge

A short roll: 140 px over 0.18 s, fully invulnerable for its duration, 1.2 s cooldown. Direction follows movement input, or aim direction if standing still.

### Range bands

A faint ring around the hunter shows the sweet-spot band; distance is measured at impact.

| Band       | Recurve distance | Damage | Bonus                               |
| ---------- | ---------------- | ------ | ----------------------------------- |
| Close      | under 180 px     | 80%    | none; the danger zone               |
| Sweet spot | 260–460 px       | 115%   | +10% crit chance; hits flash silver |
| Far        | over 460 px      | 100%   | none                                |

The band between 180 and 260 px is neutral (100%). Each bow shifts the band (see Bows).

### Focus & Deadeye

- **Focus:** 0–100. Perfect loose +12. Full-draw hit +3. Elite kill +8. Focus does not decay.
- **Trigger at 100:** time slows to 20% for 3.0 real seconds. The reticle becomes a painting brush (60 px radius); every enemy it passes over is marked, up to the bow's mark cap (Recurve: 8). Marks paint with a rising tick.
- **Release:** press Deadeye again or wait out the timer. Every mark receives its own perfect arrow at ×1.5 damage, fired from the hunter. Each target gets a distinct streak and impact.
- **Gamepad painting:** sweep the right stick; a gentle magnetism pulls the brush toward unmarked enemies.
- Level-up and pause cannot interrupt Deadeye; they wait until it ends.

### Player baseline

100 HP, 240 px/s move speed, 0.5 s invulnerability after taking a hit. No passive regen; healing comes from Quiet Grove shrines, rare Moonberry pickups, and specific upgrades.

## 4. Bows

You choose one bow at Camp before each hunt and keep it all run; bows differ by draw profile, not by stat totals. The Recurve is owned from the start; the other five unlock through Deeds.

| Bow                      | Draw time | Perfect window      | Sweet spot | Move while drawing | Deadeye marks | Signature                                                                                    |
| ------------------------ | --------- | ------------------- | ---------- | ------------------ | ------------- | -------------------------------------------------------------------------------------------- |
| **Hunter's Recurve**     | 0.60 s    | 110 ms              | 260–460 px | 65%                | 8             | Balanced; teaches every system                                                               |
| **Sparrow** (shortbow)   | 0.35 s    | 140 ms              | 140–300 px | 85%                | 14 (×0.8 dmg) | Three perfects in a row fire a free instant arrow                                            |
| **Nightreach** (longbow) | 0.85 s    | 110 ms              | 420–680 px | 45%                | 5             | +1 base pierce; +20% damage per 300 px an arrow travels                                      |
| **Let-Off** (compound)   | 0.60 s    | 60 ms               | 260–460 px | 60%                | 8             | No overdraw sway and no auto-loose timer: hold at full draw forever. Perfect crits ×3.0      |
| **Oathbreaker** (warbow) | 1.00 s    | 110 ms              | 220–420 px | 35%                | 4             | Ignores armor; heavy knockback; perfects stagger for 0.6 s. Deadeye marks knock enemies away |
| **Moonbow** (arcane)     | 0.60 s    | 110 ms, no overdraw | 260–460 px | 70%                | 10            | Silver arrows curve gently toward the reticle; every hit builds +1 Focus                     |

The Let-Off name comes from real compound bows, whose let-off reduces holding weight at full draw. Its auto-loose applies only when the player enables the Auto-Loose accessibility option.

### Unlock deeds

| Bow         | Unlock by                                         |
| ----------- | ------------------------------------------------- |
| Sparrow     | Land 300 perfect looses (lifetime)                |
| Nightreach  | Kill 500 enemies inside the sweet spot (lifetime) |
| Let-Off     | Chain 10 perfect looses in a row                  |
| Oathbreaker | Defeat the Bramble King                           |
| Moonbow     | Complete a hunt (kill the Huntmaster)             |

## 5. Upgrades

The pool holds 31 upgrades in six families; 20 are available from the first run and 11 are added by Deeds (marked **Deed**).

### Card rules

- Each level-up pauses the run and offers **3 cards** (a 4th slot is a Camp boon). Pick one.
- Cards are drawn from upgrades not yet at rank cap, plus Hunter's Tools (section 7). Maxed upgrades leave the pool, so a dead pick is impossible.
- **Rarity** weights the draw and colors the card frame: Common 60%, Uncommon 30%, Rare 10%. **Legendary** is reserved for evolutions (section 6).
- If every upgrade and tool is maxed, cards become Moonsilver (+15) or Moonberry (heal 30).
- Camp boons add Reroll, Banish (remove an upgrade from this run's pool), and Skip.

### Bowcraft

| Upgrade          | Rarity   | Cap | Effect per rank                     |
| ---------------- | -------- | --- | ----------------------------------- |
| Quick Nock       | Common   | 5   | +8% draw speed                      |
| Draw Strength    | Common   | 5   | +12% full-draw damage               |
| Taut String      | Common   | 3   | +15% arrow speed                    |
| Steady Hand      | Uncommon | 3   | +25% perfect-window length          |
| Heavy Bow (Deed) | Uncommon | 1   | +25% damage, −10% draw speed        |
| Swift Bow (Deed) | Uncommon | 1   | +20% draw speed, −10% perfect bonus |

### Precision

| Upgrade       | Rarity   | Cap | Effect per rank                                                     |
| ------------- | -------- | --- | ------------------------------------------------------------------- |
| Eagle Eye     | Common   | 5   | +5% crit chance                                                     |
| Broadhead     | Common   | 5   | +20% crit damage                                                    |
| Far Sight     | Uncommon | 3   | Sweet-spot band +15% wider and +10% stronger                        |
| Moonwell      | Uncommon | 3   | +25% Focus gain                                                     |
| Hunter's Mark | Uncommon | 1   | Every 4 s the toughest enemy on screen is Marked: +30% damage taken |
| Executioner   | Uncommon | 1   | +50% damage to enemies under 20% HP                                 |

### Arrowcraft

| Upgrade          | Rarity   | Cap | Effect per rank                    |
| ---------------- | -------- | --- | ---------------------------------- |
| Fletcher's Craft | Rare     | 4   | +1 arrow per loose (fan spread)    |
| Piercer          | Common   | 4   | +1 pierce                          |
| Longshaft        | Common   | 3   | +20% range                         |
| Broadshaft       | Common   | 3   | +25% arrow hitbox                  |
| Barbed Arrow     | Uncommon | 1   | Hits apply Bleed (damage over 3 s) |

### Elemental

| Upgrade            | Rarity   | Cap | Effect per rank                                   |
| ------------------ | -------- | --- | ------------------------------------------------- |
| Ember Arrow        | Uncommon | 1   | Hits ignite: burn for 2 s                         |
| Frost Arrow        | Uncommon | 1   | Hits slow 30% for 1.5 s                           |
| Storm Arrow        | Uncommon | 1   | 20% chance to chain lightning to 2 nearby enemies |
| Venom Arrow (Deed) | Uncommon | 1   | Hits add a poison stack (max 5)                   |
| Rupture (Deed)     | Rare     | 1   | +40% damage to enemies with 2+ status effects     |

### Mobility

| Upgrade             | Rarity   | Cap | Effect per rank                                                     |
| ------------------- | -------- | --- | ------------------------------------------------------------------- |
| Lightfoot           | Common   | 5   | +8% move speed                                                      |
| Windstep            | Uncommon | 1   | +20% move speed for 1 s after each loose                            |
| Evasive Shot        | Uncommon | 1   | The first loose within 0.5 s after a dodge is automatically perfect |
| Backstep (Deed)     | Uncommon | 1   | Dodge leaves a trail of 5 arrows fanning backward                   |
| Phantom Step (Deed) | Rare     | 1   | Dodge leaves a spectral afterimage that fires your next loose too   |

### Hunting

| Upgrade            | Rarity   | Cap | Effect per rank                                                                            |
| ------------------ | -------- | --- | ------------------------------------------------------------------------------------------ |
| Blood Trail (Deed) | Uncommon | 1   | Bleeding enemies take +25% damage                                                          |
| Predator (Deed)    | Uncommon | 3   | Kills grant +3% move speed for 3 s (stacks 5)                                              |
| Chain Kill (Deed)  | Uncommon | 1   | Kills within 1.5 s of each other build +4% damage (max +40%); resets when the chain breaks |
| Last Arrow (Deed)  | Uncommon | 1   | Every 10th loose deals ×3 damage and pierces everything                                    |

The 20 starting upgrades are every card not marked Deed.

### Behaviour upgrades (v2)

Eight cards that change how arrows act rather than adding percentages; all are available from the first run.

| Upgrade     | Family     | Rarity   | Cap | Effect per rank                                                                        |
| ----------- | ---------- | -------- | --- | -------------------------------------------------------------------------------------- |
| Ricochet    | Arrowcraft | Uncommon | 2   | An arrow that kills bounces to the nearest enemy it has not hit (+1 bounce per rank)   |
| Splitshot   | Arrowcraft | Uncommon | 3   | On its first hit an arrow splits into 2 shards at 30% damage (+10% per rank)           |
| Starfall    | Arrowcraft | Rare     | 1   | Every 5th perfect loose calls a star onto the aim point: 90 px blast at ×3 base damage |
| Moonseeker  | Precision  | Rare     | 1   | Perfect arrows bend toward the nearest enemy in flight                                 |
| Echo Shot   | Precision  | Rare     | 1   | Crits loose a ghost arrow from the struck enemy at the next one (50% damage)           |
| Still Water | Bowcraft   | Uncommon | 3   | +15% damage after standing still for 0.8 s                                             |
| Briar Shot  | Hunting    | Uncommon | 1   | Perfect hits root their target for 0.8 s                                               |
| Lifedraw    | Hunting    | Uncommon | 3   | Every 15 kills heal 2 HP                                                               |

## 6. Evolutions

Ten named evolutions transform the bow when you hold the right upgrades; they are offered as Legendary cards, never applied automatically.

### Offer rules

- An evolution becomes **eligible** when every ingredient upgrade is owned (any rank).
- When eligible, the next level-up replaces one card with the Legendary evolution card. Declining keeps it eligible for later offers.
- **Relic chests** from the 5:00, 10:00 and 15:00 mini-bosses guarantee an evolution choice: pick 1 of up to 2 eligible evolutions. With none eligible, the chest offers 1 of 3 Rare upgrades.
- Ingredients stay owned after evolving. No limit on evolutions per run.
- Undiscovered evolutions appear as silhouettes in the Hunter's Log, with one ingredient revealed.

| Evolution           | Ingredients                                  | Effect                                                                                                         |
| ------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Barrage**         | Fletcher's Craft + Quick Nock                | Looses fire a widening fan; each consecutive loose within 1 s adds +1 arrow (max +6)                           |
| **Worldpiercer**    | Piercer + Longshaft + Draw Strength          | Full-draw arrows pierce infinitely, cross the whole screen, and gain +10% damage per enemy pierced             |
| **Deadshot**        | Eagle Eye + Broadhead + Far Sight            | Perfect crits in the sweet spot or beyond detonate: 80 px blast at 60% of the hit                              |
| **Hellfire**        | Ember Arrow + Broadhead + Rupture            | Crits cause burning explosions; burning enemies spread fire to neighbors on death                              |
| **Frostbite**       | Frost Arrow + Far Sight                      | Full-draw hits beyond the sweet spot freeze targets for 1.5 s; frozen enemies take +100% damage                |
| **Thunderstorm**    | Storm Arrow + Fletcher's Craft + Rupture     | Lightning chains always trigger and jump up to 6 times, each jump +15% damage                                  |
| **Phantom Hunt**    | Phantom Step + Evasive Shot + Windstep       | Each dodge summons a spectral hunter for 4 s that mirrors your looses (max 3 at once)                          |
| **Red Harvest**     | Barbed Arrow + Blood Trail + Executioner     | Bleeding enemies fling blood darts at neighbors every second; bleeding kills infect the nearest 3 enemies      |
| **Apex Hunter**     | Hunter's Mark + Predator + Chain Kill        | Killing a Marked enemy instantly marks the next, extends the kill chain by 2 s, and grants +15% damage for 5 s |
| **Heaven's Volley** | Fletcher's Craft + Draw Strength + Longshaft | Full-draw looses call a rain of 12 silver arrows on the aim point; perfect looses call 36 across a wider area  |

### Synergy rules

Evolutions are built as **rules on arrows and hits**, not one-off effects, so combinations emerge without special cases:

- Anything that spawns an arrow (Barrage fan, Phantom Hunt ghosts, Heaven's Volley rain, Deadeye volley) inherits the player's on-hit effects.
- Chained or area damage (Thunderstorm, Deadshot, Hellfire) counts as a hit for status effects but not for Focus, to keep Deadeye earned.
- Intended showcase combos: Barrage + Thunderstorm, Phantom Hunt + Barrage, Worldpiercer + Hellfire, Deadshot + Frostbite.

## 7. Hunter's Tools

Three auto-acting tools fight on their own while you work the bow; they enter the same level-up card pool as upgrades, rank 1–5 each, and all three can be owned in one run.

| Tool                 | Rank 1                                                                                           | Per rank                          | Rank 5 bonus                                                                   | Fantasy                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| **Moonraven**        | A celestial raven circles you and dives the nearest enemy every 2.5 s for 30 damage              | −0.3 s dive interval, +15% damage | Prioritizes Marked enemies and fetches XP shards within 300 px on its way back | The hunter's familiar; silver starlit feathers leaving a faint constellation trail |
| **Thornsnare**       | Every 5 s drops a snare at your feet; the first enemy to cross is rooted 2 s and takes 20 damage | +1 snare held, −0.5 s interval    | Snares explode into bramble on trigger, rooting everything within 90 px        | Kiting tool: lay traps along your retreat line                                     |
| **Hunter's Lantern** | A 140 px aura of silver light: 6 damage/s to enemies inside; Wisps inside cannot fade            | +20 px radius, +3 damage/s        | Burns away Fog Bank around you and reveals Changelings                         | Survival light against the dark                                                    |

Rules: tools never consume Focus and never trigger perfect-loose effects. Tool damage counts as hits for status effects only when an evolution says so. The Moonraven's constellation trail stays silver; tools never introduce new colors.

## 8. Run structure

One run is one night: 20 minutes from moonrise to dawn, with fixed set pieces at 5:00, 10:00, 15:00 and 19:00 and a power arc of Hunter → Archer → Master → Monster → Legend.

| Time        | Night phase    | Enemies introduced                                              | Set piece                                                       | Active-enemy cap | Power target                                                               |
| ----------- | -------------- | --------------------------------------------------------------- | --------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------- |
| 0:00–2:00   | Moonrise       | Husks                                                           | Onboarding script (section 16)                                  | 8 → 15           | 1 arrow; learning the draw; \~5 level-ups                                  |
| 2:00–5:00   | First Howl     | Moonhounds (1:30), Wisps (3:00), Poachers (4:00)                | First formation 2:30; first elite 4:00                          | 15 → 60          | A specialized bow by minute 3                                              |
| 5:00        | —              | —                                                               | **The Black Shuck** → relic chest                               | 20 (boss arena)  | First evolution                                                            |
| 5:00–10:00  | Deep Night     | Hollow Stags (6:00), Barrow Knights (7:00), Barrow Worms (9:00) | Events begin at 6:00                                            | 60 → 150         | \~3 arrows per loose                                                       |
| 10:00       | Midnight       | —                                                               | 12 bell tolls; the moon turns red. **The Bramble King** → relic | 30 (boss arena)  | Build online                                                               |
| 10:00–15:00 | Witching Hours | Changelings (11:00)                                             | Layered formations; elites common                               | 150 → 300        | \~8 arrows by 12:00; build absurd by 13:00                                 |
| 15:00       | —              | —                                                               | **The Night Hag** → relic                                       | 40 (boss arena)  | Third evolution window                                                     |
| 15:00–19:00 | False Dawn     | All types, elite-heavy                                          | Swarm crescendo                                                 | 300 → 350        | \~20 arrows; Deadeye clears screens by 16:00; pressure catches up at 18:00 |
| 19:00–20:00 | The Final Hunt | Spawns stop                                                     | **The Huntmaster**                                              | —                | The final test                                                             |

### Spawn rules

- Enemies spawn **only off-screen**, at least 1.15 screen-radii from the hunter, and fade in over 0.4 s as they cross into view. They never appear inside the play space.
- Spawn rate is driven by the active-enemy cap: the director fills toward the cap at a rate that ramps linearly with time. No floor collapse in the first minute.
- Enemy HP scales ×(1 + 0.12 × minute); damage scales ×(1 + 0.05 × minute).
- During a boss fight, regular spawns drop to the boss-arena cap.

### Level curve

XP to next level = 5 + 4 × level^1.35. Targets: level 5 by 2:00, 12 by 5:00, 28 by 10:00, 40 by 15:00, 48 by 19:00. XP shards are silver; elite shards are violet and worth ×10.

### Victory and defeat

| Outcome                 | Condition                                                  | Reward                                        |
| ----------------------- | ---------------------------------------------------------- | --------------------------------------------- |
| **Hunt Complete**       | Kill the Huntmaster                                        | Full Moonsilver payout ×1.5, completion Deeds |
| **Survived Until Dawn** | Reach 20:00 alive without killing him; he flees at sunrise | Full Moonsilver payout                        |
| **The Hunter Falls**    | HP reaches 0                                               | Moonsilver earned so far                      |

## 9. Enemies, elites, formations, events

Eight enemy types each carry one readable behavior and one lesson; all are blood-red silhouettes with distinct shapes, and every attack is telegraphed.

| Enemy             | First | HP  | Speed px/s      | Hit | XP  | Behavior                                                                                                          | Teaches                                             |
| ----------------- | ----- | --- | --------------- | --- | --- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Husk**          | 0:00  | 20  | 55              | 8   | 1   | Shambles toward you in loose clumps                                                                               | Aim flow, density                                   |
| **Moonhound**     | 1:30  | 26  | 120             | 10  | 1   | Packs of 3–5 circle at \~300 px, crouch 0.5 s (growl + red glint), then lunge together at 320 px/s                | Don't stand still drawing                           |
| **Wisp**          | 3:00  | 18  | 80              | 8   | 2   | Drifts erratically; fades out (untargetable) for 1.5 s every 4 s with a visible shimmer, never moving while faded | Precision aim                                       |
| **Poacher**       | 4:00  | 40  | 60              | 14  | 3   | Stops at 400 px, shows a red draw line for 0.8 s, then looses a single arrow at 380 px/s                          | Reading telegraphs; it mirrors you                  |
| **Hollow Stag**   | 6:00  | 120 | 50              | 20  | 4   | Paints a red ground line for 0.9 s, then charges along it at 420 px/s through anything                            | Dodge timing; lined-up pierce shots                 |
| **Barrow Knight** | 7:00  | 90  | 55              | 14  | 4   | Frontal shield blocks arrows in a 120° arc; turns slowly (90°/s)                                                  | Flank, pierce, or rain on it                        |
| **Barrow Worm**   | 9:00  | 60  | 140 underground | 22  | 3   | Travels underground as a visible dirt trail, stops at your last position, shows a red ring for 0.8 s, then erupts | Keep moving (replaces the old teleporting Burrower) |
| **Changeling**    | 11:00 | 50  | 0 → 200         | 16  | 5   | Sits disguised as an XP shard with a faint shimmer; springs when you come within 80 px                            | Greed check                                         |

Pathing: enemies follow a flow field around trees and landmarks, so they never clip through cover.

### Elite modifiers

Elites appear from 4:00 at 2% of spawns, ramping to 8% by 15:00. They have ×2.5 HP, a violet aura and a unique silhouette ring, and drop a violet shard (×10 XP) plus a 25% chance of 5 Moonsilver.

| Modifier     | Effect                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------- |
| Frenzied     | +45% speed; attacks 30% faster                                                                |
| Armored      | Takes 30% less damage; perfect looses ignore the armor                                        |
| Regenerating | Heals 4% max HP per second unless hit within the last 2 s                                     |
| Vampiric     | Heals 25% of damage it deals; nearby Husks gain +20% speed                                    |
| Explosive    | Bursts on death: 100 px blast, red warning ring 0.6 s before                                  |
| Moonwarded   | Takes damage only from perfect looses and Deadeye; a silver ward cracks visibly with each hit |

### Formations

Formations begin at 2:30 (about one per minute, two per minute after 10:00). Each spawns off-screen, advances as its shape, and breaks into normal pursuit at \~250 px.

| Formation | Shape                           | Counter                    |
| --------- | ------------------------------- | -------------------------- |
| Crescent  | 9 enemies in an arc             | Strafe to an end           |
| Funnel    | V shape narrowing toward you    | Shoot down the center line |
| Spear     | A single file column            | Pierce the whole line      |
| Ring      | 12 enemies encircling at 450 px | Dodge out before it closes |
| Crossfire | Two lines from opposite sides   | Break one side first       |
| Pursuit   | A tight pack trailing you       | Turn and punish            |

### Events

One event every 90 s from 6:00, never during a boss. A banner and audio sting announce each.

| Event       | Duration     | What happens                                                                                 |
| ----------- | ------------ | -------------------------------------------------------------------------------------------- |
| Migration   | 15 s         | A herd of 12 Hollow Stags crosses the screen along one axis; big XP if you survive the lanes |
| The Hunt    | Until killed | An elite Poacher band of 4 tracks you across the map                                         |
| Quiet Grove | 20 s         | Spawns pause; a shrine appears nearby and heals 40 HP if you stand in it for 3 s             |
| Fog Bank    | 20 s         | Visibility drops to silhouettes beyond 250 px; marks and the Lantern cut through it          |

The midnight moon turn at 10:00 is a fixed set piece, not a random event.

## 10. Bosses

Four bosses anchor the night; each one tests a pillar, and every attack has a readable telegraph of at least 0.6 s. HP is tuned to time-to-kill targets at the expected build power for that minute.

**Arena rule:** when a boss spawns, a ring of moonlight 2 screens wide forms around the hunter. Leaving it is blocked by a soft wall. Regular spawns drop to the boss-arena cap (section 8). A boss health bar and name card appear top-center.

### 5:00 — The Black Shuck

A giant spectral hound from English folklore; target time-to-kill 35 s. Tests: the range dance.

- **Stalk:** circles at the edge of your sweet spot.
- **Lunge:** crouches 0.7 s with glowing eyes, then lunges in a straight line; dodge through it.
- **Pack Howl** (every 12 s): summons a Moonhound pack of 4.
- **Weak point:** perfect looses to the head (front arc) crit ×1.5 extra.

### 10:00 — The Bramble King

A crowned tangle of thorns that reshapes the arena; target time-to-kill 45 s. Tests: positioning and pierce.

- **Bramble Walls:** raises 3–4 thorn walls (shown as red cracks 1 s before) that block movement and arrows, leaving gaps to shoot through.
- **Root Lash:** thorns burst in a line along the ground toward you.
- **Crown:** only the glowing crown takes full damage; the body takes 25%. Worldpiercer ignores walls.

### 15:00 — The Night Hag

A flying hag that splits into illusions; target time-to-kill 45 s. Tests: reading the moonlight.

- **Threefold:** splits into 3 identical hags. Only the real one casts a moon-shadow on the ground. Hitting an illusion dispels it harmlessly.
- **Hex Bolts:** slow red orbs in a spiral pattern.
- **Swoop:** dives along a telegraphed arc.

### 19:00 — The Huntmaster

Leader of the Wild Hunt and your mirror archer; target time-to-kill 70 s across three phases. Tests: everything.

| Phase                 | HP      | Behavior                                                                                                       | Your answer                                                                                                            |
| --------------------- | ------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **I. The Duel**       | 100–66% | Draws with a visible perfect window (red flash); looses fast, precise arrows                                   | Hit him mid-draw to stagger him 1.2 s: an interrupt duel                                                               |
| **II. The Wild Hunt** | 66–33%  | Mounts a spectral stag; phantom riders sweep the arena in telegraphed lanes                                    | Shoot between lanes; he is vulnerable at each lane's end                                                               |
| **III. Last Light**   | 33–0%   | The moon sets. He uses _his_ Deadeye: time slows, red marks paint on you and the ground, then his volley fires | Dodge out of every mark. Survive the volley and his guard breaks: your Focus fills to 100 for a final Deadeye exchange |

If 20:00 arrives first, dawn breaks and he flees (Survived Until Dawn).

## 11. World

Each hunt takes place in the Hollowmoor, a bounded forest about 8 × 8 screens (roughly 15,000 × 8,500 px at 1080p) with authored landmarks, sparse cover, and open clearings for kiting.

### Layout

- **Fixed landmarks, shuffled placement:** the eight landmarks below always appear, but their positions are drawn from a set of hand-authored slots per run (seeded), so routes vary while the forest stays learnable.
- **Cover:** tree trunks and standing stones block movement and arrows (piercing arrows stop at cover unless an evolution says otherwise). Cover density is roughly 1 obstacle per 400 × 400 px, clustered into groves with open lanes between them.
- **Edges:** the forest boundary is a dense treeline wall; no invisible walls.

| Landmark                   | Role                                                       |
| -------------------------- | ---------------------------------------------------------- |
| Moonwell Clearing          | Run start; the largest open space                          |
| Standing Stones            | A ring of cover for fighting Barrow Knights from angles    |
| Old Lodge                  | Ruined hunting lodge; a Moonberry spawn point              |
| Dead Grove                 | Dense trees; tight lanes that reward pierce                |
| Watchtower                 | Raised ruin with open sight lines in all directions        |
| The Mire                   | Shallow water that slows everyone (you and enemies) by 25% |
| Barrow Mounds              | Burial hills; Barrow Knights and Worms favor this area     |
| Shrine of the Silver Order | Quiet Grove events always use this shrine when in range    |

### Camera

Top-down, following the hunter with a look-ahead of up to 18% of the screen toward the aim direction, eased. The camera pulls out 10% during boss fights and during Deadeye. Screen shake is capped and has an accessibility slider.

## 12. Hunter's Camp & meta progression

Hunter's Camp is a small walkable hub between hunts, and full unlocks should take roughly 15–20 hours. Every Camp station is a place you walk to, not a menu list.

### Stations

| Station          | Purpose                                                                        |
| ---------------- | ------------------------------------------------------------------------------ |
| **The Trail**    | Start a hunt: pick bow, then Moon Phase, then go                               |
| **The Fletcher** | Bow rack: view, choose, and preview unlocked bows; locked bows show their Deed |
| **The Range**    | Target-dummy practice with any unlocked bow, plus timed challenges             |
| **Silver Altar** | Spend Moonsilver on boons                                                      |
| **Trophy Wall**  | Deeds (achievements), with progress bars                                       |
| **Hunter's Log** | Bestiary, evolution codex, run history, build fingerprints                     |

### Moonsilver and boons

Moonsilver is earned per run: 1 per 10 kills, 5 per elite, 50 per boss, plus a time bonus of 5 per minute survived. Boons are modest and ranked, in the genre tradition.

| Boon        | Ranks | Effect per rank                            |
| ----------- | ----- | ------------------------------------------ |
| Might       | 5     | +4% damage                                 |
| Vigor       | 5     | +10 max HP                                 |
| Swiftness   | 3     | +4% move speed                             |
| Keen Eye    | 3     | +3% crit chance                            |
| Greed       | 5     | +8% Moonsilver earned                      |
| Growth      | 5     | +5% XP                                     |
| Magnet      | 3     | +20% pickup radius                         |
| Reroll      | 3     | +1 reroll per run                          |
| Banish      | 3     | +1 banish per run                          |
| Skip        | 3     | +1 skip per run                            |
| Fourth Card | 1     | Level-ups offer 4 cards                    |
| Second Wind | 1     | Once per run, survive a lethal hit at 1 HP |

### Deeds

Deeds unlock bows (section 4), the 11 Deed upgrades (section 5), and cosmetics (arrow trails, bow skins, cloak colors, all within the tri-color palette). Target: 60 Deeds, a mix of skill feats ("10 perfect looses in a row"), discovery ("evolve Thunderstorm"), and milestones ("survive to dawn on Full Moon").

### The Range

Practice with no fail state, plus challenges that pay 10–30 Moonsilver the first time and 2 after:

- **Steady:** 5 perfect looses in 10 s.
- **Sweet Spot:** 20 hits inside the sweet spot while moving.
- **Deadeye Drill:** mark and hit 8 moving targets in one Deadeye.
- **Poacher's Duel:** interrupt 3 dummy archers mid-draw.

### Moon Phases (difficulty)

| Phase      | Unlocks after           | Changes                                                       |
| ---------- | ----------------------- | ------------------------------------------------------------- |
| Crescent   | Default                 | Base game                                                     |
| Half Moon  | Survive until dawn once | +25% enemy HP, +15% density                                   |
| Full Moon  | Complete a hunt on Half | Elites ×2 frequency; bosses gain one new attack each          |
| Blood Moon | Complete a hunt on Full | Enemies +15% speed; no Quiet Grove; the moon is red all night |

### Curses

Optional modifiers chosen at the Trail after the third hunt, stacked on top of the Moon Phase; each active curse adds +20% Moonsilver.

| Curse     | Effect                              |
| --------- | ----------------------------------- |
| Haste     | Every enemy moves 20% faster        |
| Glass     | You take 50% more damage            |
| the Pack  | Moonhound packs run two larger      |
| Famine    | No Moonberries; shrines do not heal |
| Champions | Elites appear twice as often        |

### Nightly Hunt

A daily seeded run: same forest layout, spawns and card offers for everyone that day, with a local best score. Online leaderboards are a later Steam feature.

### Build fingerprint

The results screen draws a radar of the run across six axes (Barrage, Marksman, Piercer, Flame, Storm, Phantom), weighted by damage dealt per source. It is shown on results, saved per run in the Hunter's Log, and exportable as a shareable image.

## 13. Presentation

Arrowfall uses stylized glow silhouettes: mostly procedural vector shapes rendered with additive glow in silver, blood-red and violet, plus a small set of painted hero assets.

### Art direction

- **Procedural (code-drawn, baked to textures at load):** all enemies, arrows, projectiles, XP shards, telegraphs, particles, trees, the forest floor, UI frames.
- **Painted hero assets:** the hunter (idle, run, draw, dodge frames), the four bosses, the Camp backdrop, the title key art, the Moonraven.
- **Forest floor:** very dark, low-contrast blue-black with subtle texture so every glowing element pops. Trees read as deep silhouettes with a thin silver rim from moonlight.
- **Shapes carry identity:** each enemy is recognizable in silhouette alone (Husk = hunched blob, Moonhound = low wedge, Stag = antlered mass, Knight = shield slab, Wisp = flame teardrop, Poacher = upright with bow line, Worm = segmented arc, Changeling = shard until revealed).

### Readability law

1. **Enemy threats are always blood-red and always drawn on the top layer**, above your own effects. At 350 enemies, reading red is survival.
2. **Elements never add colors.** Fire, frost, storm, venom and blood are expressed through shape and motion inside the palette: ember = flickering violet-white tongues; frost = crystalline silver shards; storm = jagged silver arcs; venom = slow violet bubbles; bleed = dark red drips (the only red the player owns, kept small).
3. **Your effects dim at density.** Past 150 enemies, player VFX drop to 70% opacity and particle counts scale down so threats stay legible.
4. **Telegraphs have a single language:** a red line, ring or glint appears, holds for its telegraph time, then flashes white on the frame the attack goes live.
5. A **colorblind mode** swaps blood-red for high-contrast orange-white with pattern fills on telegraphs.

### Game feel

- **Hitstop only on:** perfect looses (40 ms), crits on elites (50 ms), elite kills (60 ms), boss phase changes (150 ms). Never on regular hits.
- **Perfect loose:** the reticle ring snaps shut in silver, a short radial flash at the bow, a thin light trail on the arrow, and the perfect chime.
- **Kills:** each enemy family has its own death: Husks crumble to dust, Moonhounds dissolve into mist, Wisps pop into sparks, Stags shatter into bone-white shards.
- **Damage numbers:** off by default for regular hits; crits and perfects show numbers (toggle in Options).
- **Screen shake:** capped at 6 px, reserved for the player being hit, boss slams, and Deadeye release.

## 14. Audio

Audio is a gameplay system: players time the perfect window by ear, so the bow's sound is designed first and the score is built around it. Michael produces the OST stems; the SFX list below is the full production brief.

### Core principle: the perfect chime is in key

The perfect-window chime is pitched to the current music key and scale degree, so perfect looses play melodically over the score. The game tells the audio engine the active key per music phase, and the chime picks the nearest chord tone. A streak of perfects climbs the scale.

### SFX brief — the bow

| Sound               | Trigger                            | Direction                                                                                                                                                                          |
| ------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Draw creak          | Draw start → full                  | Loop of string strain and wood flex; pitch and volume rise with draw %. Unique timbre per bow (Sparrow light and taut, Oathbreaker deep and groaning, Moonbow glassy and resonant) |
| Perfect window open | Full draw reached                  | Bright, short, bell-like "ting" in key; the single most important sound in the game                                                                                                |
| Perfect loose       | Release in window                  | Crisp string snap + silver whoosh + shimmer tail                                                                                                                                   |
| Full-draw loose     | Release after window or auto-loose | Solid snap + whoosh, no shimmer                                                                                                                                                    |
| Quick loose         | Release under 50%                  | Light flick                                                                                                                                                                        |
| Overdraw strain     | During overdraw                    | Tightening creak with a faint tremble                                                                                                                                              |
| Draw cancel         | Dodge during draw                  | String relaxing, soft                                                                                                                                                              |
| Arrow flight        | Per volley                         | Layered whoosh scaled to arrow count; voice-capped (see mix rules)                                                                                                                 |
| Multi-arrow fan     | Fletcher's Craft and Barrage       | Wider stereo spread, flutter layer                                                                                                                                                 |

### SFX brief — hits and kills

| Sound                                        | Direction                                                                                                                                       |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Hit: flesh (Husk, Moonhound, Poacher)        | Muted thud with a dry thunk                                                                                                                     |
| Hit: armor (Barrow Knight shield)            | Metallic clink with ricochet ping                                                                                                               |
| Hit: spectral (Wisp, Night Hag illusions)    | Glassy chime burst                                                                                                                              |
| Hit: bone (Hollow Stag)                      | Hollow knock                                                                                                                                    |
| Crit                                         | Sharp ring layered over the hit                                                                                                                 |
| Sweet-spot hit                               | Subtle silver sparkle layer                                                                                                                     |
| Pierce                                       | Quick ratcheting sequence per enemy passed                                                                                                      |
| Kill pops (×8 families)                      | Husk crumble, Moonhound mist-yelp, Wisp spark-pop, Poacher collapse, Stag bone-shatter, Knight armor clatter, Worm wet burst, Changeling shriek |
| Elite kill                                   | Deep impact + violet shimmer rise                                                                                                               |
| Status: burn / frost / storm / venom / bleed | Crackle / crystal tinkle / zap / hiss / drip, all short and quiet                                                                               |

### SFX brief — Focus and Deadeye

| Sound           | Direction                                                       |
| --------------- | --------------------------------------------------------------- |
| Focus gain      | Soft rising tone per chunk                                      |
| Focus full      | Resonant chime + low hum that sustains until used               |
| Deadeye enter   | Time-slow "whoomph", world muffles (low-pass), heartbeat enters |
| Mark painted    | Tick, pitch rising per mark                                     |
| Deadeye release | A roaring volley: all strings at once, then a wave of impacts   |
| Deadeye exit    | World un-muffles with a breath                                  |

### SFX brief — enemies and telegraphs

| Sound                  | Direction                                                    |
| ---------------------- | ------------------------------------------------------------ |
| Moonhound pack warning | Distant howl when a pack spawns off-screen                   |
| Moonhound crouch       | Growl on the telegraph                                       |
| Hollow Stag charge     | Snort on the ground line, hoof thunder on the charge         |
| Poacher draw           | A reversed, harsher version of your own draw creak           |
| Barrow Worm            | Low rumble while burrowing; rising tone on the eruption ring |
| Changeling reveal      | Hiss and snap                                                |
| Wisp fade              | Soft descending chime                                        |
| Explosive elite        | Swelling fuse tone during its warning ring                   |
| Elite spawn            | Short violet sting                                           |
| Formation arrival      | A horn call; different phrase per formation                  |

### SFX brief — tools, player, pickups, world, UI

| Group            | Sounds                                                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tools            | Moonraven caw + dive swoosh + hit; Thornsnare place click + snap + bramble burst; Lantern low hum and flare                                                                                       |
| Player           | Footsteps (leaf, mud, stone), dodge cloth whoosh, hurt grunt, low-HP heartbeat (under 25%), death                                                                                                 |
| Pickups          | XP shard tones that climb a scale when collected in quick succession; violet shard; Moonsilver coin; Moonberry heal                                                                               |
| Level-up         | Rising arpeggio; card hover ticks; card select per rarity (Common, Uncommon, Rare, Legendary reveal)                                                                                              |
| Relic chest      | Heavy lid, choral swell on open                                                                                                                                                                   |
| World and events | Forest night ambience (wind, insects, distant owls); Migration drum-rumble; The Hunt horn; Fog rolling; Quiet Grove wind chimes; midnight 12 bell tolls; false-dawn birdsong that starts at 18:00 |
| Bosses           | Intro sting + signature telegraph sound per attack, per boss                                                                                                                                      |
| UI               | Menu move, confirm, back, pause, unlock fanfare, Deed earned                                                                                                                                      |

### Adaptive OST

The score is layered stems that crossfade by night phase and intensity; one motif (the Hunt Moon theme) threads through every cue and becomes the Huntmaster's theme.

| Cue            | Time        | Direction                                                                                                 | Stems                    |
| -------------- | ----------- | --------------------------------------------------------------------------------------------------------- | ------------------------ |
| Moonrise       | 0:00–2:00   | Sparse, low strings and harp, the motif introduced softly                                                 | Base, pad                |
| First Howl     | 2:00–5:00   | Frame drum and pulse enter                                                                                | + percussion             |
| Deep Night     | 5:00–10:00  | Full motif on a lead voice; driving                                                                       | + melody                 |
| Midnight       | 10:00       | 12 bells, then a key change to the relative minor                                                         | Transition cue           |
| Witching Hours | 10:00–15:00 | Darker, heavier, choir layer                                                                              | + danger layer           |
| False Dawn     | 15:00–19:00 | Fastest and densest; motif in counterpoint                                                                | All layers               |
| The Huntmaster | 19:00       | The motif as a duel theme; phase III drops to near silence, then everything returns on the final exchange | Boss cue with 3 sections |
| Dawn           | Victory     | The motif resolved in major                                                                               | Stinger + loop           |
| Camp           | Hub         | Warm, acoustic version of the motif                                                                       | Loop                     |
| The Range      | Practice    | Minimal rhythmic bed in a fixed key so perfect chimes sing                                                | Loop                     |

**Intensity layer:** a danger stem fades in with enemy density and when HP drops under 25%. Each phase cue runs at a fixed tempo so transitions land on bar lines.

**Deadeye:** the score drops to a low-passed pad plus heartbeat, then the release lands on the downbeat of the next bar when possible.

### Mix rules

- **Priority:** player-threat telegraphs > perfect chime > Deadeye > player hurt > hits > kills > ambience.
- **Voice caps:** arrow flight 6 voices, hits 12, kill pops 8; beyond the cap, the quietest voice is dropped.
- **Ducking:** the score ducks 3 dB under boss telegraphs and fully under the perfect chime's attack.
- **Delivery:** SFX as 48 kHz WAV sources, exported to OGG; stems at a shared tempo per cue with loop points marked.

## 15. UI/UX flow and HUD

The HUD stays minimal so the eye lives on the reticle; the most important information (draw, perfect window, Focus) lives on the reticle itself.

### Screen flow

1. **Boot:** studio card (SLU), then title with key art and "Press any key". Under 5 s to Camp on repeat launches.
2. **Hunter's Camp:** walk to stations (section 12). First launch skips straight into the onboarding hunt (section 16).
3. **The Trail:** bow select (shows draw profile as a visual: draw bar, window size, sweet-spot ring), then Moon Phase, then "Begin the Hunt".
4. **The Hunt:** gameplay. Level-up and relic choices pause the run in a card overlay.
5. **Results:** outcome title, time, kills, perfect-loose %, evolutions earned, build fingerprint radar, Moonsilver earned, new Deeds. Buttons: Hunt Again (default), Camp, Share Fingerprint.

### HUD

| Element              | Position                                                | Notes                                                                                                   |
| -------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Reticle              | Cursor / aim point                                      | A ring that closes as you draw; flashes silver during the perfect window; sways in overdraw             |
| Focus                | Arc around the reticle                                  | Fills silver; pulses when full                                                                          |
| Moon clock           | Top center                                              | The moon travels across a thin sky arc as the run's timer; minutes shown beneath. Turns red at midnight |
| HP                   | Top left, plus a thin arc under the hunter when damaged | Bar with numeric value                                                                                  |
| XP                   | Bottom edge, full width                                 | Thin silver bar; level number at left                                                                   |
| Dodge                | Small pip beside the hunter                             | Visible only while on cooldown                                                                          |
| Tools and evolutions | Top right                                               | Small icons with rank pips                                                                              |
| Boss bar             | Top center, below the moon clock                        | Name card + phase markers                                                                               |
| Event banner         | Upper third, 2 s                                        | Name and one-line hint                                                                                  |

### Level-up overlay

Three (or four) cards fan in with rarity-colored frames. Each card shows: name, family icon, rank (e.g. 2/5), the effect in one line, and a small tag when it is an ingredient of an evolution you are close to ("Barrage: 1 more"). A side panel shows the current build (upgrades, ranks, tools). Keyboard 1–4, mouse, or gamepad d-pad to choose; a 0.4 s input guard prevents accidental picks.

### Options

Master/music/SFX volumes; screen shake slider; damage numbers toggle; colorblind mode; aim assist strength (gamepad); **Auto-Loose** (auto-release at full draw for accessibility); hold vs toggle draw; rebindable keys and buttons; UI scale; fullscreen / windowed.

## 16. Onboarding

The first hunt teaches everything through its spawn script, with no tutorial popups; one-line diegetic prompts appear near the hunter and fade after the action is done once.

| Time                      | What spawns                                        | Prompt (fades once done)               | Lesson                                 |
| ------------------------- | -------------------------------------------------- | -------------------------------------- | -------------------------------------- |
| 0:00                      | Nothing for 4 s; 3 still Husks at sweet-spot range | "Hold to draw"                         | Draw and loose                         |
| 0:10                      | 5 Husks in a slow line                             | "Release at the chime"                 | The perfect window, by ear             |
| 0:25                      | Husks from two sides                               | "Space to dodge"                       | Dodge, and that dodge cancels the draw |
| 0:40                      | A loose clump approaches                           | (none; the sweet-spot ring glows once) | Range bands                            |
| \~1:00                    | First level-up                                     | Card overlay explains itself           | Upgrades                               |
| First time Focus hits 100 | A dense Husk wave is scripted to arrive            | "Deadeye ready: right-click"           | Deadeye                                |

After the first hunt, onboarding never repeats; the Range covers practice. Prompts also show for gamepad glyphs when a pad is active.

## 17. Platform & tech

Arrowfall ships on Steam and Steam Deck; the same codebase runs in the browser for development, playtests and a public demo.

### Stack

| Layer              | Choice                                        | Why                                                                             |
| ------------------ | --------------------------------------------- | ------------------------------------------------------------------------------- |
| Language / build   | TypeScript + Vite                             | Fast iteration, typed data tables                                               |
| Rendering          | PixiJS v8 (WebGL, WebGPU when available)      | Batched sprites with additive blending for thousands of glow elements at 60 fps |
| Audio              | Web Audio API with a small layered-stem mixer | Key-aware perfect chime, stem crossfades, voice caps                            |
| Input              | Keyboard, mouse, Gamepad API                  | Deck and controllers first-class                                                |
| Desktop wrapper    | Tauri                                         | Small builds; Steamworks bridge for achievements and cloud saves                |
| Hosting (dev/demo) | Vercel                                        | Matches the existing workflow                                                   |

### Architecture rules

- **Fixed 60 Hz simulation** decoupled from rendering; the sim is deterministic from a seed (enables Nightly Hunt and replays of bug reports).
- **Data-driven content:** bows, upgrades, evolutions, tools, enemies, bosses, formations, events and deeds live in typed data files, not in logic.
- **Evolutions as rules:** effects hook arrow-spawn, on-hit and on-kill events, so combinations compose (section 6).
- **Object pools** for enemies, arrows, particles and damage numbers; no allocation in the frame loop.
- **Spatial hash** for all collision queries; **flow field** for enemy pathing around cover, recomputed only when the hunter moves a cell.
- **Glow art** is generated procedurally and baked to texture atlases at load.
- **Saves:** versioned JSON (profile, unlocks, options, run history); Steam Cloud on desktop, local storage on web with try/catch fallback.

### Performance budget

60 fps with 350 enemies, 600 player arrows, 200 enemy projectiles and full VFX on a mid-range laptop iGPU and on Steam Deck. Measured by the dev overlay (section 18); a frame over 16.7 ms more than 1% of the time is a bug.

## 18. Verification & tooling

Nothing is called done until it is proven in a running build; these tools ship inside the dev build from day one and are stripped from release builds.

### Dev panel (F1)

- Time skip to any minute or set piece (5:00, 10:00, 15:00, 19:00).
- Spawn any enemy, elite modifier, formation, event or boss at the cursor.
- Grant any upgrade, tool or evolution; set ranks; fill Focus.
- God mode, one-hit kills, freeze spawns, slow motion (×0.25).
- Draw hitboxes, flow field, spatial hash cells and sweet-spot bands.
- Unlock all / reset profile.

### Live overlay (F2)

FPS and frame-time graph; entity counts (enemies, arrows, projectiles, particles); damage per second by source (bow, each evolution, each tool); perfect-loose rate; current minute's spawn budget vs cap.

### Automated checks (run on every commit)

| Check           | Asserts                                                                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Smoke run       | A scripted bot launches the game, reaches Camp, starts a hunt, holds draw while circling, gets a level-up and picks a card, reaches results. Fails on any console error |
| Set-piece run   | With the dev time-skip, each boss spawns, takes damage, changes phase, and dies                                                                                         |
| Evolution run   | Each of the 10 evolutions is granted and fires its effect at least once                                                                                                 |
| Save round-trip | Profile saves, reloads, and matches                                                                                                                                     |
| Perf run        | 350-enemy stress scene holds the performance budget                                                                                                                     |

The bot tests use Playwright against the web build and screenshot each checkpoint, so every build reports what it actually did.

### Acceptance rule

Every feature in this document is accepted by what the player sees it do in a real run ("a Barrow Worm leaves a visible trail and erupts at my last position after a red ring"), not by the presence of code.

## 19. Open items

These decisions do not block the build; each has a working default.

- [ ] **The hunter's name and design** — default: an unnamed hooded hunter of the Silver Order.
- [ ] **Final title** — working title Arrowfall.
- [ ] **Currency name** — working name Moonsilver.
- [ ] **Painted hero art source** — who generates the hunter, bosses, Moonraven and key art, and in what style reference.
- [ ] **Steam store timing** — when to put up the page and wishlist push relative to the demo.
- [ ] **Mobile port** — revisit after Steam launch; the input layer is abstracted for it.
