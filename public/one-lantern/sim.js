#!/usr/bin/env node
/*
 * One Lantern — instrumented playtest harness
 *   node public/one-lantern/sim.js [runs=500] [--seed-prefix=tune] [--json=path]
 *
 * Plays full runs with the fog-of-war bot and aggregates the engine's
 * event counters. Used to tune the ~30% target win rate and to hunt for
 * emergent interactions (see PLAYTESTING.md).
 */
'use strict';
const E = require('./engine.js');
const Bot = require('./bot.js');
const fs = require('fs');

const args = process.argv.slice(2);
const runs = parseInt(args.find(a => /^\d+$/.test(a)) || '500', 10);
const prefix = (args.find(a => a.startsWith('--seed-prefix=')) || '--seed-prefix=tune').split('=')[1];
const jsonPath = (args.find(a => a.startsWith('--json=')) || '=').split('=')[1];

const agg = {
  runs, wins: 0,
  floorReached: {}, deathsBy: {}, deathFloor: {},
  turnsWins: [], turnsAll: [],
  kills: {}, killsBy: { aura: 0, flare: 0, beam: 0, cinder: 0 },
  events: {}, oilPicks: {},
  lightGained: 0, lightLost: 0, flares: 0, dims: 0, braziers: 0, thefts: 0, pulses: 0,
};

for (let i = 0; i < runs; i++) {
  const g = E.newGame({ seed: `${prefix}-${i}`, mode: 'standard' });
  const mem = Bot.newMemory();
  let guard = 0;
  while (!g.over && !g.won && guard++ < 3000) {
    const d = Bot.decide(g, mem);
    if (d.oil) { agg.oilPicks[d.oil] = (agg.oilPicks[d.oil] || 0) + 1; E.chooseOil(g, d.oil); continue; }
    E.step(g, d.action);
  }
  if (g.won) { agg.wins++; agg.turnsWins.push(g.stats.turns); }
  agg.turnsAll.push(g.stats.turns);
  const fl = g.won ? 'WIN' : g.depth;
  agg.floorReached[fl] = (agg.floorReached[fl] || 0) + 1;
  if (!g.won) {
    const c = g.deathCause || (guard >= 3000 ? 'stuck' : '?');
    agg.deathsBy[c] = (agg.deathsBy[c] || 0) + 1;
    agg.deathFloor[g.depth] = (agg.deathFloor[g.depth] || 0) + 1;
  }
  for (const [k, v] of Object.entries(g.stats.kills)) agg.kills[k] = (agg.kills[k] || 0) + v;
  for (const k of Object.keys(agg.killsBy)) agg.killsBy[k] += g.stats.killsBy[k];
  for (const [k, v] of Object.entries(g.stats.events)) agg.events[k] = (agg.events[k] || 0) + v;
  agg.lightGained += g.stats.lightGained;
  agg.lightLost += g.stats.lightLost;
  agg.flares += g.stats.flares;
  agg.dims += g.stats.dims;
  agg.braziers += g.stats.brazierUsed;
  agg.thefts += g.stats.wispThefts;
  agg.pulses += g.stats.pulses;
}

const pct = (n, d) => (100 * n / d).toFixed(1) + '%';
const avg = a => a.length ? (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1) : '-';

console.log(`\n=== One Lantern sim: ${runs} runs (seed prefix "${prefix}") ===`);
console.log(`win rate: ${pct(agg.wins, runs)}  (${agg.wins}/${runs})`);
console.log(`avg turns: all ${avg(agg.turnsAll)}, wins ${avg(agg.turnsWins)}`);
console.log(`\nfloor reached (death floor or WIN):`);
const keys = Object.keys(agg.floorReached).sort((a, b) =>
  (a === 'WIN') - (b === 'WIN') || (+a) - (+b));
for (const k of keys) {
  console.log(`  ${String(k).padStart(4)}: ${String(agg.floorReached[k]).padStart(4)}  ${pct(agg.floorReached[k], runs)}`);
}
console.log(`\ndeaths by cause:`, agg.deathsBy);
console.log(`kills by enemy:`, agg.kills);
console.log(`kills by source:`, agg.killsBy);
console.log(`flares/run: ${(agg.flares / runs).toFixed(2)}  dims/run: ${(agg.dims / runs).toFixed(2)}  braziers/run: ${(agg.braziers / runs).toFixed(2)}`);
console.log(`wisp thefts/run: ${(agg.thefts / runs).toFixed(2)}  watcher pulses/run: ${(agg.pulses / runs).toFixed(2)}`);
console.log(`light gained/run: ${(agg.lightGained / runs).toFixed(1)}  lost/run: ${(agg.lightLost / runs).toFixed(1)}`);
console.log(`oil picks:`, agg.oilPicks);
console.log(`emergence counters:`, agg.events);

if (jsonPath) {
  fs.writeFileSync(jsonPath, JSON.stringify(agg, null, 2));
  console.log(`\nwrote ${jsonPath}`);
}
