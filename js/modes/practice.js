/* ===================================================================
   Practice mode - calm typing drill.
   One word at a time; on-screen keyboard highlights next key.
   No fail state. Session ends after N words.
   =================================================================== */

const PracticeMode = {
  WORDS_PER_SESSION: 15,

  init(ctx) {
    this.ctx = ctx;                          // { canvas, level, theme, onEnd }
    this.stats = Stats.create();
    this.words = this._buildWordList(ctx.level);
    this.wordIdx = 0;
    this.typed = "";
    this.particles = [];

    KB.setLevel(ctx.level);

    this._setHudExtra("Words", `0/${this.WORDS_PER_SESSION}`);
    this._loadWord();
    this._tick = this._tick.bind(this);
    this._raf = requestAnimationFrame(this._tick);
  },

  _buildWordList(lesson) {
    const pool = lesson.words.slice();
    // Shuffle and pad up to WORDS_PER_SESSION.
    const out = [];
    while (out.length < this.WORDS_PER_SESSION) {
      const shuffled = pool.slice().sort(() => Math.random() - 0.5);
      for (const w of shuffled) {
        if (out.length >= this.WORDS_PER_SESSION) break;
        out.push(w);
      }
    }
    return out;
  },

  _loadWord() {
    if (this.wordIdx >= this.words.length) { this._finish(); return; }
    this.typed = "";
    const target = this.words[this.wordIdx];
    this._renderTarget(target, "");
    KB.highlightNext(target[0]);
  },

  _renderTarget(target, typed) {
    const el = document.getElementById("target-prompt");
    let html = "";
    for (let i = 0; i < target.length; i++) {
      const ch = target[i];
      let cls = "char-pending";
      if (i < typed.length) {
        cls = typed[i] === ch ? "char-correct" : "char-wrong";
      } else if (i === typed.length) {
        cls = "char-current";
      }
      html += `<span class="${cls}">${ch === " " ? "&nbsp;" : escapeHtml(ch)}</span>`;
    }
    el.innerHTML = html;
    document.getElementById("typed-echo").textContent = "";
  },

  handleKey(ch) {
    if (this.finished) return;
    const target = this.words[this.wordIdx];
    const expected = target[this.typed.length];
    if (ch === expected) {
      this.typed += ch;
      this.stats.onCorrect(ch);
      KB.flash(ch, true);
      Sound.correct();
      this._renderTarget(target, this.typed);
      if (this.typed === target) {
        this.stats.onWord();
        Sound.word();
        this._spawnConfetti();
        this.wordIdx++;
        this._setHudExtra("Words", `${this.wordIdx}/${this.WORDS_PER_SESSION}`);
        setTimeout(() => this._loadWord(), 250);
      } else {
        KB.highlightNext(target[this.typed.length]);
      }
    } else {
      this.stats.onWrong(expected);
      KB.flash(ch, false);
      Sound.wrong();
      // Shake target prompt briefly.
      const el = document.getElementById("target-prompt");
      el.style.animation = "none";
      // eslint-disable-next-line no-unused-expressions
      el.offsetHeight;
      el.style.animation = "shake 0.18s";
    }
    updateHud(this.stats);
  },

  _spawnConfetti() {
    const c = this.ctx.canvas;
    const w = c.width, h = c.height;
    for (let i = 0; i < 14; i++) {
      this.particles.push({
        x: w / 2,
        y: h / 2,
        vx: (Math.random() - 0.5) * 8,
        vy: -Math.random() * 6 - 2,
        life: 60,
        emoji: this.ctx.theme.collectibles[i % this.ctx.theme.collectibles.length],
      });
    }
  },

  _tick() {
    if (this.finished) return;
    const c = this.ctx.canvas;
    const g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);
    drawBackgroundStars(g, this.ctx.theme, c.width, c.height);

    // Show a big encouraging emoji center.
    g.font = "180px serif";
    g.textAlign = "center";
    g.globalAlpha = 0.18;
    g.fillText(this.ctx.theme.player, c.width / 2, c.height / 2 + 60);
    g.globalAlpha = 1;

    // Particles.
    for (const p of this.particles) {
      g.font = "26px serif";
      g.fillText(p.emoji, p.x, p.y);
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.25;
      p.life--;
    }
    this.particles = this.particles.filter(p => p.life > 0);

    this._raf = requestAnimationFrame(this._tick);
  },

  _setHudExtra(label, val) {
    document.getElementById("hud-extra-label").textContent = label;
    document.getElementById("hud-extra").textContent = val;
  },

  _finish() {
    if (this.finished) return;
    this.finished = true;
    cancelAnimationFrame(this._raf);
    this.ctx.onEnd(this.stats);
  },

  destroy() {
    this.finished = true;
    cancelAnimationFrame(this._raf);
  },
};
