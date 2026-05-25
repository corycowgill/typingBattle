/* ===================================================================
   Word Pop mode - letters pop up like whack-a-mole.
   Type the letter to pop it before it fades. Calm, fast-paced drill
   for letter recognition. Letters are colored by which finger should
   press them so kids see the finger pattern.
   =================================================================== */

const WordPopMode = {
  TOTAL_POPS: 30,

  init(ctx) {
    this.ctx = ctx;
    this.stats = Stats.create();
    this.pops = [];                       // active letter bubbles
    this.particles = [];
    this.popups = [];
    this.bgStars = makeBgStars(ctx.canvas.width, ctx.canvas.height, ctx.theme);
    this.popped = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 60;              // frames between spawns (1s @ 60fps)
    this.shake = 0;
    this.finished = false;

    // Eligible letters from the current lesson.
    const raw = ctx.level.keys.split("");
    this.letterPool = raw.filter(c => c.match(/[a-z0-9]/i)).map(c => c.toLowerCase());
    if (!this.letterPool.length) this.letterPool = ["a","s","d","f","j","k","l"];

    KB.setLevel(ctx.level);
    setHudExtra("Popped", `0/${this.TOTAL_POPS}`);
    this._renderTarget();
    this._tick = this._tick.bind(this);
    this._raf = requestAnimationFrame(this._tick);
  },

  _renderTarget() {
    const promptEl = document.getElementById("target-prompt");
    const echoEl = document.getElementById("typed-echo");
    if (this.pops.length) {
      // Show the oldest pop's letter as the "next target" highlight.
      const oldest = this.pops[0];
      promptEl.innerHTML = `<span class="char-current">${escapeHtml(oldest.letter)}</span>` +
        (this.pops.length > 1
          ? ` <span class="char-pending">+${this.pops.length - 1} more</span>`
          : "");
      KB.highlightNext(oldest.letter);
    } else {
      promptEl.innerHTML = `<span class="char-pending">Pop the letters as they appear!</span>`;
      KB.highlightNext(null);
    }
    echoEl.textContent = `Popped ${this.popped} of ${this.TOTAL_POPS}`;
  },

  _spawn() {
    if (this.popped + this.pops.length >= this.TOTAL_POPS) return;
    const c = this.ctx.canvas;
    const letter = this.letterPool[Math.floor(Math.random() * this.letterPool.length)];
    const margin = 80;
    const x = margin + Math.random() * (c.width - 2 * margin);
    const y = 70 + Math.random() * (c.height - 130);
    const life = 150 + Math.random() * 60;      // ~2.5-3.5s
    this.pops.push({
      letter, x, y,
      life, max: life,
      birth: performance.now(),
      color: this._colorForFinger(letter),
      emoji: this._randomCollectible(),
    });
    this._renderTarget();
  },

  _colorForFinger(letter) {
    const f = FINGER_MAP[letter] || "index";
    const colors = {
      pinky:  "#ff7e85",
      ring:   "#ffa15c",
      middle: "#ffd24a",
      index:  "#8af09a",
      thumb:  "#c98aff",
    };
    return colors[f] || "#8af09a";
  },

  _randomCollectible() {
    const c = this.ctx.theme.collectibles;
    return c[Math.floor(Math.random() * c.length)];
  },

  handleKey(ch) {
    if (this.finished) return;
    const lc = ch.toLowerCase();
    // Match the OLDEST pop with this letter (most urgent).
    const idx = this.pops.findIndex(p => p.letter === lc);
    if (idx >= 0) {
      const p = this.pops[idx];
      this.stats.onCorrect(ch);
      const points = 5 + Math.min(20, this.stats.streak);
      this.stats.addScore(points);
      this.stats.onWord();
      this.popped++;
      KB.flash(ch, true); Sound.correct(); Sound.word();
      this._burst(p.x, p.y, p.color);
      spawnPopup(this.popups, p.x, p.y - 10, "+" + points, p.color);
      this.pops.splice(idx, 1);
      setHudExtra("Popped", `${this.popped}/${this.TOTAL_POPS}`);
      this._renderTarget();
      // Speed up as we go.
      this.spawnInterval = Math.max(30, 60 - Math.floor(this.popped / 4) * 3);
      if (this.popped >= this.TOTAL_POPS) {
        Sound.win();
        setTimeout(() => this._finish(), 700);
      }
    } else {
      this.stats.onWrong(null);
      KB.flash(ch, false); Sound.wrong();
      bumpShake(this, 3);
    }
    updateHud(this.stats);
    App.checkLiveAchievements(this.stats);
  },

  _burst(x, y, color) {
    burstDots(this.particles, x, y, 10, color);
    burstDots(this.particles, x, y, 6, "#ffffff");
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

    // Spawn pops.
    this.spawnTimer++;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this._spawn();
    }

    // Update + draw pops.
    for (const p of this.pops) {
      p.life--;
      if (p.life <= 0) {
        p.dead = true;
        continue;
      }
      const age = (p.max - p.life) / p.max;            // 0 = fresh, 1 = expiring
      // Scale-in animation in the first 8 frames.
      const popInP = Math.min(1, (p.max - p.life) / 8);
      const scale = popInP < 1
        ? popInP * 1.2 + (1 - popInP) * 0.2   // bouncy
        : 1 + Math.sin(t / 200 + p.x) * 0.04;

      // Bubble background with color halo.
      g.save();
      g.translate(p.x, p.y);
      g.scale(scale, scale);
      const halo = g.createRadialGradient(0, 0, 8, 0, 0, 46);
      halo.addColorStop(0, p.color + "cc");
      halo.addColorStop(1, p.color + "00");
      g.fillStyle = halo;
      g.beginPath(); g.arc(0, 0, 46, 0, Math.PI * 2); g.fill();

      // Bubble.
      g.fillStyle = p.color;
      g.beginPath(); g.arc(0, 0, 30, 0, Math.PI * 2); g.fill();
      // Inner highlight for depth.
      g.fillStyle = "rgba(255,255,255,0.35)";
      g.beginPath(); g.arc(-8, -10, 12, 0, Math.PI * 2); g.fill();
      // Outline.
      g.strokeStyle = "rgba(255,255,255,0.7)";
      g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, 30, 0, Math.PI * 2); g.stroke();

      // Letter.
      g.fillStyle = "#10121c";
      g.font = "900 32px ui-rounded, system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(p.letter.toUpperCase(), 0, 2);

      g.restore();
      g.textBaseline = "alphabetic";

      // Timer ring around bubble (shows time remaining).
      g.save();
      g.translate(p.x, p.y);
      g.strokeStyle = "rgba(255,255,255,0.85)";
      g.lineWidth = 3;
      g.beginPath();
      g.arc(0, 0, 36, -Math.PI / 2, -Math.PI / 2 + (1 - age) * Math.PI * 2);
      g.stroke();
      // Color-coded ring underneath.
      g.strokeStyle = p.color + "55";
      g.beginPath();
      g.arc(0, 0, 36, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
    this.pops = this.pops.filter(p => !p.dead);
    if (this.pops.length === 0) this._renderTarget();

    // Progress bar.
    const barX = w / 2 - 180, barY = 28, barW = 360, barH = 14;
    g.fillStyle = "rgba(0,0,0,0.5)";
    this._roundRect(g, barX, barY, barW, barH, 7); g.fill();
    const ratio = this.popped / this.TOTAL_POPS;
    const pg = g.createLinearGradient(barX, 0, barX + barW, 0);
    pg.addColorStop(0, "#5cffa7"); pg.addColorStop(1, "#7ee7ff");
    g.fillStyle = pg;
    this._roundRect(g, barX, barY, Math.max(3, ratio * barW), barH, 7); g.fill();
    g.fillStyle = "#fff";
    g.font = "bold 12px ui-rounded, system-ui, sans-serif";
    g.textAlign = "center";
    g.fillText(`${this.popped} / ${this.TOTAL_POPS} popped`, w / 2, barY - 6);

    this.particles = drawDots(g, this.particles);

    this.popups = drawPopups(g, this.popups);
    this._drawComboBadge(g, w);
    setHudExtra("Score", this.stats.score);

    g.restore();
    this._raf = requestAnimationFrame(this._tick);
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
