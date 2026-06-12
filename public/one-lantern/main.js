/*
 * One Lantern — shell
 * Menus, input, overlays, persistence. The rules live in engine.js;
 * this file only carries light from the keyboard to the engine.
 */
(function () {
  'use strict';
  const E = window.OneLantern;
  const Audio = window.OneLanternAudio;

  const canvas = document.getElementById('board');
  const R = window.OneLanternRender.makeRenderer(canvas);
  const overlay = document.getElementById('overlay');

  let game = null;
  let mode = 'menu'; // menu | play | oils | dead | won

  // ------------------------------------------------------------- persistence
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem('onelantern.' + k)) ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('onelantern.' + k, JSON.stringify(v)); } catch (e) {} },
  };

  // ------------------------------------------------------------- overlays
  function html(s) { overlay.innerHTML = s; overlay.style.display = 'flex'; }
  function hideOverlay() { overlay.style.display = 'none'; }

  function showMenu() {
    mode = 'menu';
    const daily = E.dailySeed();
    const dailyDone = store.get('daily.' + daily, null);
    const best = store.get('best', null);
    html(`
      <div class="panel">
        <h1>ONE&nbsp;LANTERN</h1>
        <p class="sub">your light is your life, your sight, and your sword</p>
        <button data-go="daily">DAILY ${daily.slice(6)}${dailyDone ? (dailyDone.won ? ' · made it' : ' · floor ' + dailyDone.floor) : ''}</button>
        <button data-go="run">DESCEND</button>
        <button data-go="endless">ENDLESS</button>
        ${best ? `<p class="sub">deepest: floor ${best.floor}${best.won ? ' — and out the other side' : ''}</p>` : ''}
        <p class="keys">move ←↑→↓ · wait <b>space</b> · flare <b>f</b> · dim <b>q</b> · brighten <b>e</b></p>
      </div>`);
  }

  function showOils() {
    mode = 'oils';
    const cards = game.offeredOils.map(o =>
      `<button class="oil" data-oil="${o.id}"><b>${o.name}</b><span>${o.desc}</span></button>`).join('');
    html(`
      <div class="panel">
        <p class="sub">floor ${game.depth - 0} waits below. one oil for the road:</p>
        <div class="oils">${cards}</div>
        <button class="ghostbtn" data-oil="">descend dry</button>
      </div>`);
  }

  function recordEnd() {
    const floor = game.depth, won = game.won;
    const best = store.get('best', { floor: 0, won: false });
    if (floor > best.floor || (won && !best.won)) store.set('best', { floor, won: won || best.won });
    if (game.seed.startsWith('daily-')) {
      const prev = store.get('daily.' + game.seed, null);
      if (!prev || won || floor > prev.floor) store.set('daily.' + game.seed, { floor, won });
    }
  }

  function showDeath() {
    mode = 'dead';
    recordEnd();
    const s = game.stats;
    const kills = Object.values(s.kills).reduce((a, b) => a + b, 0);
    html(`
      <div class="panel">
        <h1 class="dark">THE&nbsp;DARK</h1>
        <p class="sub">the lantern went out on floor ${game.depth}${game.deathCause && game.deathCause !== 'burned out' ? ' — a ' + game.deathCause + ' took the last of it' : ' — it simply burned away'}</p>
        <p class="sub">${s.turns} turns · ${kills} burned · ${s.flares} flares · ${s.brazierUsed} braziers drunk</p>
        <button data-go="again">RELIGHT</button>
        <button data-go="menu">OUT</button>
      </div>`);
  }

  function showWin() {
    mode = 'won';
    recordEnd();
    const s = game.stats;
    html(`
      <div class="panel">
        <h1>DAWN</h1>
        <p class="sub">twelve floors down, and the lantern still burns: ${game.light.toFixed(1)} light left</p>
        <p class="sub">${s.turns} turns · ${Object.values(s.kills).reduce((a, b) => a + b, 0)} burned</p>
        <button data-go="again">AGAIN</button>
        <button data-go="menu">REST</button>
      </div>`);
  }

  overlay.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    Audio.startAmbient();
    if (b.dataset.oil !== undefined && mode === 'oils') {
      E.chooseOil(game, b.dataset.oil || null);
      hideOverlay();
      mode = 'play';
      return;
    }
    const go = b.dataset.go;
    if (go === 'daily') start(E.dailySeed(), 'standard');
    else if (go === 'run') start('run-' + Math.random().toString(36).slice(2, 10), 'standard');
    else if (go === 'endless') start('endless-' + Math.random().toString(36).slice(2, 10), 'endless');
    else if (go === 'again') start(game.mode === 'endless' ? 'endless-' + Math.random().toString(36).slice(2, 10) : 'run-' + Math.random().toString(36).slice(2, 10), game.mode);
    else if (go === 'menu') showMenu();
  });

  function start(seed, gameMode) {
    game = E.newGame({ seed, mode: gameMode });
    R.seenWalls.clear();
    R.effects.length = 0;
    hideOverlay();
    mode = 'play';
  }

  // ------------------------------------------------------------- input
  function act(action) {
    if (mode !== 'play' || !game || game.over || game.won) return;
    const events = E.step(game, action);
    R.addEvents(game, events);
    Audio.onEvents(game, events);
    for (const ev of events) {
      if (ev.type === 'offerOils') { setTimeout(showOils, 350); }
      if (ev.type === 'death') { setTimeout(showDeath, 1400); }
      if (ev.type === 'win') { setTimeout(showWin, 600); }
    }
  }

  const KEYS = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    ' ': 'wait', '.': 'wait',
    f: 'flare', q: 'dim', e: 'brighten',
  };
  window.addEventListener('keydown', (ev) => {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    Audio.startAmbient();
    if (mode === 'menu' || mode === 'dead' || mode === 'won') {
      if (ev.key === 'Enter' || ev.key === 'r') {
        const b = overlay.querySelector('button');
        if (b) b.click();
      }
      return;
    }
    if (mode === 'oils') {
      const i = parseInt(ev.key, 10);
      if (i >= 1 && i <= 3) {
        const b = overlay.querySelectorAll('button.oil')[i - 1];
        if (b) b.click();
      }
      return;
    }
    const a = KEYS[ev.key.length === 1 ? ev.key.toLowerCase() : ev.key];
    if (a) { ev.preventDefault(); act(a); }
  });

  // Touch / mouse on the board: tap a neighbouring cell to step, tap
  // yourself to wait. Buttons below carry the rest.
  canvas.addEventListener('pointerdown', (ev) => {
    Audio.startAmbient();
    if (mode !== 'play' || !game) return;
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width, sy = canvas.height / r.height;
    const x = Math.floor(((ev.clientX - r.left) * sx - 8) / 56);
    const y = Math.floor(((ev.clientY - r.top) * sy - 8) / 56);
    const dx = x - game.player.x, dy = y - game.player.y;
    if (dx === 0 && dy === 0) act('wait');
    else if (Math.abs(dx) > Math.abs(dy)) act(dx > 0 ? 'right' : 'left');
    else if (dy !== 0) act(dy > 0 ? 'down' : 'up');
  });

  for (const b of document.querySelectorAll('#pad button')) {
    b.addEventListener('click', () => { Audio.startAmbient(); act(b.dataset.act); });
  }

  // ------------------------------------------------------------- loop
  function frame(t) {
    if (game) R.draw(game, t);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  showMenu();

  // Debug/test hook (used by the headless verification harness).
  window.__ol = { get game() { return game; }, act, start };
})();
