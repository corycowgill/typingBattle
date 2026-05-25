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

    document.getElementById("btn-quit-game").addEventListener("click", () => {
      if (this.currentModeInstance) this.currentModeInstance.destroy();
      this.currentModeInstance = null;
      this._startToken++;
      const overlay = document.getElementById("countdown");
      if (overlay) overlay.style.display = "none";
      this._enterMenu();
    });

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
      // Ignore modifier-only or non-printable keys we don't care about.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        document.getElementById("btn-quit-game").click();
        return;
      }
      let ch = e.key;
      if (ch.length === 1) {
        // For consistency keep case for capital lessons.
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
    if (!muted) Sound.correct();
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

    // Show a Get Ready countdown, then init the mode. We only assign
    // currentModeInstance once init is complete so stray keystrokes during
    // the countdown don't hit an uninitialized object.
    const token = ++this._startToken;
    this._countdown(() => {
      if (token !== this._startToken) return;        // user quit / restarted
      const instance = Object.assign({}, mode);
      instance.init(ctx);
      this.currentModeInstance = instance;
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
