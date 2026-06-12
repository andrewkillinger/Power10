/*
 * One Lantern — engine
 * Pure game logic, no DOM. UMD: usable from the browser (window.OneLantern)
 * and from Node (require) so the sim harness runs the exact shipping rules.
 *
 * The whole design hangs on one resource: the lantern's radius ("light").
 *   - It is your health: damage shrinks it; below 1.0 the lantern goes out.
 *   - It is your vision: you cannot see past it.
 *   - It is your weapon: enemies inside it at turn end take 1 burn.
 * Every action trades that same resource. There is nothing else to spend.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.OneLantern = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------- constants

  const W = 9, H = 9;
  const LAST_FLOOR = 12;

  const ACT = {
    UP: 'up', DOWN: 'down', LEFT: 'left', RIGHT: 'right',
    WAIT: 'wait', FLARE: 'flare', DIM: 'dim', BRIGHTEN: 'brighten',
  };
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  const TUNE = {
    startLight: 6.0,
    maxLight: 8.0,
    deathBelow: 1.0,
    decayPerTurn: 0.09,      // the clock: light always burns down
    auraDamage: 1,           // per turn-end, to enemies inside the radius
    flareCost: 2.0,
    flareReach: 1,           // flare hits out to (post-spend) radius + this
    flareDamage: 2,
    flareStun: 1,
    flareAfterglowTurns: 2,  // the burst leaves a bright ghost moths adore
    dimStep: 1.0,            // light moved to/from the bank per action
    brazierGain: 1.25,
    brazierBrightness: 4,    // how loudly a brazier calls to moths
    afterglowBrightness: 9,
    beamBrightness: 2,
    beamLength: 5,
    wispSteal: 1.0,
    watcherChargeNeeded: 3,
    watcherPulseDamage: 0.75,
    watcherMarkTurns: 5,
    watcherBrightThreshold: 3.0, // dimmer than this and watchers can't see you
    shadePounceThreshold: 2.5,   // dimmer than this and shades charge
    moteTtl: 14,
  };

  const ENEMY = {
    moth:    { hp: 1, touch: 0.6,  glyph: 'moth' },
    shade:   { hp: 2, touch: 1.5,  glyph: 'shade' },
    mirror:  { hp: 3, touch: 0,    glyph: 'mirror' },  // doesn't attack; bends light.
                                                       // Light can't burn it — only a shoulder-check can.
    wisp:    { hp: 1, touch: 0,    glyph: 'wisp' },    // steals light instead of hurting
    snuffer: { hp: 4, touch: 1.25, glyph: 'snuffer' },
    wraith:  { hp: 2, touch: 1.0,  glyph: 'wraith' },  // light pins it but cannot burn it
    watcher: { hp: 2, touch: 0,    glyph: 'watcher' }, // stationary; pulses
    mimic:   { hp: 2, touch: 1.25, glyph: 'mimic' },   // wears a brazier's face
  };

  // Ten oils, picked one-of-three between floors. They modify how the single
  // resource flows; none of them introduce a second one.
  const OILS = [
    { id: 'whale',   name: 'Whale Oil',     desc: '+0.5 light each descent, cap +0.5' },
    { id: 'slow',    name: 'Slow-Burn Oil', desc: 'burn-down halved, flares cost +0.5' },
    { id: 'flash',   name: 'Flash Powder',  desc: 'flares hit twice as hard, stun longer' },
    { id: 'hungry',  name: 'Hungry Flame',  desc: '+0.1 light per kill' },
    { id: 'soul',    name: 'Soul Wick',     desc: 'banked light grows while banked' },
    { id: 'ghost',   name: 'Ghost Wick',    desc: 'dimmed below 2.5, nothing can find you' },
    { id: 'tallow',  name: 'Deep Tallow',   desc: 'braziers give +1 more, moths +1 per floor' },
    { id: 'phoenix', name: 'Phoenix Drop',  desc: 'once: instead of going out, relight to 3' },
    { id: 'storm',   name: 'Storm Oil',     desc: 'flares hurl enemies back two tiles' },
    { id: 'cinder',  name: 'Cinder Trail',  desc: 'your wake stays lit 3 turns, burn-down +30%' },
  ];

  // ---------------------------------------------------------------- rng

  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rngFrom(str) { return mulberry32(xmur3(str)()); }

  function dailySeed(date) {
    const d = date || new Date();
    const iso = d.toISOString().slice(0, 10);
    return 'daily-' + iso;
  }

  // ---------------------------------------------------------------- helpers

  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const inBounds = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
  const key = (x, y) => y * W + x;

  function losClear(walls, x0, y0, x1, y1) {
    // Bresenham; walls block sight between (not at) the endpoints.
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    let x = x0, y = y0;
    while (!(x === x1 && y === y1)) {
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
      if (x === x1 && y === y1) break;
      if (walls[key(x, y)]) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- floor gen
  //
  // Constraint-checked generation: every layout must pass solvability rules
  // (exit and braziers reachable, breathing room at the start, exit far away)
  // or it is thrown out and rerolled. Floor 1 is curated: it stages each rule
  // once, in order, with no text.

  function emptyFloor() {
    return {
      walls: new Array(W * H).fill(false),
      braziers: [],   // {x, y, lit}
      exit: { x: 4, y: 0 },
      start: { x: 4, y: 8 },
      enemies: [],
      motes: [],      // {x, y, amount, ttl} — spilled light, reclaimable
    };
  }

  function reachable(walls, sx, sy) {
    const seen = new Array(W * H).fill(false);
    const q = [[sx, sy]];
    seen[key(sx, sy)] = true;
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = x + dx, ny = y + dy;
        if (inBounds(nx, ny) && !seen[key(nx, ny)] && !walls[key(nx, ny)]) {
          seen[key(nx, ny)] = true;
          q.push([nx, ny]);
        }
      }
    }
    return seen;
  }

  function mkEnemy(type, x, y) {
    return {
      type, x, y, hp: ENEMY[type].hp,
      stun: 0, phase: 0, charge: 0, carried: 0,
      revealed: type !== 'mimic',   // mimics start disguised
      fleeing: false,
    };
  }

  function curatedFirstFloor(rng) {
    // The teaching floor. Wordless syllabus:
    //  - three moths converge on you and die in your light  -> light is a weapon
    //  - their touches visibly shrink the circle            -> light is health
    //  - the circle's edge is the edge of the world         -> light is vision
    //  - a brazier on the path refills you                  -> light is fuel, take it
    //  - a shade keeps exactly out of reach near the exit   -> some things fear light
    //  - a mirror throws your glow down a corridor          -> light can be bent
    const f = emptyFloor();
    f.start = { x: 4, y: 8 };
    f.exit = { x: 4, y: 0 };
    for (const [x, y] of [[2, 6], [6, 6], [2, 2], [6, 2], [1, 4], [7, 4]]) {
      f.walls[key(x, y)] = true;
    }
    f.braziers.push({ x: 4, y: 4, lit: true });
    f.enemies.push(mkEnemy('moth', 1 + Math.floor(rng() * 2), 0));
    f.enemies.push(mkEnemy('moth', 7, 1));
    f.enemies.push(mkEnemy('moth', 0, 2));
    f.enemies.push(mkEnemy('shade', 4, 1));
    f.enemies.push(mkEnemy('mirror', 6, 4));
    return f;
  }

  function spawnTableFor(depth) {
    // [type, cost, weight]; availability widens with depth so each enemy
    // gets a floor where it is the new thing.
    const t = [['moth', 1, 4], ['shade', 2, 3]];
    if (depth >= 2) t.push(['mirror', 1, 1.5]);
    if (depth >= 3) t.push(['wisp', 2, 2]);
    if (depth >= 4) t.push(['watcher', 2.5, 1.5], ['mimic', 2, 1]);
    if (depth >= 5) t.push(['snuffer', 3, 1.5]);
    if (depth >= 6) t.push(['wraith', 2.5, 2]);
    return t;
  }

  function generateFloor(seed, depth, oils) {
    const rng = rngFrom(seed + '/floor/' + depth);
    if (depth === 1) return curatedFirstFloor(rng);

    for (let attempt = 0; attempt < 80; attempt++) {
      const f = emptyFloor();
      f.start = { x: 1 + Math.floor(rng() * 7), y: 7 + Math.floor(rng() * 2) };
      f.exit = { x: 1 + Math.floor(rng() * 7), y: Math.floor(rng() * 2) };

      // Scatter wall chunks: pillars and short bars.
      const chunks = 5 + Math.floor(rng() * 4);
      for (let i = 0; i < chunks; i++) {
        const x = Math.floor(rng() * W), y = 1 + Math.floor(rng() * (H - 2));
        const horiz = rng() < 0.5;
        const len = 1 + Math.floor(rng() * 2);
        for (let j = 0; j < len; j++) {
          const wx = horiz ? x + j : x, wy = horiz ? y : y + j;
          if (inBounds(wx, wy)) f.walls[key(wx, wy)] = true;
        }
      }
      f.walls[key(f.start.x, f.start.y)] = false;
      f.walls[key(f.exit.x, f.exit.y)] = false;

      const open = reachable(f.walls, f.start.x, f.start.y);
      if (!open[key(f.exit.x, f.exit.y)]) continue;
      if (dist(f.start.x, f.start.y, f.exit.x, f.exit.y) < 6) continue;

      const freeCells = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (open[key(x, y)] && !(x === f.start.x && y === f.start.y) &&
            !(x === f.exit.x && y === f.exit.y)) freeCells.push([x, y]);
      }
      const take = (pred) => {
        const c = freeCells.filter(pred);
        if (!c.length) return null;
        const pick = c[Math.floor(rng() * c.length)];
        freeCells.splice(freeCells.indexOf(pick), 1);
        return pick;
      };

      // Braziers: the run's fuel income. Most floors get 1, some 2.
      const nBraz = 1 + (rng() < (depth >= 7 ? 0.5 : 0.3) ? 1 : 0);
      let brazOk = true;
      for (let i = 0; i < nBraz; i++) {
        const c = take(([x, y]) => dist(x, y, f.start.x, f.start.y) >= 2);
        if (!c) { brazOk = false; break; }
        f.braziers.push({ x: c[0], y: c[1], lit: true });
      }
      if (!brazOk) continue;

      // Enemies from a depth-scaled budget; roughly half garrison the exit
      // so the stairs can't simply be sprinted to.
      let budget = 3 + depth * 2.2;
      const table = spawnTableFor(depth);
      const counts = {};
      let guard = 0;
      while (budget >= 1 && guard++ < 60) {
        const total = table.reduce((s, e) => s + e[2], 0);
        let roll = rng() * total, picked = table[0];
        for (const e of table) { roll -= e[2]; if (roll <= 0) { picked = e; break; } }
        const [type, cost] = picked;
        if (cost > budget) continue;
        if (type === 'mirror' && (counts.mirror || 0) >= 2) continue;
        if (type === 'watcher' && (counts.watcher || 0) >= 2) continue;
        if (type === 'mimic' && (counts.mimic || 0) >= 1) continue;
        const farFromStart = ([x, y]) => dist(x, y, f.start.x, f.start.y) >= 3.5;
        const nearExit = ([x, y]) => farFromStart([x, y]) && dist(x, y, f.exit.x, f.exit.y) <= 4.5;
        const c = type === 'watcher'
          ? take(([x, y]) => farFromStart([x, y]) && (x === f.exit.x || y >= 2 && y <= 6))
          : (rng() < 0.5 ? (take(nearExit) || take(farFromStart)) : take(farFromStart));
        if (!c) break;
        f.enemies.push(mkEnemy(type, c[0], c[1]));
        counts[type] = (counts[type] || 0) + 1;
        budget -= cost;
      }
      if (oils && oils.includes('tallow')) {
        const c = take(([x, y]) => dist(x, y, f.start.x, f.start.y) >= 3.5);
        if (c) f.enemies.push(mkEnemy('moth', c[0], c[1]));
      }
      // Mimics replace what looks like a bonus brazier — they sit like one.
      if (!f.enemies.length) continue;
      return f;
    }
    // Pathological seed: serve an open arena rather than fail.
    const f = emptyFloor();
    f.braziers.push({ x: 4, y: 4, lit: true });
    f.enemies.push(mkEnemy('moth', 1, 1), mkEnemy('shade', 7, 1));
    return f;
  }

  // ---------------------------------------------------------------- game

  function newGame(opts) {
    opts = opts || {};
    const seed = opts.seed || ('run-' + Math.floor(Math.random() * 1e9));
    const g = {
      seed,
      mode: opts.mode || 'standard',   // 'standard' (12 floors) | 'endless'
      rng: rngFrom(seed + '/run'),
      depth: 1,
      turn: 0,
      floorTurn: 0,
      light: TUNE.startLight,
      bank: 0,
      maxLight: TUNE.maxLight,
      oils: [],
      phoenixUsed: false,
      marked: 0,                 // turns remaining of watcher's mark
      afterglow: null,           // {x, y, ttl}
      cinders: [],               // {x, y, ttl} lit wake from Cinder Trail
      player: { x: 4, y: 8 },
      floor: null,
      over: false, won: false,
      deathCause: null,
      kills: 0,
      offeredOils: null,         // set between floors; choose via chooseOil()
      stats: {
        turns: 0, kills: {}, lightGained: 0, lightLost: 0,
        killsBy: { aura: 0, flare: 0, beam: 0, cinder: 0 },
        flares: 0, dims: 0, brazierUsed: 0, wispThefts: 0, pulses: 0,
        events: {},   // free-form counters for emergence hunting
      },
    };
    loadFloor(g);
    return g;
  }

  function bump(g, name, n) { g.stats.events[name] = (g.stats.events[name] || 0) + (n || 1); }

  function loadFloor(g) {
    g.floor = generateFloor(g.seed, g.depth, g.oils);
    g.player = { x: g.floor.start.x, y: g.floor.start.y };
    g.floorTurn = 0;
    g.marked = 0;
    g.afterglow = null;
    g.cinders = [];
    if (g.oils.includes('whale')) {
      g.maxLight = TUNE.maxLight + 0.5;
      gainLight(g, 0.5);
    }
  }

  function decayRate(g) {
    let r = TUNE.decayPerTurn;
    if (g.oils.includes('slow')) r *= 0.5;
    if (g.oils.includes('cinder')) r *= 1.3;
    return r;
  }

  function gainLight(g, amt) {
    const before = g.light;
    g.light = Math.min(g.maxLight, g.light + amt);
    g.stats.lightGained += g.light - before;
    return g.light - before;
  }

  function hurtPlayer(g, amt, cause, events) {
    g.light -= amt;
    g.stats.lightLost += amt;
    events.push({ type: 'playerHit', amount: amt, cause });
    if (g.light < TUNE.deathBelow) {
      if (g.oils.includes('phoenix') && !g.phoenixUsed) {
        g.phoenixUsed = true;
        g.light = 3.0;
        events.push({ type: 'phoenix' });
        bump(g, 'phoenixSaves');
      } else {
        g.over = true;
        g.deathCause = cause;
        events.push({ type: 'death', cause });
      }
    }
  }

  function hurtEnemy(g, e, amt, source, events) {
    if (e.hp <= 0) return;
    // Mirrors reflect light; burning them with it is a category error.
    if (e.type === 'mirror' && source !== 'bump') return;
    // Wisps drink ambient glow. Only a flare, a beam, or a shoulder-check
    // burns hot enough to pop one.
    if (e.type === 'wisp' && source === 'aura') return;
    // Wraiths aren't of this world; steady light pins them but can't burn them.
    if (e.type === 'wraith' && source === 'aura') return;
    e.hp -= amt;
    events.push({ type: 'enemyHit', enemy: e.type, x: e.x, y: e.y, source });
    if (e.hp <= 0) {
      e.dead = true;
      g.kills++;
      g.stats.kills[e.type] = (g.stats.kills[e.type] || 0) + 1;
      if (g.stats.killsBy[source] !== undefined) g.stats.killsBy[source]++;
      events.push({ type: 'enemyDie', enemy: e.type, x: e.x, y: e.y, source });
      if (e.type === 'wisp' && e.carried > 0) {
        // A killed thief spills what it stole; light returns as a mote.
        g.floor.motes.push({ x: e.x, y: e.y, amount: e.carried, ttl: TUNE.moteTtl });
        bump(g, 'wispLightRecovered');
      }
      if (g.oils.includes('hungry')) gainLight(g, 0.1);
    }
  }

  function occupied(g, x, y) {
    return g.floor.enemies.some(e => !e.dead && e.x === x && e.y === y);
  }
  function passable(g, x, y, ignoreWalls) {
    if (!inBounds(x, y)) return false;
    if (!ignoreWalls && g.floor.walls[key(x, y)]) return false;
    return true;
  }

  // Mirror beams: any mirror standing in your light re-emits it onward,
  // along the ray away from you, until it hits a wall or runs out.
  function computeBeams(g) {
    const beams = [];
    for (const m of g.floor.enemies) {
      if (m.dead || m.type !== 'mirror') continue;
      const d = dist(g.player.x, g.player.y, m.x, m.y);
      if (d > g.light || d === 0) continue;
      if (!losClear(g.floor.walls, g.player.x, g.player.y, m.x, m.y)) continue;
      let dx = m.x - g.player.x, dy = m.y - g.player.y;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      // Snap the outgoing ray to 8 directions.
      const sx = adx >= ady / 2 ? Math.sign(dx) : 0;
      const sy = ady >= adx / 2 ? Math.sign(dy) : 0;
      if (sx === 0 && sy === 0) continue;
      const tiles = [];
      let x = m.x, y = m.y;
      for (let i = 0; i < TUNE.beamLength; i++) {
        x += sx; y += sy;
        if (!inBounds(x, y) || g.floor.walls[key(x, y)]) break;
        tiles.push([x, y]);
      }
      if (tiles.length) beams.push({ from: m, tiles });
    }
    return beams;
  }

  // Everything that calls to a moth, brightest-first.
  function lightSources(g, beams) {
    const ghost = g.oils.includes('ghost') && g.light <= 2.5;
    const src = [];
    if (!ghost) src.push({ x: g.player.x, y: g.player.y, b: g.light, what: 'player' });
    for (const br of g.floor.braziers) {
      if (br.lit) src.push({ x: br.x, y: br.y, b: TUNE.brazierBrightness, what: 'brazier' });
    }
    if (g.afterglow) src.push({ x: g.afterglow.x, y: g.afterglow.y, b: TUNE.afterglowBrightness, what: 'afterglow' });
    for (const beam of beams) for (const [x, y] of beam.tiles) {
      src.push({ x, y, b: TUNE.beamBrightness, what: 'beam' });
    }
    for (const c of g.cinders) src.push({ x: c.x, y: c.y, b: 1.5, what: 'cinder' });
    return src;
  }

  function stepToward(g, e, tx, ty, opts) {
    opts = opts || {};
    const cand = [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]];
    let best = null, bestScore = Infinity;
    for (const [dx, dy] of cand) {
      const nx = e.x + dx, ny = e.y + dy;
      if (dx !== 0 || dy !== 0) {
        if (!passable(g, nx, ny, opts.ghost)) continue;
        if (occupied(g, nx, ny)) continue;
        if (nx === g.player.x && ny === g.player.y) continue; // attacks are separate
      }
      let score = dist(nx, ny, tx, ty);
      if (opts.flee) score = -score;
      score += g.rng() * 0.25; // tie-break jitter
      if (score < bestScore) { bestScore = score; best = [nx, ny]; }
    }
    if (best) { e.x = best[0]; e.y = best[1]; }
  }

  function tryAttack(g, e, events) {
    const d = Math.abs(e.x - g.player.x) + Math.abs(e.y - g.player.y);
    if (d !== 1) return false;
    if (e.type === 'wisp') {
      const stealable = Math.max(0, Math.min(TUNE.wispSteal, g.light - TUNE.deathBelow - 0.01));
      if (stealable <= 0) return false;
      g.light -= stealable;
      g.stats.lightLost += stealable;
      e.carried += stealable;
      e.fleeing = true;
      e.fleeTtl = 10;
      g.stats.wispThefts++;
      events.push({ type: 'wispSteal', amount: stealable, x: e.x, y: e.y });
      // Theft shrinks the circle — every shade on the floor notices.
      if (g.light <= TUNE.shadePounceThreshold &&
          g.floor.enemies.some(s => !s.dead && s.type === 'shade')) {
        bump(g, 'theftEmboldenedShades');
      }
      return true;
    }
    const touch = ENEMY[e.type].touch;
    if (touch > 0) {
      hurtPlayer(g, touch, e.type, events);
      events.push({ type: 'enemyAttack', enemy: e.type, x: e.x, y: e.y });
      return true;
    }
    return false;
  }

  function enemyAct(g, e, beams, sources, events) {
    if (e.dead) return;
    if (e.stun > 0) { e.stun--; return; }
    const px = g.player.x, py = g.player.y;
    const dP = dist(e.x, e.y, px, py);
    const ghosted = g.oils.includes('ghost') && g.light <= 2.5;
    const inLight = dP <= g.light && !ghosted;

    switch (e.type) {
      case 'moth': {
        // Fly at whatever burns brightest. Distance discounts brightness, so
        // a near brazier outshines a far player — and vice versa.
        let best = null, bestScore = -Infinity;
        for (const s of sources) {
          const score = s.b - dist(e.x, e.y, s.x, s.y);
          if (score > bestScore) { bestScore = score; best = s; }
        }
        if (g.marked > 0) best = { x: px, y: py, what: 'player' };
        if (!best) { stepToward(g, e, e.x + (g.rng() < 0.5 ? 1 : -1), e.y, {}); break; }
        if (best.what === 'player' && tryAttack(g, e, events)) break;
        if (best.what !== 'player') {
          bump(g, 'mothLured');
          bump(g, 'mothLured_' + best.what);
          events.push({ type: 'mothLured', to: best.what, x: e.x, y: e.y });
        }
        stepToward(g, e, best.x, best.y, {});
        break;
      }
      case 'shade': {
        if (inLight) { stepToward(g, e, px, py, { flee: true }); bump(g, 'shadeRepelled'); break; }
        const emboldened = g.light <= TUNE.shadePounceThreshold || g.marked > 0;
        if (ghosted) { stepToward(g, e, e.x, e.y, {}); break; } // it has lost you
        if (emboldened) {
          if (tryAttack(g, e, events)) { bump(g, 'shadePounce'); break; }
          stepToward(g, e, px, py, {});
          break;
        }
        // Lurk at the rim: close to dP ~ light + 1.2, circling — and now and
        // then dive through the glow to bite, paying burn for blood.
        const want = g.light + 1.2;
        // Dive only when the bite is actually reachable (two steps), so a
        // shade never throws itself into a wide circle it can't cross.
        if (dP <= Math.min(want + 0.8, 4.2) && g.rng() < 0.25) {
          stepToward(g, e, px, py, {});
          if (!tryAttack(g, e, events)) stepToward(g, e, px, py, {});
          if (tryAttack(g, e, events)) bump(g, 'shadeDiveHit');
          break;
        }
        if (dP > want + 0.8) stepToward(g, e, px, py, {});
        else if (dP < want - 0.4) stepToward(g, e, px, py, { flee: true });
        // else hold position at the rim, a pair of eyes at the edge of sight
        break;
      }
      case 'mirror':
        break; // it only stands and bends
      case 'wisp': {
        if (e.fleeing) {
          e.fleeTtl--;
          if (e.fleeTtl <= 0 && e.carried > 0) {
            // It drinks what it stole and slips away.
            e.dead = true;
            events.push({ type: 'wispEscape', x: e.x, y: e.y, amount: e.carried });
            bump(g, 'wispEscapes');
            break;
          }
          stepToward(g, e, px, py, { flee: true });
          if (dP > 7) e.fleeing = e.carried > 0; // empty wisps calm down
          break;
        }
        if (ghosted || g.light <= 2) break; // nothing worth stealing
        // Wisps dart: two steps a turn, snatching the moment they touch you.
        if (tryAttack(g, e, events)) break;
        stepToward(g, e, px, py, {});
        if (tryAttack(g, e, events)) break;
        stepToward(g, e, px, py, {});
        tryAttack(g, e, events);
        break;
      }
      case 'snuffer': {
        let target = null, bd = Infinity;
        for (const br of g.floor.braziers) {
          if (!br.lit) continue;
          const d = dist(e.x, e.y, br.x, br.y);
          if (d < bd) { bd = d; target = br; }
        }
        if (!target) {
          // No fuel to smother: it lumbers after you at half speed.
          e.phase ^= 1;
          if (e.phase === 0) break;
        }
        if (target) {
          if (e.x === target.x && e.y === target.y || bd <= 1) {
            target.lit = false;
            events.push({ type: 'brazierSnuffed', x: target.x, y: target.y });
            bump(g, 'braziersSnuffed');
            break;
          }
          stepToward(g, e, target.x, target.y, {});
          break;
        }
        if (tryAttack(g, e, events)) break;
        stepToward(g, e, px, py, {});
        break;
      }
      case 'wraith': {
        // Walks through walls; your light pins it to half speed.
        if (inLight) { e.phase ^= 1; if (e.phase === 0) break; }
        if (ghosted) break;
        if (tryAttack(g, e, events)) break;
        stepToward(g, e, px, py, { ghost: true });
        break;
      }
      case 'watcher': {
        const sees = !ghosted && g.light >= TUNE.watcherBrightThreshold &&
          losClear(g.floor.walls, e.x, e.y, px, py);
        if (sees) {
          e.charge++;
          events.push({ type: 'watcherCharge', x: e.x, y: e.y, charge: e.charge });
          if (e.charge >= TUNE.watcherChargeNeeded) {
            e.charge = 0;
            g.marked = TUNE.watcherMarkTurns;
            g.stats.pulses++;
            hurtPlayer(g, TUNE.watcherPulseDamage, 'watcher', events);
            events.push({ type: 'watcherPulse', x: e.x, y: e.y });
            bump(g, 'watcherPulses');
          }
        } else if (e.charge > 0) e.charge--;
        break;
      }
      case 'mimic': {
        if (!e.revealed) {
          if (Math.abs(e.x - px) <= 1 && Math.abs(e.y - py) <= 1) {
            e.revealed = true;
            events.push({ type: 'mimicReveal', x: e.x, y: e.y });
            bump(g, 'mimicReveals');
          }
          break;
        }
        if (tryAttack(g, e, events)) break;
        stepToward(g, e, px, py, {});
        break;
      }
    }
  }

  // ---------------------------------------------------------------- step

  function step(g, action) {
    const events = [];
    if (g.over || g.won) return events;
    if (g.offeredOils) return events; // must choose an oil first

    g.turn++; g.floorTurn++; g.stats.turns++;

    // ---- player action
    let acted = false;
    if (DIRS[action]) {
      const [dx, dy] = DIRS[action];
      const nx = g.player.x + dx, ny = g.player.y + dy;
      if (passable(g, nx, ny)) {
        const blocker = g.floor.enemies.find(e => !e.dead && e.x === nx && e.y === ny);
        if (blocker) {
          // Walking into a thing shoulder-checks it for 1. The lantern itself
          // is the real weapon; this is the only way to break a mirror.
          hurtEnemy(g, blocker, 1, 'bump', events);
          if (blocker.type === 'mimic' && !blocker.revealed) {
            blocker.revealed = true;
            events.push({ type: 'mimicReveal', x: blocker.x, y: blocker.y });
          }
        } else {
          if (g.oils.includes('cinder')) {
            g.cinders.push({ x: g.player.x, y: g.player.y, ttl: 3 });
          }
          g.player.x = nx; g.player.y = ny;
          events.push({ type: 'move', x: nx, y: ny });
        }
        acted = true;
      } else {
        events.push({ type: 'bump' });
        acted = true; // bumping a wall still costs the turn — the dark doesn't wait
      }
    } else if (action === ACT.WAIT) {
      acted = true;
    } else if (action === ACT.FLARE) {
      let cost = TUNE.flareCost + (g.oils.includes('slow') ? 0.5 : 0);
      if (g.light - cost >= TUNE.deathBelow) {
        g.light -= cost;
        g.stats.lightLost += cost;
        g.stats.flares++;
        const reach = g.light + TUNE.flareReach; // the burst leaps from what remains
        const dmg = TUNE.flareDamage * (g.oils.includes('flash') ? 2 : 1);
        const stun = TUNE.flareStun + (g.oils.includes('flash') ? 1 : 0);
        events.push({ type: 'flare', x: g.player.x, y: g.player.y, reach });
        for (const e of g.floor.enemies) {
          if (e.dead) continue;
          if (e.type === 'mimic' && !e.revealed) continue;
          if (dist(e.x, e.y, g.player.x, g.player.y) <= reach) {
            hurtEnemy(g, e, dmg, 'flare', events);
            if (!e.dead) {
              e.stun = Math.max(e.stun, stun);
              if (g.oils.includes('storm')) {
                for (let i = 0; i < 2; i++) {
                  const sx = Math.sign(e.x - g.player.x), sy = Math.sign(e.y - g.player.y);
                  const nx = e.x + sx, ny = e.y + sy;
                  if (passable(g, nx, ny, e.type === 'wraith') && !occupied(g, nx, ny)) { e.x = nx; e.y = ny; }
                }
              }
            }
          }
        }
        g.afterglow = { x: g.player.x, y: g.player.y, ttl: TUNE.flareAfterglowTurns };
        acted = true;
      } else {
        events.push({ type: 'tooDim' });
        return events; // refused: not enough light to spend and live
      }
    } else if (action === ACT.DIM) {
      const amt = Math.min(TUNE.dimStep, g.light - TUNE.deathBelow - 0.01);
      if (amt > 0.05) {
        g.light -= amt; g.bank += amt;
        g.stats.dims++;
        events.push({ type: 'dim', light: g.light, bank: g.bank });
        acted = true;
      } else { events.push({ type: 'tooDim' }); return events; }
    } else if (action === ACT.BRIGHTEN) {
      const amt = Math.min(TUNE.dimStep, g.bank, g.maxLight - g.light);
      if (amt > 0.001) {
        g.bank -= amt; g.light += amt;
        events.push({ type: 'brighten', light: g.light, bank: g.bank });
        acted = true;
      } else { acted = true; }
    }
    if (!acted) return events;

    // ---- pickups under the player
    const m = g.floor.motes.find(mt => mt.x === g.player.x && mt.y === g.player.y);
    if (m) {
      gainLight(g, m.amount);
      g.floor.motes.splice(g.floor.motes.indexOf(m), 1);
      events.push({ type: 'mote', amount: m.amount });
    }
    const br = g.floor.braziers.find(b => b.lit && b.x === g.player.x && b.y === g.player.y);
    if (br) {
      br.lit = false;
      const gain = TUNE.brazierGain + (g.oils.includes('tallow') ? 1 : 0);
      gainLight(g, gain);
      g.stats.brazierUsed++;
      events.push({ type: 'brazier', amount: gain });
    }

    // ---- exit?
    if (g.player.x === g.floor.exit.x && g.player.y === g.floor.exit.y) {
      events.push({ type: 'descend', depth: g.depth });
      if (g.mode === 'standard' && g.depth >= LAST_FLOOR) {
        g.won = true;
        events.push({ type: 'win' });
        return events;
      }
      g.depth++;
      // Between floors: choose one oil of three. Skip if all ten are held.
      const owned = new Set(g.oils);
      const pool = OILS.filter(o => !owned.has(o.id));
      if (pool.length) {
        const r = rngFrom(g.seed + '/oils/' + g.depth);
        const offer = [];
        const bag = pool.slice();
        while (offer.length < Math.min(3, bag.length)) {
          offer.push(bag.splice(Math.floor(r() * bag.length), 1)[0]);
        }
        g.offeredOils = offer;
        events.push({ type: 'offerOils', oils: offer });
      } else {
        loadFloor(g);
      }
      return events;
    }

    // ---- world reacts
    const beams = computeBeams(g);
    const sources = lightSources(g, beams);
    for (const e of g.floor.enemies) {
      enemyAct(g, e, beams, sources, events);
      if (g.over) return events;
    }

    // ---- turn end: the lantern bites
    const beamsAfter = computeBeams(g); // enemies moved; beams follow the geometry
    for (const e of g.floor.enemies) {
      if (e.dead) continue;
      if (e.type === 'mimic' && !e.revealed) continue;
      const ghosted = g.oils.includes('ghost') && g.light <= 2.5;
      if (!ghosted && dist(e.x, e.y, g.player.x, g.player.y) <= g.light) {
        hurtEnemy(g, e, TUNE.auraDamage, 'aura', events);
        continue;
      }
      if (beamsAfter.some(b => b.tiles.some(([x, y]) => x === e.x && y === e.y))) {
        hurtEnemy(g, e, TUNE.auraDamage, 'beam', events);
        bump(g, 'beamKO');
        continue;
      }
      if (g.cinders.some(c => c.x === e.x && c.y === e.y)) {
        hurtEnemy(g, e, 0.5, 'cinder', events);
      }
    }
    g.floor.enemies = g.floor.enemies.filter(e => !e.dead);

    // ---- timers and the slow burn
    if (g.afterglow && --g.afterglow.ttl <= 0) g.afterglow = null;
    g.cinders = g.cinders.filter(c => --c.ttl > 0);
    g.floor.motes = g.floor.motes.filter(mt => --mt.ttl > 0);
    if (g.marked > 0) g.marked--;
    if (g.oils.includes('soul') && g.bank > 0) g.bank = Math.min(4, g.bank + 0.05);
    g.light -= decayRate(g);
    g.stats.lightLost += decayRate(g);
    if (g.light < TUNE.deathBelow) {
      if (g.oils.includes('phoenix') && !g.phoenixUsed) {
        g.phoenixUsed = true; g.light = 3.0;
        events.push({ type: 'phoenix' });
      } else {
        g.over = true;
        g.deathCause = 'burned out';
        events.push({ type: 'death', cause: 'burned out' });
      }
    }
    return events;
  }

  function chooseOil(g, oilId) {
    if (!g.offeredOils) return false;
    if (oilId && !g.offeredOils.some(o => o.id === oilId)) return false;
    if (oilId) g.oils.push(oilId);
    g.offeredOils = null;
    loadFloor(g);
    return true;
  }

  // What the player can actually see (for the renderer and the honest bot).
  function visible(g) {
    const out = new Array(W * H).fill(false);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (dist(x, y, g.player.x, g.player.y) <= g.light &&
          losClear(g.floor.walls, g.player.x, g.player.y, x, y)) out[key(x, y)] = true;
    }
    for (const b of computeBeams(g)) for (const [x, y] of b.tiles) out[key(x, y)] = true;
    if (g.afterglow) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (dist(x, y, g.afterglow.x, g.afterglow.y) <= 2.5) out[key(x, y)] = true;
      }
    }
    return out;
  }

  return {
    W, H, ACT, TUNE, ENEMY, OILS, LAST_FLOOR,
    newGame, step, chooseOil, visible, computeBeams, lightSources,
    dailySeed, rngFrom, dist, losClear, key,
  };
});
