/* ===================================================================
   Word Blaster mode - enemies approach with words. Type to "shoot".
   After defeating the wave, a themed boss appears with a phrase
   that must be fully typed to win. Power-ups occasionally drop.
   =================================================================== */

const ShooterMode = {
  WAVE_SIZE: 12,
  POWERUP_INTERVAL: 700,

  POWERUP_TYPES: [
    { word: "FREEZE", emoji: "🧊", effect: "freeze", color: "#7ee7ff", desc: "Freeze 3s" },
    { word: "DOUBLE", emoji: "💎", effect: "double", color: "#ff89e1", desc: "x2 for 8s" },
    { word: "HEAL",   emoji: "💚", effect: "heal",   color: "#5cffa7", desc: "+1 Life"   },
    { word: "SLOW",   emoji: "🐢", effect: "slow",   color: "#fde047", desc: "Slow-mo 6s"},
  ],

  init(ctx) {
    this.ctx = ctx;
    this.stats = Stats.create();
    this.entities = [];
    this.powerups = [];
    this.boss = null;
    this.bossPhase = false;
    this.bossDefeated = false;
    this.particles = [];
    this.popups = [];
    this.lasers = [];
    this.bgStars = makeBgStars(ctx.canvas.width, ctx.canvas.height, ctx.theme);
    this.lives = 3;
    this.spawnTimer = 0;
    this.spawnInterval = 120;
    this.powerupTimer = 0;
    this.locked = null;
    this.finished = false;
    this.wordsKilled = 0;
    this.maxWords = this.WAVE_SIZE;
    this.shake = 0;
    this.playerBob = 0;
    this.activeEffects = { freeze: 0, double: 0, slow: 0 };

    KB.setLevel(ctx.level);
    this._setHudExtra("Targets", `0/${this.maxWords}`);
    this._renderTarget();
    this._tick = this._tick.bind(this);
    this._raf = requestAnimationFrame(this._tick);
  },

  _wordPool() { return this.ctx.level.words; },

  _spawn() {
    if (this.wordsKilled + this.entities.length >= this.maxWords) return;
    const c = this.ctx.canvas;
    const word = this._wordPool()[Math.floor(Math.random() * this._wordPool().length)];
    const emojis = this.ctx.theme.enemies;
    const x = 80 + Math.random() * (c.width - 160);
    this.entities.push({
      kind: "enemy",
      word, typed: "", x, y: -20,
      vx: (Math.random() - 0.5) * 0.6,
      vy: 0.4 + Math.random() * 0.5 + Math.min(1.2, this.stats.score / 250),
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      rot: 0, rotV: (Math.random() - 0.5) * 0.05,
    });
  },

  _spawnPowerup() {
    if (this.bossPhase) return;
    const c = this.ctx.canvas;
    let pick;
    if (this.lives < 2) pick = this.POWERUP_TYPES.find(p => p.effect === "heal");
    else pick = this.POWERUP_TYPES[Math.floor(Math.random() * this.POWERUP_TYPES.length)];
    const x = 100 + Math.random() * (c.width - 200);
    this.powerups.push({
      kind: "powerup",
      word: pick.word, typed: "", x, y: -20,
      vy: 0.35 + Math.random() * 0.2, vx: 0,
      emoji: pick.emoji, effect: pick.effect,
      color: pick.color, desc: pick.desc,
      rot: 0, rotV: 0, pulse: 0,
    });
  },

  _spawnBoss() {
    const c = this.ctx.canvas;
    const lesson = this.ctx.level;
    const phrase = (lesson.sentences && lesson.sentences.length)
      ? lesson.sentences[Math.floor(Math.random() * lesson.sentences.length)]
      : lesson.words.slice(0, 3).join(" ");
    this.boss = {
      kind: "boss",
      word: phrase, typed: "",
      x: c.width / 2, y: 90,
      vx: 0.35, vy: 0.04,
      emoji: this.ctx.theme.bossEmoji,
      hpMax: phrase.length,
      shake: 0,
    };
    spawnPopup(this.popups, c.width / 2, c.height / 2 - 60, "⚠ BOSS INCOMING! ⚠", "#ff6b8a");
    bumpShake(this, 10);
    Sound.bossWarn();
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
      const hint = this.bossPhase
        ? `<span class="char-pending">Type the boss phrase to win!</span>`
        : `<span class="char-pending">Type first letter to lock target!</span>`;
      promptEl.innerHTML = hint;
      KB.highlightNext(null);
    }
    echoEl.textContent = "Lives: " + "❤".repeat(this.lives);
  },

  handleKey(ch) {
    if (this.finished) return;

    if (!this.locked) {
      const candidates = [];
      this.entities.forEach(e => { if (e.word[0] === ch) candidates.push(e); });
      this.powerups.forEach(p => { if (p.word[0] === ch) candidates.push(p); });
      if (this.boss && !this.bossDefeated && this.boss.word[0] === ch) candidates.push(this.boss);

      if (candidates.length) {
        candidates.sort((a, b) => {
          const ka = a.kind === "boss" ? 2 : a.kind === "powerup" ? 1 : 0;
          const kb = b.kind === "boss" ? 2 : b.kind === "powerup" ? 1 : 0;
          if (ka !== kb) return kb - ka;
          return b.y - a.y;
        });
        this.locked = candidates[0];
        this.locked.typed = ch;
        this.stats.onCorrect(ch);
        KB.flash(ch, true);
        if (this.locked.kind === "boss") { Sound.bossHit(); this.locked.shake = 8; }
        else Sound.correct();
        this._spawnLaser(this.locked);
        if (this.locked.typed === this.locked.word) this._defeatLocked();
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
      KB.flash(ch, true);
      if (this.locked.kind === "boss") { Sound.bossHit(); this.locked.shake = 8; }
      else Sound.correct();
      this._spawnLaser(this.locked);
      if (this.locked.typed === this.locked.word) this._defeatLocked();
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
    const color = target.kind === "boss" ? "#ff6b8a"
                : target.kind === "powerup" ? target.color
                : "#7ee7ff";
    this.lasers.push({
      x1: c.width / 2, y1: c.height - 50,
      x2: target.x, y2: target.y,
      life: 10, max: 10, color,
    });
  },

  _defeatLocked() {
    const e = this.locked;
    if (e.kind === "powerup") {
      this._activateEffect(e);
      this.powerups = this.powerups.filter(p => p !== e);
    } else if (e.kind === "boss") {
      this._defeatBoss();
    } else {
      this._killEnemy(e);
    }
    this.locked = null;
    this._renderTarget();
  },

  _killEnemy(e) {
    const mult = this.activeEffects.double > 0 ? 2 : 1;
    const points = Math.max(10, e.word.length * 8) * mult;
    this.stats.onWord();
    this.stats.addScore(points);
    this.wordsKilled++;
    Sound.word();
    this._burst(e.x, e.y);
    spawnPopup(this.popups, e.x, e.y - 10, "+" + points + (mult > 1 ? " x2!" : ""), "#7ee7ff");
    bumpShake(this, 3);
    this.entities = this.entities.filter(x => x !== e);
    this._setHudExtra("Targets", `${this.wordsKilled}/${this.maxWords}`);

    if (this.wordsKilled >= this.maxWords && !this.bossPhase) {
      this.bossPhase = true;
      setTimeout(() => { if (!this.finished) this._spawnBoss(); }, 900);
    }
  },

  _activateEffect(p) {
    Sound.powerup();
    spawnPopup(this.popups, p.x, p.y, p.desc, p.color);
    this._burst(p.x, p.y);
    switch (p.effect) {
      case "freeze": this.activeEffects.freeze = 180; break;
      case "double": this.activeEffects.double = 480; break;
      case "slow":   this.activeEffects.slow   = 360; break;
      case "heal":   this.lives = Math.min(3, this.lives + 1); break;
    }
  },

  _defeatBoss() {
    const e = this.boss;
    const mult = this.activeEffects.double > 0 ? 2 : 1;
    const points = 250 * mult;
    this.stats.onWord();
    this.stats.addScore(points);
    Sound.bossDefeat();
    bumpShake(this, 22);
    spawnPopup(this.popups, e.x, e.y - 30, "+" + points + " BOSS DEFEATED!", "#ffd24a");
    const emojis = this.ctx.theme.collectibles;
    for (let i = 0; i < 60; i++) {
      this.particles.push({
        x: e.x, y: e.y,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.5) * 16 - 3,
        life: 90, max: 90,
        emoji: emojis[i % emojis.length],
        rot: 0, rotV: (Math.random() - 0.5) * 0.5,
      });
    }
    this.bossDefeated = true;
    this.boss = null;
    this.entities = [];
    this.powerups = [];
    setTimeout(() => this._finish(), 1600);
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

    if (this.activeEffects.freeze > 0) this.activeEffects.freeze--;
    if (this.activeEffects.double > 0) this.activeEffects.double--;
    if (this.activeEffects.slow > 0)   this.activeEffects.slow--;
    const frozen = this.activeEffects.freeze > 0;
    const slowMult = this.activeEffects.slow > 0 ? 0.4 : 1;

    g.save();
    applyShake(g, this);
    g.clearRect(-30, -30, w + 60, h + 60);

    const scene = SceneDrawers[this.ctx.theme.id];
    if (scene) scene(g, w, h, t);
    drawBgStars(g, this.bgStars, w, h);

    // Spawning.
    if (!this.bossPhase) {
      this.spawnTimer++;
      if (this.spawnTimer >= this.spawnInterval &&
          this.entities.length + this.wordsKilled < this.maxWords &&
          this.entities.length < 5) {
        this.spawnTimer = 0;
        this._spawn();
        if (this.spawnInterval > 60) this.spawnInterval -= 2;
      }
      this.powerupTimer++;
      if (this.powerupTimer >= this.POWERUP_INTERVAL) {
        this.powerupTimer = 0;
        if (Math.random() < 0.7) this._spawnPowerup();
      }
    }

    const dangerY = h - 80;

    if (!frozen) {
      for (const e of this.entities) {
        e.x += e.vx;
        e.y += e.vy * slowMult;
        e.rot += e.rotV;
        if (e.x < 40 || e.x > w - 40) e.vx *= -1;
        if (e.y >= dangerY) {
          e.dead = true;
          if (e === this.locked) { this.locked = null; this._renderTarget(); }
          this._loseLife();
        }
      }
      this.entities = this.entities.filter(e => !e.dead);

      for (const p of this.powerups) {
        p.y += p.vy * slowMult;
        p.pulse += 0.12;
        if (p.y > h + 30) {
          p.dead = true;
          if (p === this.locked) { this.locked = null; this._renderTarget(); }
        }
      }
      this.powerups = this.powerups.filter(p => !p.dead);

      if (this.boss) {
        this.boss.x += this.boss.vx;
        this.boss.y += this.boss.vy;
        if (this.boss.x < 80 || this.boss.x > w - 80) this.boss.vx *= -1;
        if (this.boss.shake > 0) this.boss.shake *= 0.85;
        if (this.boss.y >= dangerY - 30) {
          bumpShake(this, 20);
          spawnPopup(this.popups, w / 2, h / 2, "BOSS BROKE THROUGH", "#ff6b8a");
          this.lives = 0;
          this.boss = null;
          setTimeout(() => this._finish(), 700);
        }
      }
    }

    // Targeting reticle on locked enemy / powerup / boss.
    if (this.locked) {
      const e = this.locked;
      g.save();
      g.translate(e.x, e.y);
      g.rotate(t / 600);
      g.strokeStyle = e.kind === "boss" ? "rgba(255, 107, 138, 0.85)"
                    : e.kind === "powerup" ? e.color
                    : "rgba(94, 234, 212, 0.85)";
      g.lineWidth = 2;
      const r = e.kind === "boss" ? 60 : 36;
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

    // Draw entities.
    for (const e of this.entities) this._drawEnemy(g, e);

    // Power-ups.
    for (const p of this.powerups) this._drawPowerup(g, p, t);

    // Boss.
    if (this.boss) this._drawBoss(g, this.boss);

    // Lasers (themed color).
    for (const l of this.lasers) {
      const alpha = l.life / l.max;
      g.strokeStyle = l.color.replace(/\)$/, `, ${alpha})`).replace("rgb", "rgba");
      g.strokeStyle = this._colorAlpha(l.color, alpha);
      g.shadowColor = l.color;
      g.shadowBlur = 14;
      g.lineWidth = 4;
      g.beginPath(); g.moveTo(l.x1, l.y1); g.lineTo(l.x2, l.y2); g.stroke();
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

    // Player ship.
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

    // Effect tints.
    if (frozen) {
      g.fillStyle = "rgba(126, 231, 255, 0.18)";
      g.fillRect(0, 0, w, h);
    } else if (this.activeEffects.slow > 0) {
      g.fillStyle = "rgba(253, 224, 71, 0.06)";
      g.fillRect(0, 0, w, h);
    }

    this.popups = drawPopups(g, this.popups);
    this._drawComboBadge(g, w);
    this._drawEffectsBar(g);

    document.getElementById("typed-echo").textContent = "Lives: " + "❤".repeat(Math.max(0, this.lives));

    g.restore();
    this._raf = requestAnimationFrame(this._tick);
  },

  _colorAlpha(hex, alpha) {
    // Accepts "#rrggbb" or "rgb(...)" - converts to rgba.
    if (hex.startsWith("#")) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return hex;
  },

  _drawEnemy(g, e) {
    const isLocked = e === this.locked;
    g.save();
    g.translate(e.x, e.y);
    g.rotate(e.rot);
    g.font = "46px serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    if (isLocked) { g.shadowColor = "#7ee7ff"; g.shadowBlur = 18; }
    g.fillText(e.emoji, 0, 0);
    g.restore();
    g.textBaseline = "alphabetic";
    this._drawWordPill(g, e, isLocked, "#7ee7ff", "rgba(20, 80, 100, 0.85)");
  },

  _drawPowerup(g, p, t) {
    const isLocked = p === this.locked;
    const scale = 1 + Math.sin(p.pulse) * 0.08;

    g.save();
    g.translate(p.x, p.y);
    const rGrad = g.createRadialGradient(0, 0, 6, 0, 0, 32);
    rGrad.addColorStop(0, p.color + "88");
    rGrad.addColorStop(1, p.color + "00");
    g.fillStyle = rGrad;
    g.beginPath(); g.arc(0, 0, 32, 0, Math.PI * 2); g.fill();
    g.rotate(t / 600);
    g.strokeStyle = p.color;
    g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, 24, 0, Math.PI * 2); g.stroke();
    g.restore();

    g.save();
    g.translate(p.x, p.y);
    g.scale(scale, scale);
    g.font = "34px serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    if (isLocked) { g.shadowColor = p.color; g.shadowBlur = 14; }
    g.fillText(p.emoji, 0, 0);
    g.restore();
    g.textBaseline = "alphabetic";

    this._drawWordPill(g, p, isLocked, p.color, "rgba(0,0,0,0.7)");
  },

  _drawBoss(g, b) {
    const sx = (Math.random() - 0.5) * b.shake;
    const sy = (Math.random() - 0.5) * b.shake;
    g.save();
    g.translate(b.x + sx, b.y + sy);
    const halo = g.createRadialGradient(0, 0, 20, 0, 0, 90);
    halo.addColorStop(0, "rgba(255, 80, 110, 0.5)");
    halo.addColorStop(1, "rgba(255, 80, 110, 0)");
    g.fillStyle = halo;
    g.beginPath(); g.arc(0, 0, 90, 0, Math.PI * 2); g.fill();
    g.font = "86px serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.shadowColor = "#ff6b8a";
    g.shadowBlur = 22;
    g.fillText(b.emoji, 0, 0);
    g.restore();
    g.textBaseline = "alphabetic";

    // HP bar.
    const barX = b.x - 100, barY = b.y - 70, barW = 200, barH = 14;
    g.fillStyle = "rgba(0,0,0,0.65)";
    this._roundRect(g, barX, barY, barW, barH, 7); g.fill();
    const ratio = (b.word.length - b.typed.length) / b.word.length;
    const hpGrad = g.createLinearGradient(barX, 0, barX + barW, 0);
    hpGrad.addColorStop(0, "#ff6b8a");
    hpGrad.addColorStop(1, "#ffd24a");
    g.fillStyle = hpGrad;
    this._roundRect(g, barX, barY, Math.max(3, ratio * barW), barH, 7); g.fill();
    g.fillStyle = "#fff";
    g.font = "bold 12px ui-rounded, system-ui, sans-serif";
    g.textAlign = "center";
    g.fillText("BOSS · " + (b.word.length - b.typed.length) + " left", b.x, barY - 6);

    // Phrase pill below boss.
    if (this.locked === b || !this.locked) {
      const isLocked = this.locked === b;
      g.font = "bold 17px ui-rounded, system-ui, sans-serif";
      const tw = g.measureText(b.word).width;
      const px = b.x - tw / 2 - 10;
      const py = b.y + 50;
      g.fillStyle = isLocked ? "rgba(120, 30, 60, 0.85)" : "rgba(0,0,0,0.6)";
      this._roundRect(g, px, py, tw + 20, 24, 12); g.fill();
      const typed = b.word.slice(0, b.typed.length);
      const rest = b.word.slice(b.typed.length);
      g.textAlign = "left";
      g.fillStyle = "#ffd24a";
      g.fillText(typed, b.x - tw / 2, py + 17);
      g.fillStyle = "#fff";
      g.fillText(rest, b.x - tw / 2 + g.measureText(typed).width, py + 17);
    }
  },

  _drawWordPill(g, e, isLocked, typedColor, pillBg) {
    g.font = "bold 17px ui-rounded, system-ui, sans-serif";
    const tw = g.measureText(e.word).width;
    const px = e.x - tw / 2 - 8;
    const py = e.y + 26;
    g.fillStyle = isLocked ? pillBg : "rgba(0,0,0,0.55)";
    this._roundRect(g, px, py, tw + 16, 22, 11);
    g.fill();
    const typed = e.word.slice(0, e.typed.length);
    const rest = e.word.slice(e.typed.length);
    g.textAlign = "left";
    g.fillStyle = typedColor;
    g.fillText(typed, e.x - tw / 2, py + 16);
    g.fillStyle = isLocked ? "#fff" : "rgba(255,255,255,0.92)";
    g.fillText(rest, e.x - tw / 2 + g.measureText(typed).width, py + 16);
  },

  _drawEffectsBar(g) {
    const x = 16, y = 36;
    const items = [];
    if (this.activeEffects.freeze > 0) items.push({ emoji: "🧊", text: Math.ceil(this.activeEffects.freeze / 60) + "s", color: "#7ee7ff" });
    if (this.activeEffects.double > 0) items.push({ emoji: "💎", text: "x2 " + Math.ceil(this.activeEffects.double / 60) + "s", color: "#ff89e1" });
    if (this.activeEffects.slow > 0)   items.push({ emoji: "🐢", text: Math.ceil(this.activeEffects.slow / 60) + "s", color: "#fde047" });
    items.forEach((it, i) => {
      g.font = "bold 14px ui-rounded, system-ui, sans-serif";
      g.textAlign = "left";
      const label = it.emoji + " " + it.text;
      const wid = g.measureText(label).width + 16;
      g.fillStyle = "rgba(0,0,0,0.7)";
      this._roundRect(g, x, y + i * 30, wid, 24, 12); g.fill();
      g.fillStyle = it.color;
      g.fillText(label, x + 8, y + 17 + i * 30);
    });
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
