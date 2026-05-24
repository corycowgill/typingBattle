/* ===================================================================
   audio.js - tiny Web Audio sound effects (synth, no files).
   Lazy-creates AudioContext on first user gesture so browsers don't
   block it.
   =================================================================== */

const Sound = (() => {
  let ctx = null;
  let muted = false;

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
    setMuted(v) { muted = !!v; },
    isMuted() { return muted; },
  };
})();
