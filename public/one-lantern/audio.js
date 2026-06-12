/*
 * One Lantern — audio
 * Everything synthesized with WebAudio: a slow detuned drone for the dark,
 * filtered noise for fire, small struck tones for the turn-by-turn grammar.
 * No samples, no files.
 */
(function () {
  'use strict';
  let ac = null, master = null, started = false;

  function ensure() {
    if (ac) return true;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = 0.5;
      master.connect(ac.destination);
      return true;
    } catch (e) { return false; }
  }

  function noiseBuffer() {
    const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  function startAmbient() {
    if (started || !ensure()) return;
    started = true;
    if (ac.state === 'suspended') ac.resume();

    // Two detuned low drones, breathing slowly against each other.
    for (const [freq, det, vol] of [[55, 0, 0.05], [55.35, 3, 0.04], [110.2, -2, 0.018]]) {
      const o = ac.createOscillator();
      o.type = 'sine'; o.frequency.value = freq; o.detune.value = det;
      const g = ac.createGain(); g.gain.value = vol;
      const lfo = ac.createOscillator(); lfo.frequency.value = 0.05 + Math.random() * 0.06;
      const lfoG = ac.createGain(); lfoG.gain.value = vol * 0.5;
      lfo.connect(lfoG); lfoG.connect(g.gain);
      o.connect(g); g.connect(master);
      o.start(); lfo.start();
    }
    // The lantern: quiet crackling — bandpassed noise, amplitude-flickered.
    const n = ac.createBufferSource(); n.buffer = noiseBuffer(); n.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.6;
    const ng = ac.createGain(); ng.gain.value = 0.008;
    const fl = ac.createOscillator(); fl.type = 'triangle'; fl.frequency.value = 7.3;
    const flG = ac.createGain(); flG.gain.value = 0.006;
    fl.connect(flG); flG.connect(ng.gain);
    n.connect(bp); bp.connect(ng); ng.connect(master);
    n.start(); fl.start();
  }

  function env(g, t0, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec);
  }

  function tone(freq, type, peak, attack, decay, when, slideTo) {
    if (!ac) return;
    const t0 = ac.currentTime + (when || 0);
    const o = ac.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + attack + decay);
    const g = ac.createGain();
    env(g, t0, attack, peak, decay);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + attack + decay + 0.05);
  }

  function noiseHit(peak, decay, freq, when) {
    if (!ac) return;
    const t0 = ac.currentTime + (when || 0);
    const n = ac.createBufferSource(); n.buffer = noiseBuffer();
    const f = ac.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t0);
    f.frequency.exponentialRampToValueAtTime(120, t0 + decay);
    const g = ac.createGain();
    env(g, t0, 0.01, peak, decay);
    n.connect(f); f.connect(g); g.connect(master);
    n.start(t0); n.stop(t0 + decay + 0.1);
  }

  const sfx = {
    move() { tone(2200, 'sine', 0.025, 0.002, 0.03); },
    bump() { tone(140, 'square', 0.05, 0.004, 0.07); },
    wait() { tone(1600, 'sine', 0.015, 0.002, 0.04); },
    flare() { noiseHit(0.30, 0.5, 6000); tone(220, 'sawtooth', 0.10, 0.01, 0.4, 0, 60); },
    dim() { tone(700, 'sine', 0.06, 0.02, 0.25, 0, 240); },
    brighten() { tone(240, 'sine', 0.06, 0.02, 0.25, 0, 700); },
    hit(light) {
      // The thud falls in pitch as your circle falls in size.
      const f = 70 + 60 * Math.max(0, Math.min(1, (light || 4) / 8));
      tone(f, 'sine', 0.22, 0.005, 0.3);
      noiseHit(0.08, 0.15, 900);
    },
    kill() { tone(1320, 'sine', 0.05, 0.005, 0.18); tone(1980, 'sine', 0.03, 0.005, 0.22, 0.03); },
    brazier() { for (const [f, w] of [[392, 0], [494, 0.06], [587, 0.12]]) tone(f, 'triangle', 0.07, 0.01, 0.4, w); },
    mote() { tone(1760, 'sine', 0.05, 0.004, 0.25); },
    steal() { tone(990, 'sine', 0.08, 0.01, 0.3, 0, 1900); },
    pulse() { tone(98, 'sawtooth', 0.12, 0.02, 0.6); tone(101, 'sawtooth', 0.1, 0.02, 0.6); },
    reveal() { tone(160, 'square', 0.09, 0.01, 0.25, 0, 90); },
    descend() { for (const [f, w] of [[440, 0], [349, 0.12], [262, 0.24]]) tone(f, 'triangle', 0.07, 0.01, 0.35, w); },
    win() { for (const [f, w] of [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.38]]) tone(f, 'triangle', 0.09, 0.01, 0.6, w); },
    death() {
      tone(196, 'sine', 0.15, 0.02, 2.2, 0, 38);
      noiseHit(0.12, 1.8, 1200, 0.1);
    },
  };

  function onEvents(g, events) {
    if (!ac) return;
    for (const ev of events) {
      switch (ev.type) {
        case 'move': sfx.move(); break;
        case 'bump': sfx.bump(); break;
        case 'flare': sfx.flare(); break;
        case 'dim': sfx.dim(); break;
        case 'brighten': sfx.brighten(); break;
        case 'playerHit': sfx.hit(g.light); break;
        case 'enemyDie': sfx.kill(); break;
        case 'brazier': sfx.brazier(); break;
        case 'mote': sfx.mote(); break;
        case 'wispSteal': sfx.steal(); break;
        case 'watcherPulse': sfx.pulse(); break;
        case 'mimicReveal': sfx.reveal(); break;
        case 'descend': sfx.descend(); break;
        case 'win': sfx.win(); break;
        case 'death': sfx.death(); break;
      }
    }
  }

  window.OneLanternAudio = { startAmbient, onEvents, sfx };
})();
