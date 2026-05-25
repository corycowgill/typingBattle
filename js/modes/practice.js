/* ===================================================================
   Practice mode - calm typing drill.
   One word at a time; on-screen keyboard highlights next key.
   No fail state. Session ends after N words.
   =================================================================== */

const PracticeMode = {
  WORDS_PER_SESSION: 15,

  init(ctx) {
    this.ctx = ctx;
    this.stats = Stats.create();
    this.words = this._buildWordList(ctx.level);
    this.wordIdx = 0;
    this.typed = "";
    this.particles = [];
    this.popups = [];
    this.bgStars = makeBgStars(ctx.canvas.width, ctx.canvas.height, ctx.theme);
    this.shake = 0;
    this.finished = false;

    KB.setLevel(ctx.level);

    this._setHudExtra("Words", `0/${this.WORDS_PER_SESSION}`);
    this._loadWord();
    this._tick = this._tick.bind(this);
    this._raf = requestAnimationFrame(this._tick);
  },

  _buildWordList(lesson) {
    const pool = lesson.words.slice();
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
        const points = 10 + Math.min(50, this.stats.streak);
        this.stats.addScore(points);
        Sound.word();
        this._spawnConfetti();
        spawnPopup(this.popups,
          this.ctx.canvas.width / 2, this.ctx.canvas.height / 2 - 30,
          "+" + points + "  " + target.toUpperCase() + "!",
          "#5cffa7");
        this.wordIdx++;
        this._setHudExtra("Words", `${this.wordIdx}/${this.WORDS_PER_SESSION}`);
        setTimeout(() => this._loadWord(), 350);
      } else {
        KB.highlightNext(target[this.typed.length]);
      }
    } else {
      this.stats.onWrong(expected);
      KB.flash(ch, false);
      Sound.wrong();
      bumpShake(this, 3);
      const el = document.getElementById("target-prompt");
      el.style.animation = "none";
      void el.offsetHeight;
      el.style.animation = "shake 0.18s";
    }
    updateHud(this.stats);
    App.checkLiveAchievements(this.stats);
  },

  _spawnConfetti() {
    const c = this.ctx.canvas;
    const w = c.width, h = c.height;
    for (let i = 0; i < 20; i++) {
      this.particles.push({
        x: w / 2,
        y: h / 2,
        vx: (Math.random() - 0.5) * 10,
        vy: -Math.random() * 8 - 2,
        life: 70, max: 70,
        emoji: this.ctx.theme.collectibles[i % this.ctx.theme.collectibles.length],
        rot: 0, rotV: (Math.random() - 0.5) * 0.4,
      });
    }
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

    // Big breathing player emoji centered as a background mascot.
    const breathe = 1 + Math.sin(t / 700) * 0.05;
    g.save();
    g.translate(w / 2, h / 2 - 20);
    g.scale(breathe, breathe);
    g.globalAlpha = 0.25;
    g.font = "180px serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(this.ctx.theme.player, 0, 0);
    g.restore();
    g.globalAlpha = 1;
    g.textBaseline = "alphabetic";

    // Progress bar at top.
    const barX = w / 2 - 180, barY = 28, barW = 360, barH = 14;
    g.fillStyle = "rgba(0,0,0,0.5)";
    this._roundRect(g, barX, barY, barW, barH, 7); g.fill();
    const ratio = this.wordIdx / this.WORDS_PER_SESSION;
    const grad = g.createLinearGradient(barX, 0, barX + barW, 0);
    grad.addColorStop(0, "#5cffa7"); grad.addColorStop(1, "#7ee7ff");
    g.fillStyle = grad;
    this._roundRect(g, barX, barY, Math.max(3, ratio * barW), barH, 7); g.fill();
    g.fillStyle = "#fff";
    g.font = "bold 12px ui-rounded, system-ui, sans-serif";
    g.textAlign = "center";
    g.fillText(`${this.wordIdx} / ${this.WORDS_PER_SESSION} words`, w / 2, barY - 6);

    // Confetti.
    for (const p of this.particles) {
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.globalAlpha = Math.max(0, p.life / p.max);
      g.font = "26px serif";
      g.textAlign = "center";
      g.fillText(p.emoji, 0, 0);
      g.restore();
      p.x += p.vx; p.y += p.vy; p.vy += 0.22; p.rot += p.rotV; p.life--;
    }
    g.globalAlpha = 1;
    this.particles = this.particles.filter(p => p.life > 0);

    this.popups = drawPopups(g, this.popups);
    this._drawComboBadge(g, w);

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
    g.font = "900 24px ui-rounded, system-ui, sans-serif";
    g.textAlign = "right";
    g.lineWidth = 4;
    g.strokeStyle = "rgba(0,0,0,0.6)";
    g.strokeText(`x${mult} COMBO!`, w - 16, 78);
    g.fillStyle = "#ffd24a";
    g.fillText(`x${mult} COMBO!`, w - 16, 78);
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
