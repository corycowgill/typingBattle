/* ===================================================================
   Falling Words mode - words drift down a themed background.
   Type a word to destroy it. 3 lives. Speed ramps with score.
   =================================================================== */

const FallingMode = {
  init(ctx) {
    this.ctx = ctx;
    this.stats = Stats.create();
    this.entities = [];                    // {word, typed, x, y, vy, emoji, rot}
    this.particles = [];
    this.popups = [];
    this.bgStars = makeBgStars(ctx.canvas.width, ctx.canvas.height, ctx.theme);
    this.lives = 3;
    this.spawnTimer = 0;
    this.spawnInterval = 110;              // frames
    this.baseSpeed = 0.6;
    this.locked = null;
    this.finished = false;
    this.shake = 0;
    this.lifeBlink = 0;

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
      word, typed: "", x, y: -20,
      vy: this.baseSpeed + Math.random() * 0.4 + Math.min(1.8, this.stats.score / 200),
      vx: (Math.random() - 0.5) * 0.3,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      rot: 0, rotV: (Math.random() - 0.5) * 0.04,
      sparkPhase: Math.random() * Math.PI * 2,
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

    if (!this.locked) {
      const candidates = this.entities.filter(e => e.word[0] === ch);
      if (candidates.length) {
        candidates.sort((a, b) => b.y - a.y);
        this.locked = candidates[0];
        this.locked.typed = ch;
        this.stats.onCorrect(ch);
        KB.flash(ch, true); Sound.correct();
        if (this.locked.typed === this.locked.word) this._destroyLocked();
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
      if (this.locked.typed === this.locked.word) this._destroyLocked();
      else this._renderTarget();
    } else {
      this.stats.onWrong(expected);
      KB.flash(ch, false); Sound.wrong();
      bumpShake(this, 4);
    }
    updateHud(this.stats);
    App.checkLiveAchievements(this.stats);
  },

  _destroyLocked() {
    const e = this.locked;
    const points = Math.max(5, e.word.length * 5);
    this.stats.onWord();
    this.stats.addScore(points);
    Sound.word();
    this._burst(e.x, e.y, this.ctx.theme.collectibles[0]);
    spawnPopup(this.popups, e.x, e.y - 10, "+" + points, "#5cffa7");
    this.entities = this.entities.filter(x => x !== e);
    this.locked = null;
    this._renderTarget();
  },

  _burst(x, y, emoji) {
    for (let i = 0; i < 14; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 7,
        vy: (Math.random() - 0.5) * 7 - 1,
        life: 45, max: 45,
        emoji, rot: 0, rotV: (Math.random() - 0.5) * 0.3,
      });
    }
  },

  _loseLife() {
    this.lives--;
    Sound.fail();
    bumpShake(this, 16);
    this.lifeBlink = 24;
    spawnPopup(this.popups, this.ctx.canvas.width / 2, this.ctx.canvas.height / 2, "-1 ❤", "#ff6b8a");
    this._setHudExtra("Lives", "❤".repeat(Math.max(0, this.lives)));
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

    // Background scene + drifting stars (parallax).
    g.clearRect(-30, -30, w + 60, h + 60);
    const scene = SceneDrawers[this.ctx.theme.id];
    if (scene) scene(g, w, h, t);
    drawBgStars(g, this.bgStars, w, h);

    // Spawn timing.
    this.spawnTimer++;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this._spawn();
      if (this.spawnInterval > 50) this.spawnInterval -= 1;
    }

    // Update entities.
    const floorY = h - 30;
    for (const e of this.entities) {
      e.y += e.vy;
      e.x += e.vx;
      e.rot += e.rotV;
      e.sparkPhase += 0.12;
      if (e.y >= floorY) {
        e.dead = true;
        if (e === this.locked) { this.locked = null; this._renderTarget(); }
        this._loseLife();
      }
    }
    this.entities = this.entities.filter(e => !e.dead);

    // Draw entities (with bobbing rotation + locked-on sparkle).
    for (const e of this.entities) {
      const isLocked = e === this.locked;
      g.save();
      g.translate(e.x, e.y);
      g.rotate(e.rot);
      g.font = "44px serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      if (isLocked) {
        g.shadowColor = "#5cffa7";
        g.shadowBlur = 18;
      }
      g.fillText(e.emoji, 0, 0);
      g.restore();
      g.textBaseline = "alphabetic";

      // Sparkle ring around locked target.
      if (isLocked) {
        for (let i = 0; i < 4; i++) {
          const a = e.sparkPhase + (i * Math.PI / 2);
          const rx = e.x + Math.cos(a) * 32;
          const ry = e.y + Math.sin(a) * 32;
          g.fillStyle = "rgba(124, 255, 180, " + (0.6 + 0.3 * Math.sin(t / 120 + i)) + ")";
          g.beginPath(); g.arc(rx, ry, 2.5, 0, Math.PI * 2); g.fill();
        }
      }

      // Word label with rounded pill background.
      g.font = "bold 17px ui-rounded, system-ui, sans-serif";
      const tw = g.measureText(e.word).width;
      const px = e.x - tw / 2 - 8;
      const py = e.y + 26;
      g.fillStyle = isLocked ? "rgba(40, 100, 60, 0.85)" : "rgba(0,0,0,0.55)";
      this._roundRect(g, px, py, tw + 16, 22, 11);
      g.fill();

      const typed = e.word.slice(0, e.typed.length);
      const rest = e.word.slice(e.typed.length);
      g.textAlign = "left";
      g.fillStyle = "#5cffa7";
      g.fillText(typed, e.x - tw / 2, py + 16);
      g.fillStyle = isLocked ? "#fff" : "rgba(255,255,255,0.92)";
      g.fillText(rest, e.x - tw / 2 + g.measureText(typed).width, py + 16);
    }

    // Danger floor line (blinks red after life loss).
    const blink = this.lifeBlink > 0 ? Math.sin(this.lifeBlink * 0.5) * 0.4 + 0.6 : 0.3;
    if (this.lifeBlink > 0) this.lifeBlink--;
    const grad = g.createLinearGradient(0, floorY, 0, floorY + 30);
    grad.addColorStop(0, `rgba(255, 90, 110, ${blink})`);
    grad.addColorStop(1, "rgba(255, 90, 110, 0)");
    g.fillStyle = grad;
    g.fillRect(0, floorY, w, 30);

    // Confetti particles (with rotation).
    for (const p of this.particles) {
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.globalAlpha = Math.max(0, p.life / p.max);
      g.font = "22px serif";
      g.textAlign = "center";
      g.fillText(p.emoji, 0, 0);
      g.restore();
      p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.rot += p.rotV; p.life--;
    }
    g.globalAlpha = 1;
    this.particles = this.particles.filter(p => p.life > 0);

    // Score popups.
    this.popups = drawPopups(g, this.popups);

    // Combo / streak badge in top-right of canvas.
    this._drawComboBadge(g, w);

    // HUD score.
    this._setHudExtra("Score", this.stats.score);

    g.restore();
    this._raf = requestAnimationFrame(this._tick);
  },

  _roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
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
