/* ===================================================================
   audio.js - tiny Web Audio sound effects (synth, no files).
   Lazy-creates AudioContext on first user gesture so browsers don't
   block it.  Also provides looping ambient background music per theme.
   =================================================================== */

const Sound = (() => {
  let ctx = null;
  let muted = false;
  let bgNodes = null;   // { master, sources: [...] }

  function ensureCtx() {
    if (ctx) return ctx;
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      ctx = new C();
    } catch (e) {
      ctx = null;
    }
    return ctx;
  }

  function beep({ freq = 440, dur = 0.08, type = "sine", vol = 0.15, slide = 0 }) {
    if (muted) return;
    const c = ensureCtx();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, now + dur);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  /* Per-theme ambient chord progressions (Hz). Slow-moving sine pads. */
  const THEME_MUSIC = {
    space:      { notes: [110.00, 164.81, 220.00, 277.18], lfo: 0.13, type: "sine"     },
    underwater: { notes: [130.81, 196.00, 261.63, 329.63], lfo: 0.10, type: "sine"     },
    jungle:     { notes: [146.83, 220.00, 293.66, 369.99], lfo: 0.18, type: "triangle" },
    castle:     { notes: [123.47, 185.00, 246.94, 311.13], lfo: 0.11, type: "sine"     },
  };

  function startBgMusic(themeId) {
    stopBgMusic();
    if (muted) return;
    const c = ensureCtx();
    if (!c) return;
    const cfg = THEME_MUSIC[themeId] || THEME_MUSIC.space;

    const master = c.createGain();
    master.gain.setValueAtTime(0, c.currentTime);
    master.gain.linearRampToValueAtTime(0.045, c.currentTime + 2.5);
    // Soft low-pass to keep the pad warm.
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1200;
    master.connect(lp).connect(c.destination);

    const sources = [];
    cfg.notes.forEach((freq, i) => {
      const osc = c.createOscillator();
      osc.type = cfg.type;
      osc.frequency.value = freq;
      // Slow LFO on pitch for organic motion.
      const lfo = c.createOscillator();
      lfo.frequency.value = cfg.lfo + i * 0.03;
      const lfoGain = c.createGain();
      lfoGain.gain.value = 2.0 + i * 0.5;
      lfo.connect(lfoGain).connect(osc.frequency);

      const noteGain = c.createGain();
      noteGain.gain.value = (i === 0 ? 0.55 : 0.35) / cfg.notes.length;

      osc.connect(noteGain).connect(master);
      osc.start();
      lfo.start();
      sources.push({ osc, lfo });
    });
    bgNodes = { master, sources };
  }

  function stopBgMusic() {
    if (!bgNodes) return;
    const c = ctx;
    if (!c) { bgNodes = null; return; }
    const now = c.currentTime;
    try {
      bgNodes.master.gain.cancelScheduledValues(now);
      bgNodes.master.gain.setValueAtTime(bgNodes.master.gain.value, now);
      bgNodes.master.gain.linearRampToValueAtTime(0, now + 0.4);
      const nodes = bgNodes;
      setTimeout(() => {
        try {
          nodes.sources.forEach(s => { s.osc.stop(); s.lfo.stop(); });
        } catch (e) { /* already stopped */ }
      }, 500);
    } catch (e) { /* no-op */ }
    bgNodes = null;
  }

  return {
    correct() { beep({ freq: 660, dur: 0.05, type: "triangle", vol: 0.08 }); },
    wrong()   { beep({ freq: 180, dur: 0.1,  type: "square",   vol: 0.1, slide: -40 }); },
    word()    { beep({ freq: 880, dur: 0.08, type: "triangle", vol: 0.1, slide: 220 }); },
    levelUp() {
      beep({ freq: 523, dur: 0.1, type: "triangle", vol: 0.12 });
      setTimeout(() => beep({ freq: 659, dur: 0.1, type: "triangle", vol: 0.12 }), 90);
      setTimeout(() => beep({ freq: 784, dur: 0.16, type: "triangle", vol: 0.14 }), 180);
    },
    fail()    { beep({ freq: 200, dur: 0.3, type: "sawtooth", vol: 0.12, slide: -120 }); },
    win()     {
      beep({ freq: 523, dur: 0.12, type: "triangle", vol: 0.14 });
      setTimeout(() => beep({ freq: 659, dur: 0.12, type: "triangle", vol: 0.14 }), 110);
      setTimeout(() => beep({ freq: 784, dur: 0.12, type: "triangle", vol: 0.14 }), 220);
      setTimeout(() => beep({ freq: 1046, dur: 0.2, type: "triangle", vol: 0.16 }), 330);
    },
    powerup() {
      beep({ freq: 700, dur: 0.07, type: "sine", vol: 0.1 });
      setTimeout(() => beep({ freq: 900, dur: 0.07, type: "sine", vol: 0.1 }), 60);
      setTimeout(() => beep({ freq: 1200, dur: 0.12, type: "sine", vol: 0.12 }), 120);
    },
    bossWarn() {
      beep({ freq: 110, dur: 0.4, type: "sawtooth", vol: 0.18, slide: 30 });
      setTimeout(() => beep({ freq: 220, dur: 0.4, type: "sawtooth", vol: 0.15, slide: -50 }), 250);
    },
    bossHit() { beep({ freq: 320, dur: 0.08, type: "square", vol: 0.12, slide: -80 }); },
    bossDefeat() {
      [523, 659, 784, 1046, 1318].forEach((f, i) =>
        setTimeout(() => beep({ freq: f, dur: 0.18, type: "triangle", vol: 0.16 }), i * 110));
    },
    setMuted(v) {
      muted = !!v;
      if (muted) stopBgMusic();
    },
    isMuted() { return muted; },
    startBgMusic,
    stopBgMusic,
  };
})();
