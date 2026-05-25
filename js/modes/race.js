/* ===================================================================
   Adventure Race mode - player character races along a track.
   Each sentence typed correctly advances the character.
   =================================================================== */

const RaceMode = {
  GOAL_SENTENCES: 5,

  init(ctx) {
    this.ctx = ctx;
    this.stats = Stats.create();
    this.bgStars = makeBgStars(ctx.canvas.width, ctx.canvas.height, ctx.theme);
    this.sentenceIdx = 0;
    this.typed = "";
    this.finished = false;
    this.playerProgress = 0;
    this.particles = [];
    this.popups = [];
    this.sentences = this._buildSentenceList(ctx.level);
    this.shake = 0;
    this.scrollOffset = 0;

    KB.setLevel(ctx.level);
    this._setHudExtra("Lap", `0/${this.GOAL_SENTENCES}`);
    this._loadSentence();
    this._tick = this._tick.bind(this);
    this._raf = requestAnimationFrame(this._tick);
  },

  _buildSentenceList(lesson) {
    const pool = (lesson.sentences && lesson.sentences.length)
      ? lesson.sentences
      : lesson.words.map(w => w + " " + w);
    const out = [];
    while (out.length < this.GOAL_SENTENCES) {
      const shuffled = pool.slice().sort(() => Math.random() - 0.5);
      for (const s of shuffled) {
        if (out.length >= this.GOAL_SENTENCES) break;
        out.push(s);
      }
    }
    return out;
  },

  _loadSentence() {
    if (this.sentenceIdx >= this.sentences.length) { this._finish(); return; }
    this.typed = "";
    this._renderTarget();
    const target = this.sentences[this.sentenceIdx];
    KB.highlightNext(target[0]);
  },

  _renderTarget() {
    const target = this.sentences[this.sentenceIdx];
    let html = "";
    for (let i = 0; i < target.length; i++) {
      const ch = target[i];
      let cls = "char-pending";
      if (i < this.typed.length) {
        cls = this.typed[i] === ch ? "char-correct" : "char-wrong";
      } else if (i === this.typed.length) {
        cls = "char-current";
      }
      html += `<span class="${cls}">${ch === " " ? "&nbsp;" : escapeHtml(ch)}</span>`;
    }
    document.getElementById("target-prompt").innerHTML = html;
    document.getElementById("typed-echo").textContent = `Lap ${this.sentenceIdx + 1}/${this.GOAL_SENTENCES}`;
  },

  handleKey(ch) {
    if (this.finished) return;
    const target = this.sentences[this.sentenceIdx];
    const expected = target[this.typed.length];
    if (ch === expected) {
      this.typed += ch;
      this.stats.onCorrect(ch);
      KB.flash(ch, true); Sound.correct();
      this.playerProgress = (this.sentenceIdx + this.typed.length / target.length) / this.GOAL_SENTENCES;
      this._renderTarget();
      if (this.typed === target) {
        const points = 20 + target.length;
        this.stats.onWord();
        this.stats.addScore(points);
        Sound.word();
        this._burst();
        spawnPopup(this.popups,
          80 + this.playerProgress * (this.ctx.canvas.width - 160),
          this.ctx.canvas.height / 2,
          "+" + points, "#5cffa7");
        this.sentenceIdx++;
        this._setHudExtra("Lap", `${this.sentenceIdx}/${this.GOAL_SENTENCES}`);
        if (this.sentenceIdx >= this.GOAL_SENTENCES) {
          Sound.win();
          setTimeout(() => this._finish(), 700);
        } else {
          setTimeout(() => this._loadSentence(), 350);
        }
      } else {
        KB.highlightNext(target[this.typed.length]);
      }
    } else {
      this.stats.onWrong(expected);
      KB.flash(ch, false); Sound.wrong();
      bumpShake(this, 3);
    }
    updateHud(this.stats);
    App.checkLiveAchievements(this.stats);
  },

  _burst() {
    const c = this.ctx.canvas;
    const x = 80 + this.playerProgress * (c.width - 160);
    const y = c.height / 2 + 20;
    const emojis = this.ctx.theme.collectibles;
    for (let i = 0; i < 18; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 8,
        vy: -Math.random() * 6 - 1,
        life: 44, max: 44,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
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

    // Scene backdrop + parallax stars.
    const scene = SceneDrawers[this.ctx.theme.id];
    if (scene) scene(g, w, h, t);
    drawBgStars(g, this.bgStars, w, h);

    // Progress track.
    const trackY = h / 2 + 40;
    // Glowing rail.
    const rail = g.createLinearGradient(60, 0, w - 60, 0);
    rail.addColorStop(0, "rgba(255,255,255,0.05)");
    rail.addColorStop(this.playerProgress, "rgba(126, 231, 255, 0.7)");
    rail.addColorStop(Math.min(1, this.playerProgress + 0.001), "rgba(255,255,255,0.18)");
    rail.addColorStop(1, "rgba(255,255,255,0.18)");
    g.strokeStyle = rail;
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(60, trackY); g.lineTo(w - 60, trackY);
    g.stroke();

    // Tick marks along the track.
    g.fillStyle = "rgba(255,255,255,0.35)";
    for (let i = 0; i <= this.GOAL_SENTENCES; i++) {
      const tx = 60 + (i / this.GOAL_SENTENCES) * (w - 120);
      g.fillRect(tx - 2, trackY - 10, 4, 20);
    }

    // Start + goal markers.
    g.font = "30px serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("🏁", w - 60, trackY - 28);
    g.fillText("🚩", 60, trackY - 28);

    // Player with bob.
    const px = 80 + this.playerProgress * (w - 160);
    const bob = Math.sin(t / 250) * 5;
    g.save();
    g.translate(px, trackY - 22 + bob);
    g.shadowColor = "rgba(126, 231, 255, 0.65)";
    g.shadowBlur = 18;
    g.font = "56px serif";
    g.fillText(this.ctx.theme.player, 0, 0);
    g.restore();

    // Speed trail behind player.
    if (this.playerProgress > 0.005) {
      for (let i = 0; i < 5; i++) {
        const a = (5 - i) / 18;
        g.globalAlpha = a;
        g.font = (44 - i * 4) + "px serif";
        g.fillText(this.ctx.theme.player, px - 18 - i * 14, trackY - 18 + bob * 0.6);
      }
      g.globalAlpha = 1;
    }

    // Collectibles ahead of the player.
    g.textBaseline = "alphabetic";
    g.font = "26px serif";
    g.globalAlpha = 0.55;
    for (let i = 1; i < this.GOAL_SENTENCES; i++) {
      const x = 60 + (i / this.GOAL_SENTENCES) * (w - 120);
      if ((i / this.GOAL_SENTENCES) > this.playerProgress) {
        const cb = this.ctx.theme.collectibles[i % this.ctx.theme.collectibles.length];
        const fy = trackY + 36 + Math.sin(t / 400 + i) * 4;
        g.fillText(cb, x, fy);
      }
    }
    g.globalAlpha = 1;

    // Progress bar overlay at top.
    const barX = w / 2 - 200, barY = 28, barW = 400, barH = 16;
    g.fillStyle = "rgba(0,0,0,0.5)";
    this._roundRect(g, barX, barY, barW, barH, 8); g.fill();
    const filled = this.playerProgress * barW;
    const pgrad = g.createLinearGradient(barX, 0, barX + barW, 0);
    pgrad.addColorStop(0, "#5cffa7");
    pgrad.addColorStop(1, "#7ee7ff");
    g.fillStyle = pgrad;
    this._roundRect(g, barX, barY, Math.max(4, filled), barH, 8); g.fill();
    g.strokeStyle = "rgba(255,255,255,0.4)";
    g.lineWidth = 1;
    this._roundRect(g, barX, barY, barW, barH, 8); g.stroke();
    g.fillStyle = "#fff";
    g.font = "bold 12px ui-rounded, system-ui, sans-serif";
    g.textAlign = "center";
    g.fillText(`Sentence ${this.sentenceIdx + 1} of ${this.GOAL_SENTENCES}`, w / 2, barY - 6);

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
      p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.rot += p.rotV; p.life--;
    }
    g.globalAlpha = 1;
    this.particles = this.particles.filter(p => p.life > 0);

    this.popups = drawPopups(g, this.popups);
    this._drawComboBadge(g, w);
    this._setHudExtra("Score", this.stats.score);

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
    g.strokeText(`x${mult} COMBO!`, w - 16, 78);
    g.fillStyle = "#ffd24a";
    g.fillText(`x${mult} COMBO!`, w - 16, 78);
    g.font = "bold 13px ui-rounded, system-ui, sans-serif";
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.fillText(`${streak} streak`, w - 16, 98);
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
