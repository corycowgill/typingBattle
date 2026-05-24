/* ===================================================================
   stats.js - WPM + accuracy tracking for a single session.
   Creates an instance with Stats.create() then call onCorrect(), onWrong()
   per keystroke and onWord() when a word completes.
   =================================================================== */

const Stats = {
  create() {
    return {
      startTime: null,
      correctChars: 0,
      wrongChars: 0,
      totalChars: 0,
      bestStreak: 0,
      streak: 0,
      wordsCompleted: 0,
      score: 0,
      perKey: Object.create(null), // {key: {correct, wrong}}

      _ensureKey(k) {
        if (!this.perKey[k]) this.perKey[k] = { correct: 0, wrong: 0 };
        return this.perKey[k];
      },

      start() { if (!this.startTime) this.startTime = performance.now(); },

      onCorrect(ch) {
        this.start();
        this.correctChars++;
        this.totalChars++;
        this.streak++;
        if (this.streak > this.bestStreak) this.bestStreak = this.streak;
        this._ensureKey(ch).correct++;
      },

      onWrong(expectedCh) {
        this.start();
        this.wrongChars++;
        this.totalChars++;
        this.streak = 0;
        if (expectedCh) this._ensureKey(expectedCh).wrong++;
      },

      onWord() {
        this.wordsCompleted++;
        this.score += 10 + Math.min(50, this.streak); // small streak bonus
      },

      addScore(n) { this.score += n; },

      wpm() {
        if (!this.startTime) return 0;
        const minutes = (performance.now() - this.startTime) / 60000;
        if (minutes < 0.05) return 0;
        return Math.round((this.correctChars / 5) / minutes);
      },

      accuracy() {
        if (this.totalChars === 0) return 100;
        return Math.round((this.correctChars / this.totalChars) * 100);
      },

      // Worst keys (highest error rate, min 2 attempts). Returns up to N.
      troublesomeKeys(n = 3) {
        const items = [];
        for (const k in this.perKey) {
          const v = this.perKey[k];
          const total = v.correct + v.wrong;
          if (total < 2) continue;
          const errRate = v.wrong / total;
          if (errRate > 0) items.push({ key: k, errRate, total });
        }
        items.sort((a, b) => b.errRate - a.errRate);
        return items.slice(0, n);
      },
    };
  },

  // Pick a kid-friendly feedback line based on results.
  pickFeedback(s) {
    const acc = s.accuracy();
    const wpm = s.wpm();
    if (acc >= 90 && wpm >= 15) return FEEDBACK_GREAT[Math.floor(Math.random() * FEEDBACK_GREAT.length)];
    if (acc >= 75) return FEEDBACK_GOOD[Math.floor(Math.random() * FEEDBACK_GOOD.length)];
    return FEEDBACK_RETRY[Math.floor(Math.random() * FEEDBACK_RETRY.length)];
  },

  // Earned badges for this session.
  pickBadges(s) {
    const badges = [];
    if (s.accuracy() === 100 && s.totalChars >= 20) badges.push("💯 Perfect Run");
    if (s.bestStreak >= 25) badges.push("🔥 25 Streak");
    if (s.bestStreak >= 50) badges.push("⚡ 50 Streak");
    if (s.wpm() >= 25) badges.push("🏎️ 25 WPM");
    if (s.wpm() >= 40) badges.push("🚀 40 WPM");
    if (s.wordsCompleted >= 20) badges.push("📚 Word Wizard");
    return badges;
  },
};
