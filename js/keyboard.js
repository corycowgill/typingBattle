/* ===================================================================
   keyboard.js - renders the on-screen QWERTY keyboard with finger-color
   hints, key locking by current level, and "next key" highlight.
   =================================================================== */

const KB = {
  container: null,
  keyEls: {},               // {lowercaseChar: HTMLElement}
  currentLevel: null,       // the lesson object whose keys are unlocked
  nextChar: null,

  init(containerId) {
    this.container = document.getElementById(containerId);
    this.render();
  },

  render() {
    this.container.innerHTML = "";
    this.keyEls = {};
    KEYBOARD_LAYOUT.forEach((row, rIdx) => {
      const rowEl = document.createElement("div");
      rowEl.className = "kb-row";

      // Visual prefix labels (pretend Tab / Caps / Shift on the left).
      if (rIdx === 1) this._addLabel(rowEl, "Tab", "wide", "pinky");
      if (rIdx === 2) this._addLabel(rowEl, "Caps", "wide", "pinky");
      if (rIdx === 3) this._addLabel(rowEl, "Shift", "wide", "pinky");

      row.forEach(k => {
        const el = document.createElement("div");
        const finger = FINGER_MAP[k] || "index";
        let cls = "kb-key f-" + finger;
        let label = k;
        if (k === " ") { cls += " xwide"; label = ""; }
        el.className = cls;
        el.textContent = label || "";
        rowEl.appendChild(el);
        this.keyEls[k] = el;
      });

      // Right-side keys.
      if (rIdx === 0) this._addLabel(rowEl, "⌫", "wide", "pinky");
      if (rIdx === 1) this._addLabel(rowEl, "↵", "wide", "pinky");
      if (rIdx === 2) this._addLabel(rowEl, "↵", "wide", "pinky");
      if (rIdx === 3) this._addLabel(rowEl, "Shift", "wide", "pinky");

      this.container.appendChild(rowEl);
    });
  },

  _addLabel(row, text, sizeCls, fingerCls) {
    const el = document.createElement("div");
    el.className = "kb-key " + sizeCls + " f-" + fingerCls;
    el.style.fontSize = "11px";
    el.style.opacity = "0.85";
    el.textContent = text;
    row.appendChild(el);
  },

  setLevel(lesson) {
    this.currentLevel = lesson;
    const allowed = new Set(lesson.keys.toLowerCase().split(""));
    Object.keys(this.keyEls).forEach(k => {
      const el = this.keyEls[k];
      el.classList.remove("locked");
      // Always treat space as available once we hit any sentence-bearing lesson.
      if (k === " " || allowed.has(k.toLowerCase())) {
        // unlocked
      } else {
        el.classList.add("locked");
      }
    });
  },

  // Highlight the key the user should press next. ch may be uppercase / a digit / punct.
  highlightNext(ch) {
    if (this.nextChar !== null) {
      const prev = this.keyEls[this.nextChar];
      if (prev) prev.classList.remove("next");
    }
    if (ch === null || ch === undefined) { this.nextChar = null; return; }
    const lc = ch.toLowerCase();
    const el = this.keyEls[lc];
    if (el) el.classList.add("next");
    this.nextChar = lc;
  },

  flash(ch, correct) {
    const lc = (ch || "").toLowerCase();
    const el = this.keyEls[lc];
    if (!el) return;
    const cls = correct ? "pressed" : "wrong";
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 120);
  },
};
