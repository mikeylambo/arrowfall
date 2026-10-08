/** Hunter's Log bestiary: what each creature does, what it teaches, and a line of lore. */
export const BESTIARY: Record<string, { behavior: string; lesson: string; lore: string }> = {
  husk: {
    behavior: 'Shambles toward you in loose clumps.',
    lesson: 'Aim flow and density.',
    lore: 'What the moor keeps of the ones who stayed out after dark.',
  },
  hound: {
    behavior:
      'Hunts in packs of 3–5: circles at ~300 px, crouches with a growl, then lunges together.',
    lesson: 'Never stand still while drawing.',
    lore: 'They answer the Shuck, and the Shuck answers no one.',
  },
  wisp: {
    behavior: 'Drifts erratically and fades out (untargetable) for 1.5 s every 4 s.',
    lesson: 'Precision aim; the Lantern keeps them visible.',
    lore: 'A light that leads travellers off the path, and then goes out.',
  },
  poacher: {
    behavior: 'Holds ~400 px, strafes, shows a red draw line, then looses an arrow at your path.',
    lesson: 'Read telegraphs; it mirrors you.',
    lore: 'A hunter who took the moon’s bargain. Its arrows still remember the Order.',
  },
  stag: {
    behavior: 'Paints a red line for 0.9 s, rears, then charges along it through anything.',
    lesson: 'Dodge timing; line them up for pierce.',
    lore: 'Its antlers are older than the trees they snap.',
  },
  knight: {
    behavior: 'A shield blocks arrows in a 120° arc; it turns slowly.',
    lesson: 'Flank it, pierce it, or rain on it.',
    lore: 'The barrows were sealed for a reason. Someone broke the seals.',
  },
  worm: {
    behavior: 'Travels underground as a dirt trail, rings your last position red, then erupts.',
    lesson: 'Keep moving.',
    lore: 'It tastes the ground where you stood.',
  },
  changeling: {
    behavior: 'Sits disguised as a moonlight shard; springs when you come within 80 px.',
    lesson: 'Greed has a price.',
    lore: 'Fae-born and patient. It has watched hunters pick up shards for a hundred years.',
  },
};
