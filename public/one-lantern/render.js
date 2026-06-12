/*
 * One Lantern — renderer
 * Glowing geometric minimalism on darkness. The lantern's gradient IS the
 * art direction: everything else is a thin bright line that only exists
 * where the light reaches.
 */
(function () {
  'use strict';
  const E = window.OneLantern;
  const CELL = 56, PAD = 8;
  const BW = E.W * CELL, BH = E.H * CELL;

  function px(x) { return PAD + x * CELL + CELL / 2; }
  function py(y) { return PAD + y * CELL + CELL / 2; }

  function makeRenderer(canvas) {
    const ctx = canvas.getContext('2d');
    canvas.width = BW + PAD * 2;
    canvas.height = BH + PAD * 2 + 64; // HUD strip below the board

    const R = {
      effects: [],     // transient: {kind, x, y, t0, ttl, ...}
      seenWalls: new Set(),
      lastDepth: 0,
      shake: 0,
    };

    R.addEvents = function (g, events) {
      const now = performance.now();
      for (const ev of events) {
        if (ev.type === 'flare') R.effects.push({ kind: 'flare', x: ev.x, y: ev.y, reach: ev.reach, t0: now, ttl: 450 });
        if (ev.type === 'enemyHit') R.effects.push({ kind: 'spark', x: ev.x, y: ev.y, t0: now, ttl: 250 });
        if (ev.type === 'enemyDie') R.effects.push({ kind: 'pop', x: ev.x, y: ev.y, t0: now, ttl: 420 });
        if (ev.type === 'playerHit') { R.shake = Math.min(8, 3 + ev.amount * 3); }
        if (ev.type === 'wispSteal') R.effects.push({ kind: 'steal', x: ev.x, y: ev.y, t0: now, ttl: 500 });
        if (ev.type === 'watcherPulse') R.effects.push({ kind: 'pulse', x: ev.x, y: ev.y, t0: now, ttl: 600 });
        if (ev.type === 'brazier' || ev.type === 'mote') R.effects.push({ kind: 'drink', x: 0, y: 0, t0: now, ttl: 400 });
        if (ev.type === 'death') R.effects.push({ kind: 'gutter', t0: now, ttl: 1600 });
      }
    };

    function glow(color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
    function noGlow() { ctx.shadowBlur = 0; }

    R.draw = function (g, t) {
      const flick = 1 + Math.sin(t / 130) * 0.012 + Math.sin(t / 47) * 0.008;
      const lightR = Math.max(0, g.light) * CELL * flick;
      const cx0 = px(g.player.x), cy0 = py(g.player.y);

      if (g.depth !== R.lastDepth) { R.seenWalls.clear(); R.lastDepth = g.depth; }

      ctx.save();
      if (R.shake > 0.3) {
        ctx.translate((Math.random() - 0.5) * R.shake, (Math.random() - 0.5) * R.shake);
        R.shake *= 0.86;
      }

      // The dark.
      ctx.fillStyle = '#04050a';
      ctx.fillRect(-12, -12, canvas.width + 24, canvas.height + 24);

      const vis = E.visible(g);
      const beams = E.computeBeams(g);

      // The lantern itself: layered warm gradient.
      let grad = ctx.createRadialGradient(cx0, cy0, 0, cx0, cy0, Math.max(8, lightR + CELL * 0.4));
      grad.addColorStop(0, 'rgba(255,214,140,0.34)');
      grad.addColorStop(0.55, 'rgba(255,176,90,0.16)');
      grad.addColorStop(0.92, 'rgba(255,140,60,0.05)');
      grad.addColorStop(1, 'rgba(255,140,60,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, BH + PAD * 2);

      // Afterglow of a flare: a cooler ghost-light.
      if (g.afterglow) {
        const ax = px(g.afterglow.x), ay = py(g.afterglow.y);
        const ag = ctx.createRadialGradient(ax, ay, 0, ax, ay, CELL * 2.6);
        ag.addColorStop(0, 'rgba(190,220,255,0.20)');
        ag.addColorStop(1, 'rgba(190,220,255,0)');
        ctx.fillStyle = ag;
        ctx.fillRect(0, 0, canvas.width, BH + PAD * 2);
      }

      // Mirror beams: drawn lanes of borrowed light.
      for (const b of beams) {
        const m = b.from;
        const last = b.tiles[b.tiles.length - 1];
        const lg = ctx.createLinearGradient(px(m.x), py(m.y), px(last[0]), py(last[1]));
        lg.addColorStop(0, 'rgba(170,230,255,0.30)');
        lg.addColorStop(1, 'rgba(170,230,255,0.04)');
        ctx.strokeStyle = lg;
        ctx.lineWidth = CELL * 0.5;
        ctx.lineCap = 'round';
        glow('rgba(170,230,255,0.8)', 14);
        ctx.beginPath();
        ctx.moveTo(px(m.x), py(m.y));
        ctx.lineTo(px(last[0]), py(last[1]));
        ctx.stroke();
        noGlow();
      }

      // Cinder trail.
      for (const c of g.cinders) {
        ctx.fillStyle = `rgba(255,150,70,${0.12 * c.ttl})`;
        ctx.beginPath(); ctx.arc(px(c.x), py(c.y), CELL * 0.3, 0, 7); ctx.fill();
      }

      // Walls: only real where light touches them; remembered as scratches.
      for (let y = 0; y < E.H; y++) for (let x = 0; x < E.W; x++) {
        if (!g.floor.walls[E.key(x, y)]) continue;
        const k = E.key(x, y);
        if (vis[k]) R.seenWalls.add(k);
        const d = E.dist(x, y, g.player.x, g.player.y);
        if (vis[k] || d <= g.light + 0.8) {
          const a = Math.max(0, 1 - d / (g.light + 1));
          ctx.fillStyle = `rgba(120,110,128,${0.10 + a * 0.45})`;
          ctx.fillRect(px(x) - CELL * 0.42, py(y) - CELL * 0.42, CELL * 0.84, CELL * 0.84);
          ctx.strokeStyle = `rgba(200,190,210,${0.08 + a * 0.3})`;
          ctx.strokeRect(px(x) - CELL * 0.42, py(y) - CELL * 0.42, CELL * 0.84, CELL * 0.84);
        } else if (R.seenWalls.has(k)) {
          ctx.strokeStyle = 'rgba(110,105,125,0.10)';
          ctx.strokeRect(px(x) - CELL * 0.40, py(y) - CELL * 0.40, CELL * 0.80, CELL * 0.80);
        }
      }

      // Exit: a hole the light falls into.
      {
        const ex = g.floor.exit, k = E.key(ex.x, ex.y);
        const d = E.dist(ex.x, ex.y, g.player.x, g.player.y);
        if (vis[k] || d <= g.light + 0.6) {
          const X = px(ex.x), Y = py(ex.y);
          const eg = ctx.createRadialGradient(X, Y, 2, X, Y, CELL * 0.55);
          eg.addColorStop(0, 'rgba(0,0,0,0.95)');
          eg.addColorStop(0.8, 'rgba(30,40,80,0.5)');
          eg.addColorStop(1, 'rgba(30,40,80,0)');
          ctx.fillStyle = eg;
          ctx.beginPath(); ctx.arc(X, Y, CELL * 0.55, 0, 7); ctx.fill();
          ctx.strokeStyle = 'rgba(140,170,255,0.7)';
          glow('rgba(140,170,255,0.9)', 8);
          for (let i = 0; i < 2; i++) {
            const o = i * 7 + ((t / 300) % 7);
            ctx.beginPath();
            ctx.moveTo(X - 9, Y - 6 + o);
            ctx.lineTo(X, Y + o);
            ctx.lineTo(X + 9, Y - 6 + o);
            ctx.stroke();
          }
          noGlow();
        }
      }

      // Braziers and motes.
      for (const b of g.floor.braziers) {
        const k = E.key(b.x, b.y);
        if (!vis[k] && !(E.dist(b.x, b.y, g.player.x, g.player.y) <= g.light + 1)) {
          // a lit brazier shows over the dark as a far ember
          if (!b.lit) continue;
        }
        drawBrazier(px(b.x), py(b.y), b.lit, t);
      }
      for (const m of g.floor.motes) {
        if (!vis[E.key(m.x, m.y)]) continue;
        ctx.fillStyle = 'rgba(255,230,150,0.95)';
        glow('rgba(255,230,150,1)', 10);
        const wob = Math.sin(t / 110 + m.x * 3) * 2;
        ctx.beginPath(); ctx.arc(px(m.x), py(m.y) + wob, 3.5 + m.amount, 0, 7); ctx.fill();
        noGlow();
      }

      // Enemies.
      for (const e of g.floor.enemies) {
        if (e.dead) continue;
        const k = E.key(e.x, e.y);
        const d = E.dist(e.x, e.y, g.player.x, g.player.y);
        const X = px(e.x), Y = py(e.y);
        if (e.type === 'mimic' && !e.revealed) {
          // A false light glows across the dark exactly like a true one.
          // (Watch the moths: they are never fooled.)
          drawBrazier(X, Y, true, t);
          continue;
        }
        const rim = !vis[k] && d <= g.light + 1.6;
        if (!vis[k] && !rim) continue;
        if (e.type === 'shade' && rim) { drawEyes(X, Y, t); continue; }
        if (!vis[k]) continue;
        drawEnemy(e, X, Y, t, g);
      }

      // Player: the bearer, a small dark figure under a brilliant flame.
      glow('rgba(255,235,180,1)', 22);
      ctx.fillStyle = '#fff4d8';
      ctx.beginPath();
      ctx.moveTo(cx0, cy0 - 11); ctx.lineTo(cx0 + 8, cy0); ctx.lineTo(cx0, cy0 + 11); ctx.lineTo(cx0 - 8, cy0);
      ctx.closePath(); ctx.fill();
      noGlow();
      ctx.fillStyle = 'rgba(20,16,12,0.9)';
      ctx.beginPath(); ctx.arc(cx0, cy0 + 2, 3.2, 0, 7); ctx.fill();

      // Transient effects.
      const now = performance.now();
      R.effects = R.effects.filter(f => now - f.t0 < f.ttl);
      for (const f of R.effects) {
        const p = (now - f.t0) / f.ttl;
        if (f.kind === 'flare') {
          ctx.strokeStyle = `rgba(255,240,200,${0.8 * (1 - p)})`;
          ctx.lineWidth = 5 * (1 - p) + 1;
          glow('rgba(255,240,200,0.9)', 20);
          ctx.beginPath(); ctx.arc(px(f.x), py(f.y), f.reach * CELL * p, 0, 7); ctx.stroke();
          noGlow(); ctx.lineWidth = 1;
        } else if (f.kind === 'spark') {
          ctx.fillStyle = `rgba(255,255,255,${0.9 * (1 - p)})`;
          ctx.beginPath(); ctx.arc(px(f.x), py(f.y), 4 + 6 * p, 0, 7); ctx.fill();
        } else if (f.kind === 'pop') {
          ctx.strokeStyle = `rgba(255,210,140,${0.8 * (1 - p)})`;
          for (let i = 0; i < 6; i++) {
            const a = i * Math.PI / 3, r = 6 + 18 * p;
            ctx.beginPath();
            ctx.moveTo(px(f.x) + Math.cos(a) * 4, py(f.y) + Math.sin(a) * 4);
            ctx.lineTo(px(f.x) + Math.cos(a) * r, py(f.y) + Math.sin(a) * r);
            ctx.stroke();
          }
        } else if (f.kind === 'steal') {
          ctx.fillStyle = `rgba(160,255,240,${0.9 * (1 - p)})`;
          ctx.beginPath(); ctx.arc(px(f.x), py(f.y) - 14 * p, 5, 0, 7); ctx.fill();
        } else if (f.kind === 'pulse') {
          ctx.strokeStyle = `rgba(255,90,120,${0.7 * (1 - p)})`;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(px(f.x), py(f.y), CELL * 6 * p, 0, 7); ctx.stroke();
          ctx.lineWidth = 1;
        } else if (f.kind === 'gutter') {
          ctx.fillStyle = `rgba(0,0,0,${p * 0.9})`;
          ctx.fillRect(-12, -12, canvas.width + 24, canvas.height + 24);
        }
      }

      ctx.restore();
      drawHud(g, t);
    };

    function drawBrazier(X, Y, lit, t) {
      ctx.strokeStyle = lit ? 'rgba(255,190,110,0.95)' : 'rgba(130,120,130,0.45)';
      ctx.lineWidth = 2;
      ctx.strokeRect(X - 8, Y + 2, 16, 8);
      ctx.beginPath(); ctx.moveTo(X - 11, Y + 10); ctx.lineTo(X + 11, Y + 10); ctx.stroke();
      if (lit) {
        const h = 10 + Math.sin(t / 90 + X) * 2.5;
        glow('rgba(255,180,90,1)', 16);
        ctx.fillStyle = 'rgba(255,205,120,0.95)';
        ctx.beginPath();
        ctx.moveTo(X - 5, Y + 2); ctx.quadraticCurveTo(X, Y - h, X + 5, Y + 2);
        ctx.closePath(); ctx.fill();
        noGlow();
      }
      ctx.lineWidth = 1;
    }

    function drawEyes(X, Y, t) {
      const blink = (Math.sin(t / 700 + X) + 1) / 2 > 0.06;
      if (!blink) return;
      ctx.fillStyle = 'rgba(190,160,255,0.8)';
      glow('rgba(190,160,255,0.9)', 6);
      ctx.beginPath(); ctx.arc(X - 4, Y - 2, 1.8, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(X + 4, Y - 2, 1.8, 0, 7); ctx.fill();
      noGlow();
    }

    function drawEnemy(e, X, Y, t, g) {
      ctx.lineWidth = 2;
      switch (e.type) {
        case 'moth': {
          const j = Math.sin(t / 70 + e.x * 5 + e.y * 3) * 3;
          const f = Math.sin(t / 55 + e.x) * 4;
          ctx.fillStyle = 'rgba(235,225,180,0.92)';
          glow('rgba(235,225,180,0.8)', 8);
          ctx.beginPath();
          ctx.moveTo(X + j, Y - 7); ctx.lineTo(X + 7 + f, Y + 6); ctx.lineTo(X - 7 - f, Y + 6);
          ctx.closePath(); ctx.fill();
          noGlow();
          break;
        }
        case 'shade': {
          ctx.strokeStyle = 'rgba(150,120,210,0.85)';
          glow('rgba(120,90,190,0.7)', 10);
          ctx.beginPath(); ctx.arc(X, Y, 10, 0, 7); ctx.stroke();
          noGlow();
          drawEyes(X, Y, t);
          break;
        }
        case 'mirror': {
          ctx.strokeStyle = 'rgba(180,235,255,0.95)';
          glow('rgba(180,235,255,0.9)', 12);
          ctx.beginPath();
          ctx.moveTo(X, Y - 12); ctx.lineTo(X + 9, Y); ctx.lineTo(X, Y + 12); ctx.lineTo(X - 9, Y);
          ctx.closePath(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(X - 4, Y + 5); ctx.lineTo(X + 5, Y - 6); ctx.stroke();
          noGlow();
          break;
        }
        case 'wisp': {
          const o = Math.sin(t / 90 + e.x) * 3;
          ctx.fillStyle = 'rgba(170,255,240,0.95)';
          glow('rgba(170,255,240,1)', 12);
          ctx.beginPath(); ctx.arc(X + o, Y - o, 4.5 + e.carried * 2, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(170,255,240,0.4)';
          ctx.beginPath(); ctx.arc(X + o - 6, Y - o + 6, 2.5, 0, 7); ctx.fill();
          noGlow();
          break;
        }
        case 'snuffer': {
          ctx.strokeStyle = 'rgba(200,90,60,0.9)';
          ctx.fillStyle = 'rgba(40,18,14,0.95)';
          glow('rgba(200,90,60,0.5)', 6);
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = Math.PI / 6 + i * Math.PI / 3;
            const r = 13;
            ctx[i ? 'lineTo' : 'moveTo'](X + Math.cos(a) * r, Y + Math.sin(a) * r);
          }
          ctx.closePath(); ctx.fill(); ctx.stroke();
          noGlow();
          break;
        }
        case 'wraith': {
          ctx.strokeStyle = 'rgba(170,190,230,0.7)';
          ctx.setLineDash([4, 4]);
          ctx.lineDashOffset = -t / 60;
          glow('rgba(170,190,230,0.6)', 8);
          ctx.beginPath(); ctx.arc(X, Y, 11, 0, 7); ctx.stroke();
          ctx.setLineDash([]);
          noGlow();
          break;
        }
        case 'watcher': {
          const hot = e.charge / E.TUNE.watcherChargeNeeded;
          ctx.strokeStyle = 'rgba(255,120,140,0.9)';
          glow(`rgba(255,120,140,${0.4 + hot * 0.6})`, 8 + hot * 14);
          ctx.beginPath(); ctx.arc(X, Y, 11, 0, 7); ctx.stroke();
          ctx.fillStyle = `rgba(255,${160 - hot * 100},${170 - hot * 110},0.95)`;
          ctx.beginPath(); ctx.arc(X, Y, 3.5 + hot * 3, 0, 7); ctx.fill();
          noGlow();
          for (let i = 0; i < e.charge; i++) {
            ctx.fillStyle = 'rgba(255,120,140,0.9)';
            ctx.beginPath(); ctx.arc(X - 8 + i * 8, Y + 16, 2, 0, 7); ctx.fill();
          }
          break;
        }
        case 'mimic': {
          if (!e.revealed) { drawBrazier(X, Y, true, t); break; }
          drawBrazier(X, Y, false, t);
          ctx.strokeStyle = 'rgba(255,120,90,0.95)';
          glow('rgba(255,120,90,0.8)', 10);
          ctx.beginPath();
          for (let i = 0; i < 4; i++) {
            ctx.moveTo(X - 7 + i * 5, Y + 2);
            ctx.lineTo(X - 5 + i * 5, Y - 5);
          }
          ctx.stroke();
          drawEyes(X, Y - 8, t);
          noGlow();
          break;
        }
      }
      ctx.lineWidth = 1;
    }

    function drawHud(g, t) {
      const y0 = BH + PAD * 2;
      ctx.fillStyle = '#04050a';
      ctx.fillRect(0, y0, canvas.width, 64);
      ctx.strokeStyle = 'rgba(255,200,120,0.15)';
      ctx.beginPath(); ctx.moveTo(PAD, y0 + 1); ctx.lineTo(canvas.width - PAD, y0 + 1); ctx.stroke();

      // The lantern gauge: an arc of flame, its length the radius itself.
      const gx = 38, gy = y0 + 32;
      ctx.strokeStyle = 'rgba(80,70,60,0.6)';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(gx, gy, 18, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
      const frac = Math.max(0, Math.min(1, g.light / g.maxLight));
      ctx.strokeStyle = 'rgba(255,200,110,0.95)';
      glow('rgba(255,200,110,0.9)', 10);
      ctx.beginPath(); ctx.arc(gx, gy, 18, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * frac)); ctx.stroke();
      noGlow();
      ctx.lineWidth = 1;
      ctx.fillStyle = '#ffe9c0';
      ctx.font = '13px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(g.light.toFixed(1), gx, gy + 5);

      // Banked light: a covered vial beside the gauge.
      if (g.bank > 0.01) {
        ctx.strokeStyle = 'rgba(160,200,255,0.7)';
        ctx.strokeRect(gx + 30, gy - 14, 10, 28);
        const bh = Math.min(1, g.bank / 4) * 26;
        ctx.fillStyle = 'rgba(160,200,255,0.65)';
        ctx.fillRect(gx + 31, gy + 13 - bh, 8, bh);
      }

      // Depth pips: twelve embers, lit as you pass them.
      const totalFloors = g.mode === 'endless' ? Math.max(12, g.depth) : E.LAST_FLOOR;
      const pw = Math.min(16, (canvas.width - 200) / totalFloors);
      for (let i = 1; i <= totalFloors; i++) {
        const X = 110 + (i - 1) * pw, Y = y0 + 22;
        if (i < g.depth) { ctx.fillStyle = 'rgba(255,190,110,0.85)'; }
        else if (i === g.depth) {
          ctx.fillStyle = `rgba(255,230,160,${0.7 + Math.sin(t / 200) * 0.3})`;
          glow('rgba(255,230,160,0.9)', 8);
        } else ctx.fillStyle = 'rgba(90,85,95,0.5)';
        ctx.beginPath(); ctx.arc(X, Y, i === g.depth ? 4 : 2.6, 0, 7); ctx.fill();
        noGlow();
      }
      if (g.mode === 'endless') {
        ctx.fillStyle = 'rgba(190,200,230,0.8)';
        ctx.textAlign = 'left';
        ctx.fillText('∞ ' + g.depth, 110, y0 + 50);
      }

      // Oils carried: their first runes.
      ctx.textAlign = 'left';
      ctx.font = '11px ui-monospace, monospace';
      let ox = 110;
      for (const id of g.oils) {
        const oil = E.OILS.find(o => o.id === id);
        ctx.fillStyle = 'rgba(255,220,160,0.75)';
        ctx.fillText(oil ? oil.name.split(' ')[0] : id, ox, y0 + (g.mode === 'endless' ? 62 : 44));
        ox += ctx.measureText(oil ? oil.name.split(' ')[0] : id).width + 10;
      }

      // Marked by a watcher: a red iris over everything.
      if (g.marked > 0) {
        ctx.strokeStyle = `rgba(255,90,120,${0.25 + Math.sin(t / 120) * 0.15})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(3, 3, canvas.width - 6, BH + PAD * 2 - 6);
        ctx.lineWidth = 1;
      }
      ctx.textAlign = 'start';
    }

    return R;
  }

  window.OneLanternRender = { makeRenderer, CELL, PAD };
})();
