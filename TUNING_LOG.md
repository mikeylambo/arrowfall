# Arrowfall tuning

GDD numeric bow, dodge, Focus, XP, enemy, upgrade and tool defaults are retained. Boss HP and boon prices are working defaults where the GDD provides no number.

Corrections from verification:
- Dodge integration clamps the final partial tick, preserving exactly 140 px of travel.
- Brief key taps are latched in the upstream shell input source so Escape is observed between animation frames.
- Dodge and Deadeye requests survive perfect-shot hitstop through buffered simulation input.
- Forest tile sprites are culled outside the camera; the starting clearing excludes cover within 380 px to preserve room to aim while keeping groves visible.

Not yet certified: 35/45/45/70-second boss TTK; all level targets and density pressure through human playtests; 60 fps on target hardware.
