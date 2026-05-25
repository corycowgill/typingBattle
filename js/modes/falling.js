/* ===================================================================
   Falling Words mode - words drift down a themed background.
   Type a word to destroy it. 3 lives. After enough kills, a boss
   appears with a phrase that must be typed in full. Power-ups
   occasionally drop and grant Freeze / Double-score / Heal / Slow-mo.
   =================================================================== */

const FallingMode = {
  KILLS_BEFORE_BOSS: 12,
  POWERUP_INTERVAL: 700,       // frames between possible power-up drops

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
    this.bgStars = makeBgStars(ctx.canvas.width, ctx.canvas.height, ctx.theme);
    this.lives = 3;
    this.killCount = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 110;
    this.powerupTimer = 0;
    this.baseSpeed = 0.6;
    this.locked = null;
    this.finished = false;
    this.shake = 0;
    this.lifeBlink = 0;
    this.activeEffects = { freeze: 0, double: 0, slow: 0 };

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
      kind: "enemy",
      word, typed: "", x, y: -20,
      vy: this.baseSpeed + Math.random() * 0.4 + Math.min(1.8, this.stats.score / 200),
      vx: (Math.random() - 0.5) * 0.3,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      rot: 0, rotV: (Math.random() - 0.5) * 0.04,
      sparkPhase: Math.random() * Math.PI * 2,
    });
  },

  _spawnPowerup() {
    if (this.bossPhase) return;
    const c = this.ctx.canvas;
    let pick;
    // Prefer HEAL when the kid is low on lives.
    if (this.lives < 2) pick = this.POWERUP_TYPES.find(p => p.effect === "heal");
    else pick = this.POWERUP_TYPES[Math.floor(Math.random() * this.POWERUP_TYPES.length)];
    const x = 80 + Math.random() * (c.width - 160);
    this.powerups.push({
      kind: "powerup",
      word: pick.word, typed: "", x, y: -20,
      vy: 0.35 + Math.random() * 0.2,
      emoji: pick.emoji, effect: pick.effect,
      color: pick.color, desc: pick.desc,
      rot: 0, rotV: 0,
      pulse: 0,
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
      x: c.width / 2, y: 80,
      vy: 0.06,
      emoji: this.ctx.theme.bossEmoji,
      hpMax: phrase.length,
      shake: 0,
      rot: 0, rotV: 0,
    };
    spawnPopup(this.popups, c.width / 2, c.height / 2 - 50, "⚠ BOSS INCOMING! ⚠", "#ff6b8a");
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
        : `<span class="char-pending">Type the first letter of any falling word!</span>`;
      promptEl.innerHTML = hint;
      KB.highlightNext(null);
    }
    echoEl.textContent = "Lives: " + "❤".repeat(this.lives);
  },

  handleKey(ch) {
    if (this.finished) return;

    if (!this.locked) {
      // Build candidate list: enemies + powerups + boss.
      const candidates = [];
      this.entities.forEach(e => { if (e.word[0] === ch) candidates.push(e); });
      this.powerups.forEach(p => { if (p.word[0] === ch) candidates.push(p); });
      if (this.boss && !this.bossDefeated && this.boss.word[0] === ch) candidates.push(this.boss);

      if (candidates.length) {
        // Boss > powerup > urgent enemy (lowest y wins).
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
    const points = Math.max(5, e.word.length * 5) * mult;
    this.stats.onWord();
    this.stats.addScore(points);
    this.killCount++;
    Sound.word();
    this._burst(e.x, e.y, this.ctx.theme.collectibles[0]);
    spawnPopup(this.popups, e.x, e.y - 10, "+" + points + (mult > 1 ? " x2!" : ""), "#5cffa7");
    this.entities = this.entities.filter(x => x !== e);

    if (this.killCount >= this.KILLS_BEFORE_BOSS && !this.bossPhase) {
      this.bossPhase = true;
      // Pause spawning briefly, then drop the boss in.
      setTimeout(() => { if (!this.finished) this._spawnBoss(); }, 900);
    }
  },

  _activateEffect(p) {
    Sound.powerup();
    spawnPopup(this.popups, p.x, p.y, p.desc, p.color);
    this._burst(p.x, p.y, p.emoji);
    switch (p.effect) {
      case "freeze": this.activeEffects.freeze = 180; break; // ~3s
      case "double": this.activeEffects.double = 480; break; // ~8s
      case "slow":   this.activeEffects.slow   = 360; break; // ~6s
      case "heal":
        this.lives = Math.min(3, this.lives + 1);
        this._setHudExtra("Lives", "❤".repeat(this.lives));
        break;
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
    // Big celebratory burst.
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
    // Clear remaining enemies so they don't kill the win moment.
    this.entities = [];
    this.powerups = [];
    setTimeout(() => this._finish(), 1600);
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

    // Tick down effects.
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
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer = 0;
        this._spawn();
        if (this.spawnInterval > 50) this.spawnInterval -= 1;
      }
      this.powerupTimer++;
      if (this.powerupTimer >= this.POWERUP_INTERVAL) {
        this.powerupTimer = 0;
        if (Math.random() < 0.7) this._spawnPowerup();
      }
    }

    const floorY = h - 30;

    // Update entities (frozen halts motion).
    if (!frozen) {
      for (const e of this.entities) {
        e.y += e.vy * slowMult;
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
        this.boss.y += this.boss.vy;
        if (this.boss.shake > 0) this.boss.shake *= 0.85;
        if (this.boss.y >= floorY - 30) {
          // Boss broke through!
          bumpShake(this, 20);
          spawnPopup(this.popups, w / 2, h / 2, "BOSS ESCAPED", "#ff6b8a");
          this.lives = 0;
          this.boss = null;
          setTimeout(() => this._finish(), 700);
        }
      }
    }

    // Draw enemies.
    for (const e of this.entities) this._drawEnemy(g, e, t);

    // Draw power-ups (special pulsing render).
    for (const p of this.powerups) this._drawPowerup(g, p, t);

    // Draw boss (special render).
    if (this.boss) this._drawBoss(g, this.boss, t, w);

    // Danger floor line with blink.
    const blink = this.lifeBlink > 0 ? Math.sin(this.lifeBlink * 0.5) * 0.4 + 0.6 : 0.3;
    if (this.lifeBlink > 0) this.lifeBlink--;
    const grad = g.createLinearGradient(0, floorY, 0, floorY + 30);
    grad.addColorStop(0, `rgba(255, 90, 110, ${blink})`);
    grad.addColorStop(1, "rgba(255, 90, 110, 0)");
    g.fillStyle = grad;
    g.fillRect(0, floorY, w, 30);

    // Confetti particles.
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

    // Effect tint overlays.
    if (frozen) {
      g.fillStyle = "rgba(126, 231, 255, 0.18)";
      g.fillRect(0, 0, w, h);
      // Snow speckles.
      for (let i = 0; i < 40; i++) {
        g.globalAlpha = 0.4;
        g.fillStyle = "#fff";
        g.beginPath();
        g.arc((i * 73 + t / 30) % w, (i * 41 + t / 60) % h, 1.5, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    } else if (this.activeEffects.slow > 0) {
      g.fillStyle = "rgba(253, 224, 71, 0.06)";
      g.fillRect(0, 0, w, h);
    }

    this.popups = drawPopups(g, this.popups);
    this._drawComboBadge(g, w);
    this._drawEffectsBar(g);

    this._setHudExtra("Score", this.stats.score);

    g.restore();
    this._raf = requestAnimationFrame(this._tick);
  },

  _drawEnemy(g, e, t) {
    const isLocked = e === this.locked;
    g.save();
    g.translate(e.x, e.y);
    g.rotate(e.rot);
    g.font = "44px serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    if (isLocked) { g.shadowColor = "#5cffa7"; g.shadowBlur = 18; }
    g.fillText(e.emoji, 0, 0);
    g.restore();
    g.textBaseline = "alphabetic";

    if (isLocked) {
      for (let i = 0; i < 4; i++) {
        const a = e.sparkPhase + (i * Math.PI / 2);
        const rx = e.x + Math.cos(a) * 32;
        const ry = e.y + Math.sin(a) * 32;
        g.fillStyle = "rgba(124, 255, 180, " + (0.6 + 0.3 * Math.sin(t / 120 + i)) + ")";
        g.beginPath(); g.arc(rx, ry, 2.5, 0, Math.PI * 2); g.fill();
      }
    }
    this._drawWordPill(g, e, isLocked, "#5cffa7", "rgba(40, 100, 60, 0.85)");
  },

  _drawPowerup(g, p, t) {
    const isLocked = p === this.locked;
    const scale = 1 + Math.sin(p.pulse) * 0.08;

    // Glow ring.
    g.save();
    g.translate(p.x, p.y);
    const rGrad = g.createRadialGradient(0, 0, 6, 0, 0, 32);
    rGrad.addColorStop(0, p.color + "88");
    rGrad.addColorStop(1, p.color + "00");
    g.fillStyle = rGrad;
    g.beginPath(); g.arc(0, 0, 32, 0, Math.PI * 2); g.fill();

    // Outer rotating ring.
    g.rotate(t / 600);
    g.strokeStyle = p.color;
    g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, 24, 0, Math.PI * 2); g.stroke();
    g.restore();

    // Emoji.
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

  _drawBoss(g, b, t, w) {
    const sx = (Math.random() - 0.5) * b.shake;
    const sy = (Math.random() - 0.5) * b.shake;
    g.save();
    g.translate(b.x + sx, b.y + sy);

    // Ominous red glow halo.
    const halo = g.createRadialGradient(0, 0, 20, 0, 0, 90);
    halo.addColorStop(0, "rgba(255, 80, 110, 0.5)");
    halo.addColorStop(1, "rgba(255, 80, 110, 0)");
    g.fillStyle = halo;
    g.beginPath(); g.arc(0, 0, 90, 0, Math.PI * 2); g.fill();

    g.font = "78px serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.shadowColor = "#ff6b8a";
    g.shadowBlur = 22;
    g.fillText(b.emoji, 0, 0);
    g.restore();
    g.textBaseline = "alphabetic";

    // HP bar above boss.
    const barX = b.x - 100, barY = b.y - 60, barW = 200, barH = 14;
    g.fillStyle = "rgba(0,0,0,0.65)";
    this._roundRect(g, barX, barY, barW, barH, 7); g.fill();
    const ratio = (b.word.length - b.typed.length) / b.word.length;
    const hpGrad = g.createLinearGradient(barX, 0, barX + barW, 0);
    hpGrad.addColorStop(0, "#ff6b8a");
    hpGrad.addColorStop(1, "#ffd24a");
    g.fillStyle = hpGrad;
    this._roundRect(g, barX, barY, Math.max(3, ratio * barW), barH, 7); g.fill();
    g.strokeStyle = "rgba(255,255,255,0.6)";
    g.lineWidth = 1.5;
    this._roundRect(g, barX, barY, barW, barH, 7); g.stroke();
    g.fillStyle = "#fff";
    g.font = "bold 12px ui-rounded, system-ui, sans-serif";
    g.textAlign = "center";
    g.fillText("BOSS · " + (b.word.length - b.typed.length) + " left", b.x, barY - 6);

    // Phrase pill below boss (only if locked or boss is the only thing).
    if (this.locked === b || !this.locked) {
      const isLocked = this.locked === b;
      g.font = "bold 17px ui-rounded, system-ui, sans-serif";
      const tw = g.measureText(b.word).width;
      const px = b.x - tw / 2 - 10;
      const py = b.y + 44;
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
