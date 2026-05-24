/* ===================================================================
   Adventure Race mode - player character races along a track.
   Each sentence typed correctly advances the character. The session
   ends when the character reaches the goal (5 sentences) or after
   too many mistakes.
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
    this.playerProgress = 0;     // 0..1 along track
    this.particles = [];
    this.sentences = this._buildSentenceList(ctx.level);

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
      // Smooth progress within the sentence too.
      this.playerProgress = (this.sentenceIdx + this.typed.length / target.length) / this.GOAL_SENTENCES;
      this._renderTarget();
      if (this.typed === target) {
        this.stats.onWord();
        this.stats.addScore(20 + target.length);
        Sound.word();
        this._burst();
        this.sentenceIdx++;
        this._setHudExtra("Lap", `${this.sentenceIdx}/${this.GOAL_SENTENCES}`);
        if (this.sentenceIdx >= this.GOAL_SENTENCES) {
          Sound.win();
          setTimeout(() => this._finish(), 600);
        } else {
          setTimeout(() => this._loadSentence(), 350);
        }
      } else {
        KB.highlightNext(target[this.typed.length]);
      }
    } else {
      this.stats.onWrong(expected);
      KB.flash(ch, false); Sound.wrong();
    }
    updateHud(this.stats);
  },

  _burst() {
    const c = this.ctx.canvas;
    const x = 80 + this.playerProgress * (c.width - 160);
    const y = c.height / 2 + 20;
    const emojis = this.ctx.theme.collectibles;
    for (let i = 0; i < 14; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 7,
        vy: -Math.random() * 5 - 1,
        life: 40,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
      });
    }
  },

  _tick() {
    if (this.finished) return;
    const c = this.ctx.canvas;
    const g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);
    drawBgStars(g, this.bgStars, c.width, c.height);

    // Track line.
    const trackY = c.height / 2 + 20;
    g.strokeStyle = "rgba(255,255,255,0.25)";
    g.setLineDash([10, 12]);
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(60, trackY); g.lineTo(c.width - 60, trackY); g.stroke();
    g.setLineDash([]);

    // Start + goal markers.
    g.font = "32px serif";
    g.textAlign = "center";
    g.fillText("🏁", c.width - 60, trackY - 18);
    g.fillText("•", 60, trackY - 14);

    // Player.
    const px = 80 + this.playerProgress * (c.width - 160);
    g.font = "52px serif";
    g.fillText(this.ctx.theme.player, px, trackY - 12);

    // Theme decoration along track (random emojis from collectibles ahead).
    g.font = "22px serif";
    g.globalAlpha = 0.4;
    for (let i = 1; i < 5; i++) {
      const x = 80 + (i / 5) * (c.width - 160);
      const ahead = (i / 5) > this.playerProgress;
      if (ahead) g.fillText(this.ctx.theme.collectibles[i % this.ctx.theme.collectibles.length], x, trackY + 32);
    }
    g.globalAlpha = 1;

    // Particles.
    for (const p of this.particles) {
      g.font = "22px serif";
      g.fillText(p.emoji, p.x, p.y);
      p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.life--;
    }
    this.particles = this.particles.filter(p => p.life > 0);

    // Big header.
    g.font = "bold 22px system-ui, sans-serif";
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.fillText(`Sentence ${this.sentenceIdx + 1} of ${this.GOAL_SENTENCES}`, c.width / 2, 36);

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
