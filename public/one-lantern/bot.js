/*
 * One Lantern — playtest bot
 * A heuristic player used by sim.js to measure win rate. It only acts on
 * what a human could see: tiles inside the current radius (plus remembered
 * walls), so its results are an honest ceiling for a good human player.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./engine.js'));
  } else {
    root.OneLanternBot = factory(root.OneLantern);
  }
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';
  const { W, H, ACT, TUNE, dist, key } = E;

  function newMemory() {
    return { walls: new Set(), seen: new Set(), depth: 0 };
  }

  function observe(g, mem) {
    if (mem.depth !== g.depth) { mem.walls.clear(); mem.seen.clear(); mem.depth = g.depth; }
    const vis = E.visible(g);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (vis[key(x, y)]) {
        mem.seen.add(key(x, y));
        if (g.floor.walls[key(x, y)]) mem.walls.add(key(x, y));
      }
    }
    return vis;
  }

  // BFS over remembered map; unseen tiles count as open (explore hopefully).
  function bfsNext(mem, sx, sy, targets, avoid) {
    if (!targets.length) return null;
    const tset = new Set(targets.map(([x, y]) => key(x, y)));
    const prev = new Map();
    const q = [[sx, sy]];
    prev.set(key(sx, sy), null);
    while (q.length) {
      const [x, y] = q.shift();
      if (tset.has(key(x, y))) {
        let k = key(x, y), path = [];
        while (prev.get(k) !== null) { path.push(k); k = prev.get(k); }
        const nk = path[path.length - 1];
        return [nk % W, Math.floor(nk / W)];
      }
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = x + dx, ny = y + dy, nk = key(nx, ny);
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        if (prev.has(nk) || mem.walls.has(nk)) continue;
        if (avoid && avoid.has(nk) && !tset.has(nk)) continue;
        prev.set(nk, key(x, y));
        q.push([nx, ny]);
      }
    }
    return null;
  }

  function dirTo(g, nx, ny) {
    if (nx > g.player.x) return ACT.RIGHT;
    if (nx < g.player.x) return ACT.LEFT;
    if (ny > g.player.y) return ACT.DOWN;
    return ACT.UP;
  }

  function decide(g, mem) {
    if (g.offeredOils) {
      // Simple oil taste: prefer the steady-value oils.
      const pref = ['hungry', 'whale', 'slow', 'flash', 'phoenix', 'storm', 'tallow', 'soul', 'cinder', 'ghost'];
      const pick = g.offeredOils.slice().sort((a, b) => pref.indexOf(a.id) - pref.indexOf(b.id))[0];
      return { oil: pick.id };
    }

    const vis = observe(g, mem);
    const me = g.player;
    const seenEnemies = g.floor.enemies.filter(e =>
      !e.dead && vis[key(e.x, e.y)] && !(e.type === 'mimic' && !e.revealed));
    const adj = seenEnemies.filter(e =>
      Math.abs(e.x - me.x) + Math.abs(e.y - me.y) === 1 && e.type !== 'mirror');
    const inFlare = seenEnemies.filter(e =>
      e.type !== 'mirror' && dist(e.x, e.y, me.x, me.y) <= g.light + TUNE.flareReach);
    const shadesNear = seenEnemies.filter(e => e.type === 'shade' && dist(e.x, e.y, me.x, me.y) <= g.light + 2);

    // Flare when it pays: several targets, or a hard hitter on top of us.
    const flareCost = TUNE.flareCost + (g.oils.includes('slow') ? 0.5 : 0);
    const danger = adj.reduce((s, e) => s + (E.ENEMY[e.type].touch || 0.8), 0);
    if (g.light - flareCost >= 2.0 &&
        (inFlare.length >= 3 || (danger >= 1.0 && inFlare.length >= 1) || shadesNear.length >= 2)) {
      return { action: ACT.FLARE };
    }

    // Threat map: don't step next to something that hits hard.
    const avoid = new Set();
    for (const e of seenEnemies) {
      if (e.type === 'mirror' || e.type === 'moth') continue; // moths die in our light anyway
      for (const [dx, dy] of [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]]) {
        avoid.add(key(e.x + dx, e.y + dy));
      }
    }

    // Refuel when low: visible lit brazier or dropped mote.
    const fuel = [];
    for (const b of g.floor.braziers) if (b.lit && mem.seen.has(key(b.x, b.y))) fuel.push([b.x, b.y]);
    for (const m of g.floor.motes) if (vis[key(m.x, m.y)]) fuel.push([m.x, m.y]);
    if (g.light < 4.2 && fuel.length) {
      const nxt = bfsNext(mem, me.x, me.y, fuel, avoid) || bfsNext(mem, me.x, me.y, fuel, null);
      if (nxt) return { action: dirTo(g, nxt[0], nxt[1]) };
    }

    // A watcher is winding up and we're bright: go dark for a beat.
    const watcherCharging = seenEnemies.some(e => e.type === 'watcher' && e.charge >= 1);
    if (watcherCharging && g.light >= TUNE.watcherBrightThreshold &&
        g.light - TUNE.dimStep >= TUNE.shadePounceThreshold + 0.3 && adj.length === 0) {
      return { action: ACT.DIM };
    }
    // Recover banked light when safe-ish.
    if (g.bank > 0.2 && !watcherCharging && g.light < g.maxLight - 0.5) {
      return { action: ACT.BRIGHTEN };
    }

    // Chase a thief that's carrying our light, if it's close.
    const thief = seenEnemies.find(e => e.type === 'wisp' && e.carried > 0 && dist(e.x, e.y, me.x, me.y) <= 3);
    if (thief) {
      const nxt = bfsNext(mem, me.x, me.y, [[thief.x, thief.y]], null);
      if (nxt) return { action: dirTo(g, nxt[0], nxt[1]) };
    }

    // Moths inbound and we're healthy: stand still and let the lantern eat.
    const mothsInLight = seenEnemies.filter(e => e.type === 'moth' && dist(e.x, e.y, me.x, me.y) <= g.light);
    if (mothsInLight.length && adj.length === 0 && g.light > 3) {
      return { action: ACT.WAIT };
    }

    // Otherwise: head for the exit (top up on a brazier if it's on the way).
    const targets = [];
    if (g.light < g.maxLight - TUNE.brazierGain + 0.5 && fuel.length) targets.push(...fuel);
    targets.push([g.floor.exit.x, g.floor.exit.y]);
    let nxt = bfsNext(mem, me.x, me.y, targets, avoid) || bfsNext(mem, me.x, me.y, targets, null);
    if (nxt) return { action: dirTo(g, nxt[0], nxt[1]) };
    return { action: ACT.WAIT };
  }

  return { newMemory, decide };
});
