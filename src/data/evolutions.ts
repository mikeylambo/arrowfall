export interface Evolution {id:string;name:string;ingredients:string[];effect:string;}
export const EVOLUTIONS:Evolution[]=[
  {
    "id": "barrage",
    "name": "Barrage",
    "ingredients": [
      "fletcher-s-craft",
      "quick-nock"
    ],
    "effect": "Looses fire a widening fan; each consecutive loose within 1 s adds +1 arrow (max +6)"
  },
  {
    "id": "worldpiercer",
    "name": "Worldpiercer",
    "ingredients": [
      "piercer",
      "longshaft",
      "draw-strength"
    ],
    "effect": "Full-draw arrows pierce infinitely, cross the whole screen, and gain +10% damage per enemy pierced"
  },
  {
    "id": "deadshot",
    "name": "Deadshot",
    "ingredients": [
      "eagle-eye",
      "broadhead",
      "far-sight"
    ],
    "effect": "Perfect crits in the sweet spot or beyond detonate: 80 px blast at 60% of the hit"
  },
  {
    "id": "hellfire",
    "name": "Hellfire",
    "ingredients": [
      "ember-arrow",
      "broadhead",
      "rupture"
    ],
    "effect": "Crits cause burning explosions; burning enemies spread fire to neighbors on death"
  },
  {
    "id": "frostbite",
    "name": "Frostbite",
    "ingredients": [
      "frost-arrow",
      "far-sight"
    ],
    "effect": "Full-draw hits beyond the sweet spot freeze targets for 1.5 s; frozen enemies take +100% damage"
  },
  {
    "id": "thunderstorm",
    "name": "Thunderstorm",
    "ingredients": [
      "storm-arrow",
      "fletcher-s-craft",
      "rupture"
    ],
    "effect": "Lightning chains always trigger and jump up to 6 times, each jump +15% damage"
  },
  {
    "id": "phantom-hunt",
    "name": "Phantom Hunt",
    "ingredients": [
      "phantom-step",
      "evasive-shot",
      "windstep"
    ],
    "effect": "Each dodge summons a spectral hunter for 4 s that mirrors your looses (max 3 at once)"
  },
  {
    "id": "red-harvest",
    "name": "Red Harvest",
    "ingredients": [
      "barbed-arrow",
      "blood-trail",
      "executioner"
    ],
    "effect": "Bleeding enemies fling blood darts at neighbors every second; bleeding kills infect the nearest 3 enemies"
  },
  {
    "id": "apex-hunter",
    "name": "Apex Hunter",
    "ingredients": [
      "hunter-s-mark",
      "predator",
      "chain-kill"
    ],
    "effect": "Killing a Marked enemy instantly marks the next, extends the kill chain by 2 s, and grants +15% damage for 5 s"
  },
  {
    "id": "heaven-s-volley",
    "name": "Heaven's Volley",
    "ingredients": [
      "fletcher-s-craft",
      "draw-strength",
      "longshaft"
    ],
    "effect": "Full-draw looses call a rain of 12 silver arrows on the aim point; perfect looses call 36 across a wider area"
  }
];
