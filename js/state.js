/* ===================================================================
   state.js - profile management + persistence in localStorage.
   =================================================================== */

const STORAGE_KEY = "typingBattle.profiles.v1";

const AVATARS = ["🚀","🐠","🐉","🐒","🦊","🦄","🐱","🐼","🦁","🐢","🐧","🦉","🐝","🐙","🦋","🐲"];

const State = {
  data: { profiles: [], activeId: null, muted: false },
  current: null,

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.data = Object.assign(this.data, JSON.parse(raw));
    } catch (e) { /* corrupt or unavailable: ignore */ }
    if (this.data.activeId) {
      this.current = this.data.profiles.find(p => p.id === this.data.activeId) || null;
    }
    Sound.setMuted(!!this.data.muted);
  },

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) { /* private mode, etc. */ }
  },

  createProfile(name, avatar) {
    name = (name || "Player").trim().slice(0, 14);
    const id = "p_" + Date.now() + "_" + Math.floor(Math.random() * 999);
    const profile = {
      id,
      name,
      avatar: avatar || AVATARS[Math.floor(Math.random() * AVATARS.length)],
      theme: "space",
      unlockedLevel: 1,
      bestWpm: 0,
      bestAccuracy: 0,
      totalChars: 0,
      wordsTyped: 0,
      sessionsPlayed: 0,
      daysPlayed: [],            // ["2026-05-25", ...]
      bestWpmByMode: {},
      badges: [],
      perKey: {},                // long-term per-key stats
    };
    this.data.profiles.push(profile);
    this.save();
    return profile;
  },

  deleteProfile(id) {
    this.data.profiles = this.data.profiles.filter(p => p.id !== id);
    if (this.data.activeId === id) {
      this.data.activeId = null;
      this.current = null;
    }
    this.save();
  },

  setActive(id) {
    this.data.activeId = id;
    this.current = this.data.profiles.find(p => p.id === id) || null;
    this.save();
  },

  setTheme(themeId) {
    if (!this.current) return;
    this.current.theme = themeId;
    this.save();
  },

  /* Apply a finished session's results to the active profile. */
  applySession(s, levelPlayed, modeName) {
    if (!this.current) return;
    const p = this.current;
    const wpm = s.wpm();
    const acc = s.accuracy();
    p.totalChars += s.correctChars;
    p.wordsTyped = (p.wordsTyped || 0) + (s.wordsCompleted || 0);
    p.sessionsPlayed = (p.sessionsPlayed || 0) + 1;
    if (!p.daysPlayed) p.daysPlayed = [];
    const today = new Date().toISOString().slice(0, 10);
    if (!p.daysPlayed.includes(today)) p.daysPlayed.push(today);
    if (wpm > p.bestWpm) p.bestWpm = wpm;
    if (acc > p.bestAccuracy) p.bestAccuracy = acc;
    if (modeName) {
      if (!p.bestWpmByMode) p.bestWpmByMode = {};
      if (wpm > (p.bestWpmByMode[modeName] || 0)) p.bestWpmByMode[modeName] = wpm;
    }

    // Merge per-key stats.
    for (const k in s.perKey) {
      if (!p.perKey[k]) p.perKey[k] = { correct: 0, wrong: 0 };
      p.perKey[k].correct += s.perKey[k].correct;
      p.perKey[k].wrong   += s.perKey[k].wrong;
    }

    // Unlock next level if accuracy >= 80 and at least 20 chars typed.
    let leveledUp = false;
    if (acc >= 80 && s.correctChars >= 20 && levelPlayed === p.unlockedLevel && p.unlockedLevel < LESSONS.length) {
      p.unlockedLevel++;
      leveledUp = true;
      Sound.levelUp();
    }

    // Save earned badges (unique).
    const earned = Stats.pickBadges(s);
    for (const b of earned) {
      if (!p.badges.includes(b)) p.badges.push(b);
    }

    this.save();
    return { wpm, accuracy: acc, badges: earned, leveledUp };
  },

  toggleMute() {
    this.data.muted = !this.data.muted;
    Sound.setMuted(this.data.muted);
    this.save();
    return this.data.muted;
  },
};
