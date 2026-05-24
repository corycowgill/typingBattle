/* ===================================================================
   Word Blaster mode - enemies approach from sides/top with words.
   Type the word to "shoot" them. Lock-on by first letter.
   3 lives; enemies that reach the player end the game.
   =================================================================== */

const ShooterMode = {
  WAVE_SIZE: 18,

  init(ctx) {
    this.ctx = ctx;
    this.stats = Stats.create();
    this.entities = [];
    this.particles = [];
    this.lasers = [];
    this.bgStars = makeBgStars(ctx.canvas.width, ctx.canvas.height, ctx.theme);
    this.lives = 3;
    this.spawnTimer = 0;
    this.spawnInterval = 120;
    this.locked = null;
    this.finished = false;
    this.wordsKilled = 0;
    this.maxWords = this.WAVE_SIZE;

    KB.setLevel(ctx.level);
    this._setHudExtra("Targets", `0/${this.maxWords}`);
    this._renderTarget();
    this._tick = this._tick.bind(this);
    this._raf = requestAnimationFrame(this._tick);
  },

  _wordPool() { return this.ctx.level.words; },

  _spawn() {
    if (this.entities.length + this.wordsKilled >= this.maxWords) return;
    const c = this.ctx.canvas;
    const word = this._wordPool()[Math.floor(Math.random() * this._wordPool().length)];
    const emojis = this.ctx.theme.enemies;
    // Spawn from top, drift down + slight horizontal.
    const x = 80 + Math.random() * (c.width - 160);
    this.entities.push({
      word, typed: "", x, y: -20,
      vx: (Math.random() - 0.5) * 0.6,
      vy: 0.4 + Math.random() * 0.5 + Math.min(1.2, this.stats.score / 250),
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
      KB.highlightNext(w[t.length]);
    } else {
      promptEl.innerHTML = `<span class="char-pending">Type first letter to lock target!</span>`;
      KB.highlightNext(null);
    }
    echoEl.textContent = "Lives: " + "❤".repeat(this.lives);
  },

  handleKey(ch) {
    if (this.finished) return;

    if (!this.locked) {
      const candidates = this.entities.filter(e => e.word[0] === ch);
      if (candidates.length) {
        candidates.sort((a, b) => b.y - a.y);
        this.locked = candidates[0];
        this.locked.typed = ch;
        this.stats.onCorrect(ch);
        KB.flash(ch, true); Sound.correct();
        this._spawnLaser(this.locked);
        if (this.locked.typed === this.locked.word) this._killLocked();
        else this._renderTarget();
      } else {
        this.stats.onWrong(null);
        KB.flash(ch, false); Sound.wrong();
      }
      updateHud(this.stats);
      return;
    }

    const expected = this.locked.word[this.locked.typed.length];
    if (ch === expected) {
      this.locked.typed += ch;
      this.stats.onCorrect(ch);
      KB.flash(ch, true); Sound.correct();
      this._spawnLaser(this.locked);
      if (this.locked.typed === this.locked.word) this._killLocked();
      else this._renderTarget();
    } else {
      this.stats.onWrong(expected);
      KB.flash(ch, false); Sound.wrong();
    }
    updateHud(this.stats);
  },

  _spawnLaser(target) {
    const c = this.ctx.canvas;
    this.lasers.push({
      x1: c.width / 2, y1: c.height - 40,
      x2: target.x, y2: target.y,
      life: 6,
    });
  },

  _killLocked() {
    const e = this.locked;
    this.stats.onWord();
    this.stats.addScore(Math.max(10, e.word.length * 8));
    this.wordsKilled++;
    Sound.word();
    this._burst(e.x, e.y);
    this.entities = this.entities.filter(x => x !== e);
    this.locked = null;
    this._renderTarget();
    this._setHudExtra("Targets", `${this.wordsKilled}/${this.maxWords}`);
    if (this.wordsKilled >= this.maxWords && this.entities.length === 0) {
      Sound.win();
      setTimeout(() => this._finish(), 400);
    }
  },

  _burst(x, y) {
    const emojis = this.ctx.theme.collectibles;
    for (let i = 0; i < 12; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 7,
        vy: (Math.random() - 0.5) * 7,
        life: 36,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
      });
    }
  },

  _loseLife() {
    this.lives--;
    Sound.fail();
    if (this.lives <= 0) this._finish();
  },

  _tick() {
    if (this.finished) return;
    const c = this.ctx.canvas;
    const g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);
    drawBgStars(g, this.bgStars, c.width, c.height);

    this.spawnTimer++;
    if (this.spawnTimer >= this.spawnInterval &&
        this.entities.length + this.wordsKilled < this.maxWords &&
        this.entities.length < 6) {
      this.spawnTimer = 0;
      this._spawn();
      if (this.spawnInterval > 60) this.spawnInterval -= 2;
    }

    const dangerY = c.height - 80;
    for (const e of this.entities) {
      e.x += e.vx;
      e.y += e.vy;
      if (e.x < 40 || e.x > c.width - 40) e.vx *= -1;
      if (e.y >= dangerY) {
        e.dead = true;
        if (e === this.locked) { this.locked = null; this._renderTarget(); }
        this._loseLife();
      }
    }
    this.entities = this.entities.filter(e => !e.dead);

    // Player ship at bottom center.
    g.font = "44px serif";
    g.textAlign = "center";
    g.fillText(this.ctx.theme.player, c.width / 2, c.height - 18);

    // Draw lasers.
    for (const l of this.lasers) {
      g.strokeStyle = `rgba(108, 224, 255, ${l.life / 6})`;
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(l.x1, l.y1); g.lineTo(l.x2, l.y2); g.stroke();
      l.life--;
    }
    this.lasers = this.lasers.filter(l => l.life > 0);

    // Draw enemies.
    for (const e of this.entities) {
      g.font = "44px serif";
      g.textAlign = "center";
      g.fillText(e.emoji, e.x, e.y);
      g.font = "bold 18px system-ui, sans-serif";
      const isLocked = e === this.locked;
      // Background pill for readability.
      const tw = g.measureText(e.word).width;
      g.fillStyle = "rgba(0,0,0,0.5)";
      g.fillRect(e.x - tw / 2 - 6, e.y + 18, tw + 12, 22);
      // Typed portion green, remainder white.
      const typed = e.word.slice(0, e.typed.length);
      const rest = e.word.slice(e.typed.length);
      g.fillStyle = isLocked ? "#5cffa7" : "#5cffa7";
      g.textAlign = "left";
      g.fillText(typed, e.x - tw / 2, e.y + 34);
      g.fillStyle = "#fff";
      g.fillText(rest, e.x - tw / 2 + g.measureText(typed).width, e.y + 34);
    }

    // Danger line.
    g.strokeStyle = "rgba(255,90,90,0.35)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, dangerY); g.lineTo(c.width, dangerY); g.stroke();

    // Particles.
    for (const p of this.particles) {
      g.font = "22px serif";
      g.textAlign = "center";
      g.fillText(p.emoji, p.x, p.y);
      p.x += p.vx; p.y += p.vy; p.life--;
    }
    this.particles = this.particles.filter(p => p.life > 0);

    document.getElementById("typed-echo").textContent = "Lives: " + "❤".repeat(Math.max(0, this.lives));

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
