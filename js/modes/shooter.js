/* ===================================================================
   Word Blaster mode - enemies approach from sides/top with words.
   Type the word to "shoot" them. Lock-on by first letter.
   =================================================================== */

const ShooterMode = {
  WAVE_SIZE: 18,

  init(ctx) {
    this.ctx = ctx;
    this.stats = Stats.create();
    this.entities = [];
    this.particles = [];
    this.popups = [];
    this.lasers = [];
    this.bgStars = makeBgStars(ctx.canvas.width, ctx.canvas.height, ctx.theme);
    this.lives = 3;
    this.spawnTimer = 0;
    this.spawnInterval = 120;
    this.locked = null;
    this.finished = false;
    this.wordsKilled = 0;
    this.maxWords = this.WAVE_SIZE;
    this.shake = 0;
    this.playerBob = 0;

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
    const x = 80 + Math.random() * (c.width - 160);
    this.entities.push({
      word, typed: "", x, y: -20,
      vx: (Math.random() - 0.5) * 0.6,
      vy: 0.4 + Math.random() * 0.5 + Math.min(1.2, this.stats.score / 250),
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      rot: 0, rotV: (Math.random() - 0.5) * 0.05,
      hp: 1,
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
        bumpShake(this, 4);
      }
      updateHud(this.stats);
      App.checkLiveAchievements(this.stats);
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
      bumpShake(this, 4);
    }
    updateHud(this.stats);
    App.checkLiveAchievements(this.stats);
  },

  _spawnLaser(target) {
    const c = this.ctx.canvas;
    this.lasers.push({
      x1: c.width / 2, y1: c.height - 50,
      x2: target.x, y2: target.y,
      life: 10, max: 10,
    });
  },

  _killLocked() {
    const e = this.locked;
    const points = Math.max(10, e.word.length * 8);
    this.stats.onWord();
    this.stats.addScore(points);
    this.wordsKilled++;
    Sound.word();
    this._burst(e.x, e.y);
    spawnPopup(this.popups, e.x, e.y - 10, "+" + points, "#7ee7ff");
    bumpShake(this, 3);
    this.entities = this.entities.filter(x => x !== e);
    this.locked = null;
    this._renderTarget();
    this._setHudExtra("Targets", `${this.wordsKilled}/${this.maxWords}`);
    if (this.wordsKilled >= this.maxWords && this.entities.length === 0) {
      Sound.win();
      setTimeout(() => this._finish(), 500);
    }
  },

  _burst(x, y) {
    const emojis = this.ctx.theme.collectibles;
    for (let i = 0; i < 16; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 42, max: 42,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        rot: 0, rotV: (Math.random() - 0.5) * 0.4,
      });
    }
  },

  _loseLife() {
    this.lives--;
    Sound.fail();
    bumpShake(this, 18);
    spawnPopup(this.popups, this.ctx.canvas.width / 2, this.ctx.canvas.height / 2, "-1 ❤", "#ff6b8a");
    if (this.lives <= 0) this._finish();
  },

  _tick() {
    if (this.finished) return;
    if (App.paused) { this._raf = requestAnimationFrame(this._tick); return; }

    const c = this.ctx.canvas;
    const g = c.getContext("2d");
    const w = c.width, h = c.height;
    const t = performance.now();

    g.save();
    applyShake(g, this);
    g.clearRect(-30, -30, w + 60, h + 60);

    const scene = SceneDrawers[this.ctx.theme.id];
    if (scene) scene(g, w, h, t);
    drawBgStars(g, this.bgStars, w, h);

    // Spawn timing.
    this.spawnTimer++;
    if (this.spawnTimer >= this.spawnInterval &&
        this.entities.length + this.wordsKilled < this.maxWords &&
        this.entities.length < 6) {
      this.spawnTimer = 0;
      this._spawn();
      if (this.spawnInterval > 60) this.spawnInterval -= 2;
    }

    const dangerY = h - 80;
    for (const e of this.entities) {
      e.x += e.vx;
      e.y += e.vy;
      e.rot += e.rotV;
      if (e.x < 40 || e.x > w - 40) e.vx *= -1;
      if (e.y >= dangerY) {
        e.dead = true;
        if (e === this.locked) { this.locked = null; this._renderTarget(); }
        this._loseLife();
      }
    }
    this.entities = this.entities.filter(e => !e.dead);

    // Targeting reticle around locked target (rotating).
    if (this.locked) {
      const e = this.locked;
      g.save();
      g.translate(e.x, e.y);
      g.rotate(t / 600);
      g.strokeStyle = "rgba(94, 234, 212, 0.85)";
      g.lineWidth = 2;
      const r = 36;
      // Four corner brackets.
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        g.beginPath();
        g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        g.lineTo(Math.cos(a + 0.3) * r, Math.sin(a + 0.3) * r);
        g.stroke();
        g.beginPath();
        g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        g.lineTo(Math.cos(a - 0.3) * r, Math.sin(a - 0.3) * r);
        g.stroke();
      }
      g.restore();
    }

    // Draw enemies with rotation.
    for (const e of this.entities) {
      const isLocked = e === this.locked;
      g.save();
      g.translate(e.x, e.y);
      g.rotate(e.rot);
      g.font = "46px serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      if (isLocked) {
        g.shadowColor = "#7ee7ff";
        g.shadowBlur = 18;
      }
      g.fillText(e.emoji, 0, 0);
      g.restore();
      g.textBaseline = "alphabetic";

      // Word label pill.
      g.font = "bold 17px ui-rounded, system-ui, sans-serif";
      const tw = g.measureText(e.word).width;
      const px = e.x - tw / 2 - 8;
      const py = e.y + 26;
      g.fillStyle = isLocked ? "rgba(20, 80, 100, 0.85)" : "rgba(0,0,0,0.55)";
      this._roundRect(g, px, py, tw + 16, 22, 11);
      g.fill();

      const typed = e.word.slice(0, e.typed.length);
      const rest = e.word.slice(e.typed.length);
      g.textAlign = "left";
      g.fillStyle = "#7ee7ff";
      g.fillText(typed, e.x - tw / 2, py + 16);
      g.fillStyle = "#fff";
      g.fillText(rest, e.x - tw / 2 + g.measureText(typed).width, py + 16);
    }

    // Lasers with glow + fade.
    for (const l of this.lasers) {
      const alpha = l.life / l.max;
      g.strokeStyle = `rgba(124, 240, 255, ${alpha})`;
      g.shadowColor = "#7ee7ff";
      g.shadowBlur = 14;
      g.lineWidth = 4;
      g.beginPath(); g.moveTo(l.x1, l.y1); g.lineTo(l.x2, l.y2); g.stroke();
      // Inner core.
      g.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(l.x1, l.y1); g.lineTo(l.x2, l.y2); g.stroke();
      g.shadowBlur = 0;
      l.life--;
    }
    this.lasers = this.lasers.filter(l => l.life > 0);

    // Danger line.
    g.strokeStyle = "rgba(255,90,90,0.4)";
    g.setLineDash([8, 6]);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, dangerY); g.lineTo(w, dangerY); g.stroke();
    g.setLineDash([]);

    // Player ship at bottom (bobbing, with glow).
    this.playerBob = Math.sin(t / 350) * 4;
    const px = w / 2;
    const py = h - 28 + this.playerBob;
    g.save();
    g.translate(px, py);
    g.shadowColor = "rgba(126, 231, 255, 0.6)";
    g.shadowBlur = 20;
    g.font = "48px serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(this.ctx.theme.player, 0, 0);
    g.restore();
    g.textBaseline = "alphabetic";

    // Particles.
    for (const p of this.particles) {
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.globalAlpha = Math.max(0, p.life / p.max);
      g.font = "22px serif";
      g.textAlign = "center";
      g.fillText(p.emoji, 0, 0);
      g.restore();
      p.x += p.vx; p.y += p.vy; p.rot += p.rotV; p.life--;
    }
    g.globalAlpha = 1;
    this.particles = this.particles.filter(p => p.life > 0);

    // Score popups + combo badge.
    this.popups = drawPopups(g, this.popups);
    this._drawComboBadge(g, w);

    document.getElementById("typed-echo").textContent = "Lives: " + "❤".repeat(Math.max(0, this.lives));

    g.restore();
    this._raf = requestAnimationFrame(this._tick);
  },

  _roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y);
    g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r);
    g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  },

  _drawComboBadge(g, w) {
    const streak = this.stats.streak;
    if (streak < 5) return;
    const mult = streak >= 50 ? 4 : streak >= 25 ? 3 : streak >= 10 ? 2 : 1;
    if (mult < 2) return;
    g.save();
    g.font = "900 26px ui-rounded, system-ui, sans-serif";
    g.textAlign = "right";
    g.lineWidth = 4;
    g.strokeStyle = "rgba(0,0,0,0.6)";
    g.strokeText(`x${mult} COMBO!`, w - 16, 36);
    g.fillStyle = "#ffd24a";
    g.fillText(`x${mult} COMBO!`, w - 16, 36);
    g.font = "bold 13px ui-rounded, system-ui, sans-serif";
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.fillText(`${streak} streak`, w - 16, 56);
    g.restore();
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
