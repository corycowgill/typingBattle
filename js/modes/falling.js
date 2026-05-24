/* ===================================================================
   Falling Words mode - words drift down a themed background.
   Type a word to destroy it. 3 lives. Speed ramps with score.
   =================================================================== */

const FallingMode = {
  init(ctx) {
    this.ctx = ctx;
    this.stats = Stats.create();
    this.entities = [];                    // {word, typed, x, y, vy, emoji}
    this.particles = [];
    this.bgStars = makeBgStars(ctx.canvas.width, ctx.canvas.height, ctx.theme);
    this.lives = 3;
    this.spawnTimer = 0;
    this.spawnInterval = 110;              // frames
    this.baseSpeed = 0.6;
    this.locked = null;                    // currently-being-typed entity
    this.finished = false;

    KB.setLevel(ctx.level);
    this._setHudExtra("Lives", "❤❤❤");
    this._renderTarget();
    this._tick = this._tick.bind(this);
    this._raf = requestAnimationFrame(this._tick);
  },

  _wordPool() { return this.ctx.level.words; },

  _spawn() {
    const c = this.ctx.canvas;
    const word = this._wordPool()[Math.floor(Math.random() * this._wordPool().length)];
    const x = 60 + Math.random() * (c.width - 120);
    const emojis = this.ctx.theme.enemies;
    this.entities.push({
      word,
      typed: "",
      x,
      y: -20,
      vy: this.baseSpeed + Math.random() * 0.4 + Math.min(1.8, this.stats.score / 200),
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
    });
  },

  _renderTarget() {
    const promptEl = document.getElementById("target-prompt");
    const echoEl = document.getElementById("typed-echo");
    if (this.locked) {
      const w = this.locked.word, t = this.locked.typed;
      let html = "";
      for (let i = 0; i < w.length; i++) {
        let cls;
        if (i < t.length) cls = "char-correct";
        else if (i === t.length) cls = "char-current";
        else cls = "char-pending";
        html += `<span class="${cls}">${escapeHtml(w[i])}</span>`;
      }
      promptEl.innerHTML = html;
      echoEl.textContent = "Lives: " + "❤".repeat(this.lives);
      KB.highlightNext(w[t.length]);
    } else {
      promptEl.innerHTML = `<span class="char-pending">Type the first letter of any falling word!</span>`;
      echoEl.textContent = "Lives: " + "❤".repeat(this.lives);
      KB.highlightNext(null);
    }
  },

  handleKey(ch) {
    if (this.finished) return;

    // If not locked, try to lock onto an entity whose word starts with this char.
    if (!this.locked) {
      const candidates = this.entities.filter(e => e.word[0] === ch);
      if (candidates.length) {
        // Lock onto the lowest (most urgent) one.
        candidates.sort((a, b) => b.y - a.y);
        this.locked = candidates[0];
        this.locked.typed = ch;
        this.stats.onCorrect(ch);
        KB.flash(ch, true);
        Sound.correct();
        if (this.locked.typed === this.locked.word) this._destroyLocked();
        else this._renderTarget();
      } else {
        this.stats.onWrong(null);
        KB.flash(ch, false);
        Sound.wrong();
      }
      updateHud(this.stats);
      return;
    }

    const expected = this.locked.word[this.locked.typed.length];
    if (ch === expected) {
      this.locked.typed += ch;
      this.stats.onCorrect(ch);
      KB.flash(ch, true);
      Sound.correct();
      if (this.locked.typed === this.locked.word) this._destroyLocked();
      else this._renderTarget();
    } else {
      this.stats.onWrong(expected);
      KB.flash(ch, false);
      Sound.wrong();
    }
    updateHud(this.stats);
  },

  _destroyLocked() {
    const e = this.locked;
    this.stats.onWord();
    this.stats.addScore(Math.max(5, e.word.length * 5));
    Sound.word();
    this._burst(e.x, e.y, this.ctx.theme.collectibles[0]);
    this.entities = this.entities.filter(x => x !== e);
    this.locked = null;
    this._renderTarget();
  },

  _burst(x, y, emoji) {
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6 - 1,
        life: 40,
        emoji,
      });
    }
  },

  _loseLife() {
    this.lives--;
    Sound.fail();
    this._setHudExtra("Lives", "❤".repeat(Math.max(0, this.lives)));
    if (this.lives <= 0) this._finish();
  },

  _tick() {
    if (this.finished) return;
    const c = this.ctx.canvas;
    const g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);
    drawBgStars(g, this.bgStars, c.width, c.height);

    // Spawn timing.
    this.spawnTimer++;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this._spawn();
      // Increase difficulty.
      if (this.spawnInterval > 50) this.spawnInterval -= 1;
    }

    // Update entities.
    const floorY = c.height - 30;
    for (const e of this.entities) {
      e.y += e.vy;
      if (e.y >= floorY) {
        e.dead = true;
        if (e === this.locked) { this.locked = null; this._renderTarget(); }
        this._loseLife();
      }
    }
    this.entities = this.entities.filter(e => !e.dead);

    // Draw entities.
    for (const e of this.entities) {
      g.font = "40px serif";
      g.textAlign = "center";
      g.fillText(e.emoji, e.x, e.y);
      // Word label.
      g.font = "bold 18px system-ui, sans-serif";
      const remaining = e.word.slice(e.typed.length);
      const typed = e.word.slice(0, e.typed.length);
      const isLocked = e === this.locked;
      g.fillStyle = isLocked ? "#5cffa7" : "rgba(255,255,255,0.85)";
      g.fillText(typed, e.x - g.measureText(remaining).width / 2, e.y + 32);
      g.fillStyle = isLocked ? "#fff" : "rgba(255,255,255,0.85)";
      g.fillText(remaining, e.x + g.measureText(typed).width / 2, e.y + 32);
    }

    // Floor line.
    g.strokeStyle = "rgba(255,90,90,0.4)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, floorY + 2);
    g.lineTo(c.width, floorY + 2);
    g.stroke();

    // Particles.
    for (const p of this.particles) {
      g.font = "22px serif";
      g.textAlign = "center";
      g.fillText(p.emoji, p.x, p.y);
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.2; p.life--;
    }
    this.particles = this.particles.filter(p => p.life > 0);

    // HUD score.
    this._setHudExtra("Score", this.stats.score);

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
