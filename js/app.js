/* ===================================================================
   app.js - boot, screen routing, profile screen, menu, game lifecycle.
   =================================================================== */

/* ---------- Small shared helpers used by modes ---------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function updateHud(stats) {
  setHudStat("hud-wpm", stats.wpm());
  setHudStat("hud-acc", stats.accuracy() + "%");
  setHudStat("hud-streak", stats.streak);
}
function setHudStat(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  const old = el.textContent;
  const next = String(value);
  if (old !== next) {
    el.textContent = next;
    el.classList.remove("bumped");
    // Force reflow so re-adding triggers the animation.
    void el.offsetWidth;
    el.classList.add("bumped");
    setTimeout(() => el.classList.remove("bumped"), 180);
  }
}

function makeBgStars(w, h, theme) {
  const stars = [];
  const count = 80;
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.5 + Math.random() * 1.8,
      speed: 0.1 + Math.random() * 0.4,
      ch: theme.background[Math.floor(Math.random() * theme.background.length)],
    });
  }
  return stars;
}

function drawBgStars(g, stars, w, h) {
  g.fillStyle = "rgba(255,255,255,0.55)";
  g.textAlign = "center";
  for (const s of stars) {
    g.globalAlpha = 0.35 + Math.sin((performance.now() / 1000 + s.x) * s.speed) * 0.25;
    g.font = `${10 + s.r * 6}px serif`;
    g.fillText(s.ch, s.x, s.y);
    s.y += s.speed * 0.4;
    if (s.y > h + 10) { s.y = -10; s.x = Math.random() * w; }
  }
  g.globalAlpha = 1;
}

function drawBackgroundStars(g, theme, w, h) {
  // Static-y subtle background used in Practice mode.
  g.fillStyle = "rgba(255,255,255,0.4)";
  g.textAlign = "center";
  const t = performance.now() / 1000;
  for (let i = 0; i < 50; i++) {
    const x = (i * 137) % w;
    const y = ((i * 53) + (t * 20)) % h;
    g.globalAlpha = 0.2 + 0.2 * Math.sin(t + i);
    g.font = "16px serif";
    g.fillText(theme.background[i % theme.background.length], x, y);
  }
  g.globalAlpha = 1;
}

/* ---------- Themed canvas scene backdrops ----------
   Each takes (g, w, h, t) where t = performance.now().
   Drawn behind everything else in a mode's tick.            */
