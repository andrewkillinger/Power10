# One Lantern — playtest report

This document covers the two "done when" criteria that require evidence:
the simulated win-rate data, and emergent tactics discovered during
playtesting that were never explicitly authored.

## Methodology

The engine (`engine.js`) is pure logic shared verbatim between the browser
build and a Node harness, so simulated runs use the exact shipping rules.

- `sim.js` plays full 12-floor runs with the bot in `bot.js` and aggregates
  the engine's instrumentation counters.
- The bot is **fog-of-war honest**: it only acts on tiles inside the current
  lantern radius plus remembered walls, exactly what a human can see. It
  plays a solid but not superhuman game (flares on crowds, refuels under
  4.2 light, dims for charging watchers, chases thieves, lets moths burn).
- Balance was tuned against seed prefix `tune-*`, then validated once on the
  held-out prefix `validate-*`. Numbers below are from the held-out set.

Reproduce with:

```
node public/one-lantern/sim.js 1000 --seed-prefix=validate
node public/one-lantern/probe.js 400
```

## Win rate: 33.7% (target ~30%)

1,000 held-out runs (`validate-0` … `validate-999`), raw JSON in
[`sim-results.json`](./sim-results.json):

| outcome | runs | share |
|---|---|---|
| died on floor 3–5 | 17 | 1.7% |
| died on floor 6–8 | 193 | 19.3% |
| died on floor 9–11 | 334 | 33.4% |
| died on floor 12 | 119 | 11.9% |
| **won (cleared floor 12)** | **337** | **33.7%** |

The shape is the one we tuned for: almost nobody dies in the first third
(the teaching floors), the squeeze starts mid-run as the burn-down outpaces
brazier income, and 12% of all runs die *on the last floor* — runs are
winnable but tight to the very end.

Deaths by cause: burned out 252 (the clock), wraith 242 (the aura-immune
enemy that punishes flare hoarding), snuffer 102 (the economy attacker),
mimic 55, moth 12. Winning runs average 203.6 turns; at a human pace of
3–4 seconds a turn that is a 10–13 minute run, inside the 15-minute target.

Kill sources confirm the lantern itself is the weapon: 46,763 aura kills vs
12,389 flare kills, with 1,679 kills by mirror beam and 361 by cinder trail.

## Emergent tactics found in playtesting

These came out of watching instrumented runs (`probe.js` scans the raw
event stream for multi-rule sequences and prints reproducible seeds).
Neither behavior has a line of code implementing it; both fall out of
rules colliding.

### 1. The flare is a better decoy than a weapon

**1,824 occurrences in 400 probe runs** (`flareDecoy` pattern, e.g. seed
`probe-0`, floor 4, turn 2).

Authored rules: moths fly toward the brightest light source, discounted by
distance; a flare leaves a 2-turn afterglow at the cast position with
brightness 9 — brighter than the player can ever be (cap 8).

What emerged: casting a flare and *walking away from it* peels every moth
on the floor off your tail for two turns, because the ghost of your own
flare outshines you. The damage is almost beside the point — you can cast
a flare at the *edge* of a moth cloud, deliberately not killing the far
ones, and the survivors will fly to where you were while you cross to the
exit. The bot does this constantly without being told to: the probe found
it firing ~5 lure events per run. Spending 2.0 radius to make the floor
ignore you is frequently a better trade than spending it to kill.

### 2. Shades can be herded into a mirror's beam

**113 occurrences in 400 probe runs** (`beamHerd` pattern, e.g. seed
`probe-14`, floor 4: a shade repelled by the aura on turn 1 died inside a
beam on turn 2 at (6,1)).

Authored rules: shades flee to maximize distance from you when your light
touches them; mirrors standing in your light re-emit it in a straight lane
pointing *away from you*, and that lane burns like the aura does.

What emerged: your approach vector controls a shade's escape vector, and
the mirror's beam direction is *also* controlled by your position — so by
walking at a shade from the correct side of a mirror, the shade's own
flee rule marches it down the lane of borrowed light, taking burn every
turn it "escapes." The shade is the enemy designed to be safe from your
aura; the mirror is a neutral fixture that mostly helps you see. Together
they form a kill corridor neither was written to be.

### Honorable mentions (also observed, lower frequency)

- **The thief heralds the wolves** (13×): a wisp theft drops your radius
  below 2.5, which flips every lurking shade on the floor from "hold at
  the rim" to "charge" — one steal converts the whole floor's posture
  from siege to assault within 3 turns (`theftCascade`, seed `probe-33`,
  floor 9: theft on turn 4, shade bite landed turn 7).
- **Snuffing releases the swarm** (23×): moths orbiting a brazier
  re-acquire *you* the moment a snuffer extinguishes it — the snuffer,
  nominally an economy attacker, doubles as a moth-artillery spotter
  (`swarmRelease`, seed `probe-6`, floor 7).

## Wordless floor 1

Floor 1 is curated, not generated (`curatedFirstFloor` in `engine.js`).
Its syllabus, in the order a new player meets it:

1. Three moths converge from the dark and die crossing the glow →
   **the light is a weapon** (and the radius edge is where things die).
2. Any moth that lands a touch visibly shrinks the circle, and the thud
   sound falls in pitch with it → **the light is your health**.
3. The shrinking circle hides the far walls → **the light is your sight**.
4. A lit brazier sits on the path; stepping on it visibly refills the
   circle → **light is fuel, and it's lying around**.
5. A shade holds station exactly one tile beyond your rim near the exit,
   a pair of eyes that backs off as you advance → **some things fear the
   light, and the rim is a negotiable border**.
6. A mirror catches your glow and throws a lane of it down a corridor →
   **light can be bent and borrowed**.

No tutorial text appears anywhere in play; the only words in the game are
on menus and the between-floor oil cards.
