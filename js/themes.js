/* ===================================================================
   themes.js - per-theme palette + emoji sprite set.
   Themes set a CSS class on <body>; sprite arrays are read by the
   game modes when drawing on canvas.
   =================================================================== */

const THEMES = {
  space: {
    id: "space",
    label: "Space",
    cssClass: "theme-space",
    player: "🚀",
    enemies: ["👾", "🛸", "👽", "🪐"],
    collectibles: ["⭐", "💫", "✨"],
    background: ["⭐", ".", "·", "*"],
    bossEmoji: "☄️",
  },
  underwater: {
    id: "underwater",
    label: "Underwater",
    cssClass: "theme-underwater",
    player: "🐠",
    enemies: ["🐙", "🦈", "🐡", "🦑"],
    collectibles: ["🐚", "🪸", "🫧"],
    background: ["🫧", "·", "○", " "],
    bossEmoji: "🐋",
  },
  jungle: {
    id: "jungle",
    label: "Jungle",
    cssClass: "theme-jungle",
    player: "🐒",
    enemies: ["🐍", "🦂", "🐅", "🦏"],
    collectibles: ["🍌", "🥥", "🍍"],
    background: ["🌿", "·", "🍃", " "],
    bossEmoji: "🦍",
  },
  castle: {
    id: "castle",
    label: "Castle",
    cssClass: "theme-castle",
    player: "🛡️",
    enemies: ["🐉", "👻", "🧌", "🦇"],
    collectibles: ["💎", "👑", "🗝️"],
    background: ["✦", "·", ".", " "],
    bossEmoji: "🐲",
  },
};

const THEME_IDS = ["space", "underwater", "jungle", "castle"];

function applyTheme(themeId) {
  const t = THEMES[themeId] || THEMES.space;
  document.body.className = t.cssClass;
  return t;
}