const SceneDrawers = {
  space(g, w, h, t) {
    // Nebula clouds.
    const n1 = g.createRadialGradient(w * 0.22, h * 0.32, 10, w * 0.22, h * 0.32, w * 0.5);
    n1.addColorStop(0, "rgba(190, 110, 255, 0.28)");
    n1.addColorStop(1, "rgba(190, 110, 255, 0)");
    g.fillStyle = n1; g.fillRect(0, 0, w, h);
    const n2 = g.createRadialGradient(w * 0.78, h * 0.55, 10, w * 0.78, h * 0.55, w * 0.45);
    n2.addColorStop(0, "rgba(70, 200, 255, 0.22)");
    n2.addColorStop(1, "rgba(70, 200, 255, 0)");
    g.fillStyle = n2; g.fillRect(0, 0, w, h);

    // Planet with ring.
    const pX = w * 0.82, pY = h * 0.28, pR = Math.min(80, w * 0.07);
    const planet = g.createRadialGradient(pX - pR * 0.4, pY - pR * 0.4, pR * 0.2, pX, pY, pR);
    planet.addColorStop(0, "#ffd88a");
    planet.addColorStop(0.6, "#d97b3a");
    planet.addColorStop(1, "#5a1f12");
    g.fillStyle = planet;
    g.beginPath(); g.arc(pX, pY, pR, 0, Math.PI * 2); g.fill();
    // Ring (back).
    g.strokeStyle = "rgba(255, 200, 120, 0.45)";
    g.lineWidth = 4;
    g.beginPath();
    g.ellipse(pX, pY, pR * 1.7, pR * 0.45, -0.35, Math.PI, Math.PI * 2);
    g.stroke();
    // Planet front shadow.
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.beginPath(); g.arc(pX + pR * 0.3, pY + pR * 0.2, pR * 0.95, 0, Math.PI * 2); g.globalCompositeOperation = "source-atop";
    g.fill();
    g.globalCompositeOperation = "source-over";
    // Ring (front).
    g.strokeStyle = "rgba(255, 200, 120, 0.55)";
    g.lineWidth = 4;
    g.beginPath();
    g.ellipse(pX, pY, pR * 1.7, pR * 0.45, -0.35, 0, Math.PI);
    g.stroke();

    // Small moon.
    g.fillStyle = "#dbe6ff";
    g.beginPath(); g.arc(pX - pR * 2.1, pY + pR * 0.6, pR * 0.18, 0, Math.PI * 2); g.fill();
  },

  underwater(g, w, h, t) {
    // Soft depth gradient (lighter top -> darker bottom).
    const depth = g.createLinearGradient(0, 0, 0, h);
    depth.addColorStop(0, "rgba(110, 220, 240, 0.18)");
    depth.addColorStop(1, "rgba(0, 0, 0, 0.35)");
    g.fillStyle = depth; g.fillRect(0, 0, w, h);

    // Caustic light rays.
    g.save();
    g.globalCompositeOperation = "screen";
    for (let i = 0; i < 5; i++) {
      const base = w * (i / 5) + Math.sin(t / 2200 + i * 1.5) * 40;
      const ray = g.createLinearGradient(base, 0, base + 30, h);
      ray.addColorStop(0, "rgba(255, 255, 200, 0.20)");
      ray.addColorStop(1, "rgba(255, 255, 200, 0)");
      g.fillStyle = ray;
      g.beginPath();
      g.moveTo(base - 35, 0);
      g.lineTo(base + 35, 0);
      g.lineTo(base + 95, h);
      g.lineTo(base - 95, h);
      g.closePath();
      g.fill();
    }
    g.restore();

    // Coral / kelp at bottom.
    const kelpColors = ["rgba(30, 130, 90, 0.65)", "rgba(20, 100, 70, 0.7)"];
    for (let i = 0; i < 7; i++) {
      const baseX = (i + 0.5) * (w / 7);
      g.fillStyle = kelpColors[i % 2];
      g.beginPath();
      g.moveTo(baseX - 7, h);
      for (let y = h; y > h - 130; y -= 8) {
        const sway = Math.sin(t / 700 + y / 25 + i) * 8;
        g.lineTo(baseX + sway - 4, y);
      }
      for (let y = h - 130; y < h; y += 8) {
        const sway = Math.sin(t / 700 + y / 25 + i) * 8;
        g.lineTo(baseX + sway + 4, y);
      }
      g.closePath(); g.fill();
    }

    // Floating bubbles.
    if (!SceneDrawers._bubbles) {
      SceneDrawers._bubbles = [];
      for (let i = 0; i < 18; i++) {
        SceneDrawers._bubbles.push({
          x: Math.random() * w, y: Math.random() * h,
          r: 3 + Math.random() * 8, vy: 0.4 + Math.random() * 0.8,
        });
      }
    }
    g.fillStyle = "rgba(220, 240, 255, 0.35)";
    g.strokeStyle = "rgba(220, 240, 255, 0.55)";
    g.lineWidth = 1;
    for (const b of SceneDrawers._bubbles) {
      g.beginPath(); g.arc(b.x + Math.sin(t / 800 + b.y / 30) * 6, b.y, b.r, 0, Math.PI * 2);
      g.fill(); g.stroke();
      b.y -= b.vy;
      if (b.y < -10) { b.y = h + 10; b.x = Math.random() * w; }
    }
  },

  jungle(g, w, h, t) {
    // Distant mountain ridge.
    g.fillStyle = "rgba(30, 60, 40, 0.55)";
    g.beginPath();
    g.moveTo(0, h * 0.6);
    for (let x = 0; x <= w; x += 40) {
      const py = h * 0.6 - 50 + Math.sin(x / 90) * 25 + Math.sin(x / 230) * 15;
      g.lineTo(x, py);
    }
    g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();

    // Sun rays from upper left.
    g.save();
    g.globalCompositeOperation = "screen";
    const sg = g.createRadialGradient(w * 0.15, -20, 20, w * 0.15, -20, w * 0.6);
    sg.addColorStop(0, "rgba(255, 240, 150, 0.45)");
    sg.addColorStop(1, "rgba(255, 240, 150, 0)");
    g.fillStyle = sg; g.fillRect(0, 0, w, h);
    g.restore();

    // Tree silhouettes mid layer.
    g.fillStyle = "rgba(18, 38, 22, 0.85)";
    for (let i = 0; i < 9; i++) {
      const tx = (i + 0.5) * (w / 9) + Math.sin(i * 1.7) * 18;
      const trunkH = 90 + (i % 3) * 30;
      const top = h - trunkH;
      // Trunk
      g.fillRect(tx - 5, top, 10, trunkH);
      // Foliage clusters
      g.beginPath();
      g.arc(tx, top - 5, 28, 0, Math.PI * 2);
      g.arc(tx - 20, top + 5, 22, 0, Math.PI * 2);
      g.arc(tx + 20, top + 5, 22, 0, Math.PI * 2);
      g.fill();
    }

    // Foreground ground line.
    const ground = g.createLinearGradient(0, h - 40, 0, h);
    ground.addColorStop(0, "rgba(40, 80, 35, 0)");
    ground.addColorStop(1, "rgba(20, 50, 20, 0.7)");
    g.fillStyle = ground;
    g.fillRect(0, h - 40, w, 40);

    // Hanging vine accents (subtle).
    g.strokeStyle = "rgba(45, 90, 50, 0.5)";
    g.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const vx = (i + 1) * (w / 5);
      const sway = Math.sin(t / 900 + i) * 8;
      g.beginPath();
      g.moveTo(vx, 0);
      g.bezierCurveTo(vx + sway, 30, vx - sway, 60, vx + sway, 90);
      g.stroke();
    }
  },

  castle(g, w, h, t) {
    // Stars.
    if (!SceneDrawers._castleStars) {
      SceneDrawers._castleStars = [];
      for (let i = 0; i < 70; i++) {
        SceneDrawers._castleStars.push({
          x: Math.random() * w, y: Math.random() * h * 0.6,
          r: 0.5 + Math.random() * 1.5, ph: Math.random() * Math.PI * 2,
        });
      }
    }
    g.fillStyle = "#fff";
    for (const s of SceneDrawers._castleStars) {
      g.globalAlpha = 0.5 + 0.5 * Math.sin(t / 700 + s.ph);
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;

    // Big moon with halo.
    const mX = w * 0.82, mY = h * 0.22, mR = Math.min(45, w * 0.04);
    const halo = g.createRadialGradient(mX, mY, mR, mX, mY, mR * 3);
    halo.addColorStop(0, "rgba(255, 220, 130, 0.4)");
    halo.addColorStop(1, "rgba(255, 220, 130, 0)");
    g.fillStyle = halo;
    g.beginPath(); g.arc(mX, mY, mR * 3, 0, Math.PI * 2); g.fill();
    const moon = g.createRadialGradient(mX - mR * 0.3, mY - mR * 0.3, mR * 0.2, mX, mY, mR);
    moon.addColorStop(0, "#fff8d6");
    moon.addColorStop(1, "#d9b760");
    g.fillStyle = moon;
    g.beginPath(); g.arc(mX, mY, mR, 0, Math.PI * 2); g.fill();
    // Moon craters.
    g.fillStyle = "rgba(0,0,0,0.12)";
    g.beginPath(); g.arc(mX + mR * 0.2, mY + mR * 0.1, mR * 0.15, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(mX - mR * 0.3, mY + mR * 0.3, mR * 0.1, 0, Math.PI * 2); g.fill();

    // Distant mountain silhouette.
    g.fillStyle = "rgba(40, 30, 60, 0.7)";
    g.beginPath();
    g.moveTo(0, h * 0.55);
    for (let x = 0; x <= w; x += 60) {
      const py = h * 0.55 - 40 + Math.sin(x / 150) * 30;
      g.lineTo(x, py);
    }
    g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();

    // Castle towers.
    g.fillStyle = "rgba(20, 15, 30, 0.92)";
    const towers = [
      { x: w * 0.18, w: 30, h: 110 },
      { x: w * 0.28, w: 50, h: 160 },
      { x: w * 0.43, w: 32, h: 100 },
      { x: w * 0.58, w: 62, h: 190 },
      { x: w * 0.72, w: 32, h: 130 },
    ];
    for (const tw of towers) {
      const ty = h - tw.h - 20;
      g.fillRect(tw.x - tw.w / 2, ty, tw.w, tw.h);
      // Crenellations.
      const cw = tw.w / 5;
      for (let i = 0; i < 5; i++) {
        if (i % 2 === 0) g.fillRect(tw.x - tw.w / 2 + i * cw, ty - 8, cw, 8);
      }
      // Windows.
      g.fillStyle = "rgba(255, 200, 100, 0.65)";
      for (let r = 0; r < Math.floor(tw.h / 40); r++) {
        g.fillRect(tw.x - 3, ty + 20 + r * 35, 6, 10);
      }
      g.fillStyle = "rgba(20, 15, 30, 0.92)";
      // Flag on tallest.
      if (tw.h > 170) {
        g.strokeStyle = "rgba(20, 15, 30, 0.92)";
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(tw.x, ty - 8); g.lineTo(tw.x, ty - 30); g.stroke();
        g.fillStyle = "rgba(220, 80, 80, 0.85)";
        const flagSway = Math.sin(t / 400) * 3;
        g.beginPath();
        g.moveTo(tw.x, ty - 30);
        g.lineTo(tw.x + 22 + flagSway, ty - 25);
        g.lineTo(tw.x + 18 + flagSway, ty - 18);
        g.lineTo(tw.x, ty - 12);
        g.closePath(); g.fill();
        g.fillStyle = "rgba(20, 15, 30, 0.92)";
      }
    }
  },
};

/* ---------- Score popups, screen shake, achievement toast ---------- */
function spawnPopup(arr, x, y, text, color) {
  arr.push({ x, y, text, color: color || "#fff", vy: -2.2, life: 55, max: 55 });
}
function drawPopups(g, arr) {
  g.textAlign = "center";
  for (const p of arr) {
    const alpha = Math.max(0, p.life / p.max);
    g.globalAlpha = alpha;
    g.font = "900 26px ui-rounded, system-ui, sans-serif";
    g.lineWidth = 4;
    g.strokeStyle = "rgba(0,0,0,0.55)";
    g.strokeText(p.text, p.x, p.y);
    g.fillStyle = p.color;
    g.fillText(p.text, p.x, p.y);
    p.y += p.vy;
    p.vy *= 0.96;
    p.life--;
  }
  g.globalAlpha = 1;
  return arr.filter(p => p.life > 0);
}

function bumpShake(state, amount) {
  state.shake = Math.min(20, (state.shake || 0) + amount);
}
function applyShake(g, state) {
  if (!state.shake) { state._sx = 0; state._sy = 0; return; }
  const sx = (Math.random() - 0.5) * state.shake;
  const sy = (Math.random() - 0.5) * state.shake;
  g.translate(sx, sy);
  state._sx = sx; state._sy = sy;
  state.shake *= 0.82;
  if (state.shake < 0.2) state.shake = 0;
}

function showAchievementToast(text) {
  const wrap = document.getElementById("achievement-toast");
  if (!wrap) return;
  wrap.textContent = "🏆 " + text;
  wrap.classList.remove("show");
  void wrap.offsetWidth;
  wrap.classList.add("show");
  setTimeout(() => wrap.classList.remove("show"), 2400);
}

/* ---------- Per-key accuracy heatmap (summary screen) ---------- */
function renderKeyHeatmap(perKey) {
  const root = document.getElementById("heatmap");
  if (!root) return;
  root.innerHTML = "";
  let totalAttempts = 0;
  for (const k in perKey) totalAttempts += perKey[k].correct + perKey[k].wrong;
  if (totalAttempts === 0) {
    root.style.display = "none";
    return;
  }
  root.style.display = "";

  KEYBOARD_LAYOUT.forEach((row, ri) => {
    const rowEl = document.createElement("div");
    rowEl.className = "hm-row";
    // Visual indent for keyboard staggering.
    if (ri === 1) rowEl.style.paddingLeft = "16px";
    if (ri === 2) rowEl.style.paddingLeft = "30px";
    if (ri === 3) rowEl.style.paddingLeft = "60px";
    if (ri === 4) rowEl.style.paddingLeft = "120px";
    row.forEach(k => {
      const el = document.createElement("div");
      el.className = "hm-key";
      const stats = perKey[k.toLowerCase()] || perKey[k];
      const total = stats ? stats.correct + stats.wrong : 0;
      if (k === " ") { el.classList.add("hm-space"); el.textContent = "space"; }
      else el.textContent = k;
      if (total > 0) {
        const acc = stats.correct / total;
        const hue = Math.round(acc * 120); // 0=red, 120=green
        el.style.background = `hsl(${hue}, 70%, 38%)`;
        el.style.color = acc > 0.55 ? "#06140a" : "#fff";
        el.title = `${k}: ${Math.round(acc * 100)}% (${total} attempts)`;
        el.dataset.acc = Math.round(acc * 100);
      } else {
        el.classList.add("hm-empty");
        el.title = `${k}: not typed`;
      }
      rowEl.appendChild(el);
    });
    root.appendChild(rowEl);
  });
}

/* ---------- Screen routing ---------- */
const screens = {
  profile: document.getElementById("screen-profile"),
  menu:    document.getElementById("screen-menu"),
  game:    document.getElementById("screen-game"),
  summary: document.getElementById("screen-summary"),
};

function showScreen(name) {
  Object.keys(screens).forEach(k => screens[k].classList.toggle("active", k === name));
}

/* ---------- App state ---------- */
const App = {
  selectedLevel: 1,
  selectedTheme: "space",
  selectedMode: null,
  selectedAvatar: AVATARS[0],
  currentModeInstance: null,
  lastSessionStats: null,
  lastSessionLevel: 1,
  _startToken: 0,
  paused: false,

  start() {
    State.load();
    Sound.setMuted(!!State.data.muted);
    KB.init("keyboard");
    this._wireGlobalEvents();
    this._animateTitle();
    this._spawnBgDecorations(State.current ? (State.current.theme || "space") : "space");
    if (State.data.profiles.length === 0) {
      this._renderProfileScreen();
      showScreen("profile");
    } else if (State.current) {
      this._enterMenu();
    } else {
      this._renderProfileScreen();
      showScreen("profile");
    }
  },

  // Wrap each title letter in a span with a staggered bounce delay.
  _animateTitle() {
    const t = document.getElementById("game-title");
    if (!t) return;
    const text = t.textContent;
    t.textContent = "";
    let i = 0;
    for (const ch of text) {
      const span = document.createElement("span");
      span.className = "title-letter";
      span.textContent = ch;
      span.style.animationDelay = (i * 0.07) + "s";
      t.appendChild(span);
      i++;
    }
  },

  // Floating background emoji per theme; cheap CSS animations only.
  _spawnBgDecorations(themeId) {
    const root = document.getElementById("bg-decorations");
    if (!root) return;
    root.innerHTML = "";
    const t = THEMES[themeId] || THEMES.space;
    const pool = (t.collectibles || []).concat(t.background.filter(c => c.length > 0 && c !== "·" && c !== "."));
    if (!pool.length) return;
    const count = 22;
    for (let i = 0; i < count; i++) {
      const el = document.createElement("span");
      el.className = "bg-deco";
      el.textContent = pool[Math.floor(Math.random() * pool.length)];
      el.style.left = Math.random() * 100 + "vw";
      const dur = 14 + Math.random() * 22;
      const delay = -Math.random() * dur;
      el.style.animationDuration = dur + "s";
      el.style.animationDelay = delay + "s";
      el.style.fontSize = (18 + Math.random() * 26) + "px";
      el.style.opacity = (0.10 + Math.random() * 0.18).toFixed(2);
      root.appendChild(el);
    }
  },

  _wireGlobalEvents() {
    // Profile creation
    document.getElementById("btn-create-profile").addEventListener("click", () => this._createProfile());
    document.getElementById("new-profile-name").addEventListener("keydown", e => {
      if (e.key === "Enter") this._createProfile();
    });

    document.getElementById("btn-back-to-profiles").addEventListener("click", () => {
      this._renderProfileScreen();
      showScreen("profile");
    });

    document.querySelectorAll(".mode-card").forEach(card => {
      card.addEventListener("click", () => this._startGame(card.dataset.mode));
    });

    document.getElementById("btn-quit-game").addEventListener("click", () => this._quitToMenu());
    document.getElementById("btn-pause-game").addEventListener("click", () => this._togglePause());
    document.getElementById("btn-resume").addEventListener("click", () => this._setPaused(false));
    document.getElementById("btn-quit-from-pause").addEventListener("click", () => this._quitToMenu());

    document.getElementById("btn-play-again").addEventListener("click", () => {
      if (this.selectedMode) this._startGame(this.selectedMode);
    });
    document.getElementById("btn-back-to-menu").addEventListener("click", () => this._enterMenu());

    document.getElementById("btn-mute").addEventListener("click", () => this._toggleMute());
    document.getElementById("btn-mute-game").addEventListener("click", () => this._toggleMute());

    // Global key handler for the game screen.
    const hidden = document.getElementById("hidden-input");
    document.addEventListener("keydown", e => {
      if (!screens.game.classList.contains("active")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        // Esc toggles pause; from pause user can pick quit explicitly.
        this._togglePause();
        e.preventDefault();
        return;
      }
      if (this.paused) return; // swallow input while paused
      const ch = e.key;
      if (ch.length === 1) {
        if (this.currentModeInstance && this.currentModeInstance.handleKey) {
          this.currentModeInstance.handleKey(ch);
          e.preventDefault();
        }
      }
    });

    // Keep focus
    document.addEventListener("click", () => hidden.focus());

    // Inject shake keyframes once.
    const style = document.createElement("style");
    style.textContent = `
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25%      { transform: translateX(-6px); }
        75%      { transform: translateX(6px); }
      }
    `;
    document.head.appendChild(style);

    // Refresh mute icon on load.
    this._refreshMuteIcons();
  },

  _toggleMute() {
    const muted = State.toggleMute();
    this._refreshMuteIcons();
    if (muted) {
      Sound.stopBgMusic();
    } else {
      Sound.correct();
      if (this.currentModeInstance) Sound.startBgMusic(this.selectedTheme);
    }
  },

  _quitToMenu() {
    if (this.currentModeInstance) this.currentModeInstance.destroy();
    this.currentModeInstance = null;
    this._startToken++;
    this._setPaused(false);
    Sound.stopBgMusic();
    const overlay = document.getElementById("countdown");
    if (overlay) overlay.style.display = "none";
    this._enterMenu();
  },

  _togglePause() {
    // No-op if no game in progress yet.
    if (!this.currentModeInstance) return;
    this._setPaused(!this.paused);
  },

  _setPaused(p) {
    this.paused = !!p;
    const overlay = document.getElementById("pause-overlay");
    if (overlay) overlay.style.display = this.paused ? "flex" : "none";
    // Pause stats clock so WPM doesn't decay during pause.
    const inst = this.currentModeInstance;
    if (inst && inst.stats) {
      if (this.paused) inst.stats._pauseStart = performance.now();
      else if (inst.stats._pauseStart) {
        const delta = performance.now() - inst.stats._pauseStart;
        if (inst.stats.startTime) inst.stats.startTime += delta;
        inst.stats._pauseStart = null;
      }
    }
  },

  // Check for newly-earned badges mid-session and pop a toast.
  checkLiveAchievements(stats) {
    if (!stats._announced) stats._announced = new Set();
    const possible = Stats.pickBadges(stats);
    for (const b of possible) {
      if (!stats._announced.has(b)) {
        stats._announced.add(b);
        showAchievementToast(b);
      }
    }
  },

  _refreshMuteIcons() {
    const icon = State.data.muted ? "🔇" : "🔊";
    document.getElementById("btn-mute").textContent = icon;
    document.getElementById("btn-mute-game").textContent = icon;
  },

  /* ---------- Profile screen ---------- */
  _renderProfileScreen() {
    const list = document.getElementById("profile-list");
    list.innerHTML = "";
    State.data.profiles.forEach(p => {
      const card = document.createElement("div");
      card.className = "profile-card";
      card.innerHTML = `
        <span class="avatar-big">${p.avatar}</span>
        <div class="pc-name">${escapeHtml(p.name)}</div>
        <div class="pc-stats">Level ${p.unlockedLevel} · Best ${p.bestWpm} WPM</div>
        <div class="pc-delete">remove</div>
      `;
      card.addEventListener("click", e => {
        if (e.target.classList.contains("pc-delete")) {
          if (confirm("Remove player " + p.name + "? Their progress will be lost.")) {
            State.deleteProfile(p.id);
            this._renderProfileScreen();
          }
          return;
        }
        State.setActive(p.id);
        this._enterMenu();
      });
      list.appendChild(card);
    });

    // Render avatar picker
    const ap = document.getElementById("avatar-picker");
    ap.innerHTML = "";
    AVATARS.forEach((emoji, i) => {
      const el = document.createElement("div");
      el.className = "av" + (emoji === this.selectedAvatar ? " selected" : "");
      el.textContent = emoji;
      el.addEventListener("click", () => {
        this.selectedAvatar = emoji;
        this._renderProfileScreen();
      });
      ap.appendChild(el);
    });
  },

  _createProfile() {
    const name = document.getElementById("new-profile-name").value.trim();
    if (!name) {
      document.getElementById("new-profile-name").focus();
      return;
    }
    const p = State.createProfile(name, this.selectedAvatar);
    State.setActive(p.id);
    document.getElementById("new-profile-name").value = "";
    Sound.levelUp();
    this._enterMenu();
  },

  /* ---------- Menu screen ---------- */
  _enterMenu() {
    if (!State.current) {
      this._renderProfileScreen();
      showScreen("profile");
      return;
    }
    this.selectedTheme = State.current.theme || "space";
    if (this.selectedLevel > State.current.unlockedLevel) this.selectedLevel = State.current.unlockedLevel;
    applyTheme(this.selectedTheme);
    this._spawnBgDecorations(this.selectedTheme);

    document.getElementById("menu-avatar").textContent = State.current.avatar;
    document.getElementById("menu-player-name").textContent = State.current.name;
    document.getElementById("menu-player-stats").textContent =
      `Level ${State.current.unlockedLevel} · Best WPM: ${State.current.bestWpm} · Acc ${State.current.bestAccuracy}%`;

    this._renderLevelPicker();
    this._renderThemePicker();
    showScreen("menu");
    this._refreshMuteIcons();
  },

  _renderLevelPicker() {
    const root = document.getElementById("level-picker");
    root.innerHTML = "";
    LESSONS.forEach(lesson => {
      const btn = document.createElement("button");
      btn.className = "level-btn";
      btn.textContent = lesson.id;
      btn.title = lesson.name + " — " + lesson.intro;
      if (lesson.id > State.current.unlockedLevel) btn.classList.add("locked");
      if (lesson.id === this.selectedLevel) btn.classList.add("active");
      btn.addEventListener("click", () => {
        if (lesson.id > State.current.unlockedLevel) {
          // Tooltip-style nudge.
          btn.animate(
            [{ transform: "translateX(0)" }, { transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "translateX(0)" }],
            { duration: 200 }
          );
          return;
        }
        this.selectedLevel = lesson.id;
        this._renderLevelPicker();
      });
      root.appendChild(btn);
    });
  },

  _renderThemePicker() {
    const root = document.getElementById("theme-picker");
    root.innerHTML = "";
    THEME_IDS.forEach(id => {
      const t = THEMES[id];
      const btn = document.createElement("button");
      btn.className = "theme-btn";
      btn.textContent = t.label;
      if (id === this.selectedTheme) btn.classList.add("active");
      btn.addEventListener("click", () => {
        this.selectedTheme = id;
        State.setTheme(id);
        applyTheme(id);
        this._spawnBgDecorations(id);
        this._renderThemePicker();
      });
      root.appendChild(btn);
    });
  },

  /* ---------- Game lifecycle ---------- */
  _startGame(modeName) {
    this.selectedMode = modeName;
    applyTheme(this.selectedTheme);
    const lesson = LESSONS.find(l => l.id === this.selectedLevel);
    const theme = THEMES[this.selectedTheme];

    // Reset HUD.
    document.getElementById("hud-wpm").textContent = "0";
    document.getElementById("hud-acc").textContent = "100%";
    document.getElementById("hud-streak").textContent = "0";
    document.getElementById("hud-extra-label").textContent = "Score";
    document.getElementById("hud-extra").textContent = "0";

    showScreen("game");
    setTimeout(() => document.getElementById("hidden-input").focus(), 50);

    // Resize canvas to fit container with devicePixelRatio.
    this._resizeCanvas();

    const canvas = document.getElementById("game-canvas");
    const ctx = {
      canvas,
      level: lesson,
      theme,
      onEnd: (stats) => this._endGame(stats, lesson.id),
    };

    if (this.currentModeInstance) this.currentModeInstance.destroy();
    this.currentModeInstance = null;

    let mode;
    switch (modeName) {
      case "practice": mode = PracticeMode; break;
      case "falling":  mode = FallingMode;  break;
      case "shooter":  mode = ShooterMode;  break;
      case "race":     mode = RaceMode;     break;
      default:         mode = PracticeMode;
    }
    this.lastSessionLevel = lesson.id;

    // Show a Get Ready countdown, then init the mode + start music.
    const token = ++this._startToken;
    this._countdown(() => {
      if (token !== this._startToken) return;        // user quit / restarted
      const instance = Object.assign({}, mode);
      instance.init(ctx);
      this.currentModeInstance = instance;
      if (!State.data.muted) Sound.startBgMusic(this.selectedTheme);
    });
  },

  // Shows 3 / 2 / 1 / GO! overlay and calls cb when done.
  _countdown(cb) {
    const overlay = document.getElementById("countdown");
    const text = document.getElementById("countdown-text");
    if (!overlay || !text) { cb(); return; }
    const sequence = ["3", "2", "1", "GO!"];
    let i = 0;
    overlay.style.display = "flex";
    const tick = () => {
      if (i >= sequence.length) {
        overlay.style.display = "none";
        cb();
        return;
      }
      const val = sequence[i];
      text.textContent = val;
      text.classList.toggle("go", val === "GO!");
      // Restart the pop animation.
      text.style.animation = "none";
      void text.offsetWidth;
      text.style.animation = "";
      Sound.correct();
      i++;
      setTimeout(tick, val === "GO!" ? 600 : 700);
    };
    tick();
  },

  _resizeCanvas() {
    const canvas = document.getElementById("game-canvas");
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.max(640, Math.floor(rect.width));
    canvas.height = Math.max(360, Math.floor(rect.height));
  },

  _endGame(stats, levelPlayed) {
    this.lastSessionStats = stats;
    this.currentModeInstance = null;
    Sound.stopBgMusic();
    const result = State.applySession(stats, levelPlayed);
    Sound.win();
    document.getElementById("sum-wpm").textContent = stats.wpm();
    document.getElementById("sum-acc").textContent = stats.accuracy() + "%";
    document.getElementById("sum-score").textContent = stats.score;

    // Feedback line — includes mention of trouble keys if any.
    const trouble = stats.troublesomeKeys(2);
    let fb = Stats.pickFeedback(stats);
    if (trouble.length) {
      const t = trouble.map(x => `"${x.key}"`).join(" and ");
      fb += ` Try working on ${t} next time.`;
    }
    if (result && State.current.unlockedLevel === levelPlayed + 1) {
      fb = `🎉 Level ${levelPlayed} complete — Level ${levelPlayed + 1} unlocked! ` + fb;
    }
    document.getElementById("summary-feedback").textContent = fb;

    // Badges.
    const badgeWrap = document.getElementById("summary-badges");
    badgeWrap.innerHTML = "";
    (result ? result.badges : []).forEach(b => {
      const el = document.createElement("div");
      el.className = "badge";
      el.textContent = b;
      badgeWrap.appendChild(el);
    });

    document.getElementById("summary-title").textContent =
      stats.accuracy() >= 80 ? "Great job! 🎉" : "Keep practicing! 💪";

    // Star rating: 3 stars = high accuracy + speed, 2 = solid, 1 = participation.
    this._renderStarRating(stats);
    renderKeyHeatmap(stats.perKey || {});

    showScreen("summary");
    this._shootConfetti(stats);
  },

  _renderStarRating(stats) {
    const wrap = document.getElementById("star-rating");
    if (!wrap) return;
    const acc = stats.accuracy();
    const wpm = stats.wpm();
    let stars = 1;
    if (acc >= 75) stars = 2;
    if (acc >= 90 && wpm >= 18) stars = 3;
    // Special case: short sessions shouldn't auto-award 3 stars on a single correct char.
    if (stats.totalChars < 10) stars = Math.min(stars, 1);

    const els = wrap.querySelectorAll(".star");
    els.forEach(e => e.classList.remove("lit"));
    for (let i = 0; i < stars; i++) {
      setTimeout(() => els[i] && els[i].classList.add("lit"), 200 + i * 220);
    }
  },

  _shootConfetti(stats) {
    const card = document.querySelector(".summary-card");
    if (!card) return;
    // Remove old pieces.
    card.querySelectorAll(".confetti-piece").forEach(p => p.remove());
    // Only fire celebratory confetti on a decent run.
    if (stats.accuracy() < 60) return;
    const colors = ["#ff5c8a", "#5eead4", "#fbbf24", "#a78bfa", "#5cffa7", "#7ee7ff"];
    const count = stats.accuracy() >= 90 ? 60 : 30;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      const angle = Math.random() * Math.PI * 2;
      const dist  = 140 + Math.random() * 240;
      const cx = Math.cos(angle) * dist;
      const cy = Math.sin(angle) * dist * 0.7 + 80;
      piece.style.setProperty("--cx", cx + "px");
      piece.style.setProperty("--cy", cy + "px");
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = (Math.random() * 0.15) + "s";
      piece.style.transform = `translate(-50%, -50%) rotate(${Math.random() * 360}deg)`;
      card.appendChild(piece);
      setTimeout(() => piece.remove(), 1700);
    }
  },
};

window.addEventListener("DOMContentLoaded", () => App.start());
window.addEventListener("resize", () => {
  if (App.currentModeInstance) App._resizeCanvas();
});
