# One Lantern

A single-screen, turn-based tactics roguelike where light is everything.

Your lantern's radius is simultaneously:

- **your health** — every hit shrinks it; below 1.0 it goes out and the run ends
- **your vision** — you cannot see one tile past it
- **your weapon** — anything caught inside it at turn end takes 1 burn

There are no hit points, no inventory, no second currency. Every action
spends, banks, or risks the same number.

## Play

Open `index.html` (it runs from `file://`), or serve the repo and visit
`/one-lantern/`. Three modes: **Daily** (date-seeded, same dungeon for
everyone), **Descend** (random 12-floor run), **Endless**.

| input | action |
|---|---|
| arrows / WASD / tap a neighbouring cell | move (bumping a wall still costs the turn) |
| `space` / `.` / tap yourself | wait — let the lantern do the work |
| `f` | **flare**: spend 2.0 radius for a burst that hits everything out to your (new) radius + 1 for 2 damage and a stun, leaving a 2-turn afterglow that moths love more than you |
| `q` | **dim**: bank 1.0 radius — banked light can't be hit, but you see and burn less |
| `e` | **brighten**: take 1.0 back out of the bank |

Light burns down a little every turn. Braziers refill you (+1.25), spilled
motes can be reclaimed, and walking into something shoulder-checks it for 1
— the only way to crack a mirror.

## The eight things in the dark

| | behavior |
|---|---|
| **moth** | flies at the brightest light it can see — which is not always you |
| **shade** | holds station just beyond your rim; dives through the glow now and then; charges outright if your radius falls below 2.5 or you're marked |
| **mirror** | stands still and re-emits any light that touches it in a lane pointing away from you; the lane burns like your aura; immune to light itself |
| **wisp** | darts two tiles a turn, steals 1.0 radius on touch and runs; immune to your aura; pop it with a flare or a shoulder-check before it drinks what it took |
| **snuffer** | beelines for lit braziers and extinguishes them; slow when hunting you |
| **wraith** | walks through walls; your light pins it to half speed but cannot burn it |
| **watcher** | stationary eye; if it has line of sight while you're at 3.0+ radius it charges, and at 3 charge it pulses — 0.75 damage and every enemy on the floor knows where you are for 5 turns. Dim below 3.0 or break line of sight to reset it |
| **mimic** | glows across the dark exactly like a brazier. Moths are never fooled — a "brazier" with no moths interested in it deserves suspicion |

Between floors you pick one of three **oils** (ten total, stacking run
modifiers — Slow-Burn, Flash Powder, Ghost Wick, Phoenix Drop, …). All of
them reshape how the one resource flows; none of them add a second one.

12 floors, 9×9, permadeath, ~10–13 minutes when you live.

## Development

- `engine.js` — all rules, deterministic per seed, no DOM (UMD: browser + Node)
- `render.js`, `audio.js`, `main.js`, `index.html` — canvas renderer (the
  light gradient is the art direction), synthesized WebAudio, shell
- `bot.js` — fog-of-war-honest heuristic player
- `sim.js` — instrumented playtest harness: `node sim.js 1000 --seed-prefix=validate`
- `probe.js` — scans event streams for emergent multi-rule interactions
- `PLAYTESTING.md` — win-rate data (33.7% over 1,000 held-out runs) and
  two emergent tactics found in playtesting
- `sim-results.json` — raw aggregate from the validation run

Floor generation is constraint-checked: a layout is rerolled until the exit
and every brazier are reachable, the exit is far from the start, and
nothing hostile spawns within 3.5 tiles of you. Floor 1 is hand-curated to
teach all six rules wordlessly (see PLAYTESTING.md).
