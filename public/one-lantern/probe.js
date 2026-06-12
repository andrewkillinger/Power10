#!/usr/bin/env node
/*
 * One Lantern — emergence probe
 *   node public/one-lantern/probe.js [runs=400]
 *
 * Replays bot runs while watching the raw event stream for multi-rule
 * interaction patterns that were never explicitly authored, and prints
 * concrete examples (seed / floor / turn) so they can be reproduced.
 * Findings are written up in PLAYTESTING.md.
 */
'use strict';
const E = require('./engine.js');
const Bot = require('./bot.js');

const runs = parseInt(process.argv[2] || '400', 10);

const patterns = {
  // Wisp theft drops the radius under the shade pounce threshold and a shade
  // lands a hit within 3 turns: the thief heralds the wolves.
  theftCascade: { count: 0, examples: [] },
  // A snuffer kills a brazier and moths that had been orbiting it hit the
  // player within 4 turns: snuffing a brazier releases its swarm at you.
  swarmRelease: { count: 0, examples: [] },
  // A fleeing shade dies to a mirror beam: it was herded out of the lantern's
  // circle straight into borrowed light.
  beamHerd: { count: 0, examples: [] },
  // Moths chase a flare's afterglow while the player walks the other way:
  // the flare works as a decoy, not a weapon.
  flareDecoy: { count: 0, examples: [] },
};

for (let i = 0; i < runs; i++) {
  const seed = `probe-${i}`;
  const g = E.newGame({ seed, mode: 'standard' });
  const mem = Bot.newMemory();
  let guard = 0;
  // Sliding windows of recent happenings, reset per floor.
  let lastTheftTurn = -99, lastSnuffTurn = -99, lastFlareTurn = -99, lastDepth = 1;
  let shadeWasRepelledTurn = -99;

  while (!g.over && !g.won && guard++ < 3000) {
    const d = Bot.decide(g, mem);
    if (d.oil) { E.chooseOil(g, d.oil); continue; }
    const t = g.floorTurn + 1;
    const events = E.step(g, d.action);
    if (g.depth !== lastDepth) { lastTheftTurn = lastSnuffTurn = lastFlareTurn = -99; lastDepth = g.depth; }

    for (const ev of events) {
      if (ev.type === 'wispSteal') lastTheftTurn = t;
      if (ev.type === 'brazierSnuffed') lastSnuffTurn = t;
      if (ev.type === 'flare') lastFlareTurn = t;
      if (ev.type === 'enemyHit' && ev.enemy === 'shade' && ev.source === 'aura') shadeWasRepelledTurn = t;

      if (ev.type === 'playerHit' && ev.cause === 'shade' && t - lastTheftTurn <= 3 && t >= lastTheftTurn) {
        patterns.theftCascade.count++;
        if (patterns.theftCascade.examples.length < 3) {
          patterns.theftCascade.examples.push(`${seed} floor ${g.depth} turn ${t} (theft on turn ${lastTheftTurn}, light now ${g.light.toFixed(2)})`);
        }
      }
      if (ev.type === 'playerHit' && ev.cause === 'moth' && t - lastSnuffTurn <= 4 && t >= lastSnuffTurn) {
        patterns.swarmRelease.count++;
        if (patterns.swarmRelease.examples.length < 3) {
          patterns.swarmRelease.examples.push(`${seed} floor ${g.depth} turn ${t} (brazier snuffed on turn ${lastSnuffTurn})`);
        }
      }
      if (ev.type === 'enemyDie' && ev.enemy === 'shade' && ev.source === 'beam') {
        patterns.beamHerd.count++;
        if (patterns.beamHerd.examples.length < 3) {
          patterns.beamHerd.examples.push(`${seed} fl ${g.depth} t ${t} at (${ev.x},${ev.y}), repelled by aura on t ${shadeWasRepelledTurn}`);
        }
      }
      if (ev.type === 'mothLured' && ev.to === 'afterglow' && t - lastFlareTurn >= 1 && t - lastFlareTurn <= 2) {
        patterns.flareDecoy.count++;
        if (patterns.flareDecoy.examples.length < 3) {
          patterns.flareDecoy.examples.push(`${seed} fl ${g.depth} t ${t}: moth at (${ev.x},${ev.y}) chasing afterglow of turn-${lastFlareTurn} flare`);
        }
      }
    }
  }
}

console.log(`\n=== emergence probe: ${runs} runs ===`);
for (const [name, p] of Object.entries(patterns)) {
  console.log(`\n${name}: ${p.count} occurrences`);
  for (const ex of p.examples) console.log(`   e.g. ${ex}`);
}
