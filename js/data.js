/* ===================================================================
   data.js - lesson curriculum & word lists.
   Each level defines:
     keys      : set of allowed characters (lowercase + any specials)
     words     : short word list for falling/shooter/practice modes
     sentences : sentence list for race mode
     intro     : kid-friendly description shown on level select
   =================================================================== */

const LESSONS = [
  // -------- Level 1: home row --------
  {
    id: 1,
    name: "Home Row",
    intro: "Rest your fingers on a s d f and j k l ; — let's start here!",
    keys: "asdfjkl;",
    words: ["ask", "lad", "dad", "as", "fall", "lass", "lads", "salsa", "flask", "all", "add", "alfalfa", "salad", "fads"],
    sentences: [
      "a sad lad asks a fall",
      "all lads fall as salsa falls",
      "ask dad as a salad falls",
    ],
  },
  // -------- Level 2: + e i --------
  {
    id: 2,
    name: "Add E and I",
    intro: "New keys: e (middle finger, top row) and i (middle finger, top row).",
    keys: "asdfjkl;ei",
    words: ["like", "side", "field", "dad", "feed", "dial", "kid", "kids", "slide", "lid", "deed", "fall", "easel", "field"],
    sentences: [
      "a kid likes a field",
      "easels slide as deeds fall",
      "kids feed dad a salad",
    ],
  },
  // -------- Level 3: + r u --------
  {
    id: 3,
    name: "Add R and U",
    intro: "New keys: r and u — both use your index fingers.",
    keys: "asdfjkl;eiru",
    words: ["ruler", "surf", "friend", "drive", "ride", "fruit", "rude", "fire", "lure", "rules", "asks", "drives", "real", "lurk"],
    sentences: [
      "a friend rides a fire surfer",
      "rules drive a real ruler",
      "kids surf as fruit falls",
    ],
  },
  // -------- Level 4: + t y o p --------
  {
    id: 4,
    name: "Add T Y O P",
    intro: "Adding t, y, o, p — most everyday words live here.",
    keys: "asdfjkl;eirutyop",
    words: ["party", "story", "play", "tiger", "porty", "happy", "type", "today", "puppy", "poster", "loyal", "report", "polite", "yes"],
    sentences: [
      "today a tiger plays a story",
      "a happy puppy types a poster",
      "polite friends play loyal parts",
    ],
  },
  // -------- Level 5: + g h b n m --------
  {
    id: 5,
    name: "Add G H B N M",
    intro: "Bottom and middle rows: g, h, b, n, m.",
    keys: "asdfjkl;eirutyopghbnm",
    words: ["jungle", "monkey", "bring", "mango", "hammer", "battle", "ginger", "mighty", "bother", "humble", "ribbon", "gentle"],
    sentences: [
      "a mighty monkey brings a mango",
      "gentle ginger battles a humble bear",
      "bring my hammer to the jungle",
    ],
  },
  // -------- Level 6: + q w v c x z --------
  {
    id: 6,
    name: "Full Letters",
    intro: "All letters now! Pinkies on q and z, ring on w and x.",
    keys: "abcdefghijklmnopqrstuvwxyz;",
    words: ["quiz", "wizard", "vacation", "extra", "zebra", "cozy", "victory", "vexing", "quartz", "exotic", "vivid", "buzz"],
    sentences: [
      "a wizard wins a vivid quiz",
      "zebras zip through exotic woods",
      "extra vacation makes me cozy",
    ],
  },
  // -------- Level 7: numbers --------
  {
    id: 7,
    name: "Numbers",
    intro: "Numbers row! Reach with the right finger — don't peek.",
    keys: "abcdefghijklmnopqrstuvwxyz;0123456789 ",
    words: ["7 dogs", "level 3", "room 42", "12 cats", "8 bikes", "9 lives", "26 trees", "100 stars", "5 friends"],
    sentences: [
      "level 3 has 7 jumping cats",
      "room 42 holds 100 stars and 5 friends",
      "8 bikes raced 26 happy dogs",
    ],
  },
  // -------- Level 8: capitals --------
  {
    id: 8,
    name: "Capitals",
    intro: "Hold Shift with your pinky for capital letters.",
    keys: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ;0123456789 ",
    words: ["Mars", "London", "Sunday", "Anna", "King", "Robot", "Pizza", "Echo", "Tiger", "River"],
    sentences: [
      "Anna saw Mars from London",
      "King Tiger ordered Pizza on Sunday",
      "Echo the Robot raced down the River",
    ],
  },
  // -------- Level 9: punctuation --------
  {
    id: 9,
    name: "Punctuation",
    intro: "Add commas, periods, question marks and exclamation points.",
    keys: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ;0123456789 ,.!?'",
    words: ["Hi!", "Wow!", "Run, hide!", "Go, go, go!", "Yes?", "Awesome!", "Don't stop!"],
    sentences: [
      "Wow, look at that dragon fly!",
      "Are you ready? Let's go!",
      "Don't peek, just type and run.",
    ],
  },
  // -------- Level 10: full sentences / paragraphs --------
  {
    id: 10,
    name: "Full Stories",
    intro: "Real sentences. Type smoothly without looking at your hands!",
    keys: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ;0123456789 ,.!?'",
    words: ["champion", "adventure", "lightning", "treasure", "explorer", "powerful", "courage"],
    sentences: [
      "The brave explorer found a treasure inside a glowing cave.",
      "Lightning lit the sky as the champion raced home.",
      "With courage and a friend, every adventure becomes a story.",
      "A small wizard learned that practice makes typing feel like magic.",
    ],
  },
];

/* Finger-color mapping for the on-screen keyboard. */
const FINGER_MAP = {
  // left pinky
  "`": "pinky", "1": "pinky", "q": "pinky", "a": "pinky", "z": "pinky", "Tab": "pinky", "CapsLock": "pinky", "Shift": "pinky",
  // left ring
  "2": "ring", "w": "ring", "s": "ring", "x": "ring",
  // left middle
  "3": "middle", "e": "middle", "d": "middle", "c": "middle",
  // left index
  "4": "index", "5": "index", "r": "index", "t": "index", "f": "index", "g": "index", "v": "index", "b": "index",
  // right index
  "6": "index", "7": "index", "y": "index", "u": "index", "h": "index", "j": "index", "n": "index", "m": "index",
  // right middle
  "8": "middle", "i": "middle", "k": "middle", ",": "middle",
  // right ring
  "9": "ring", "o": "ring", "l": "ring", ".": "ring",
  // right pinky
  "0": "pinky", "-": "pinky", "=": "pinky",
  "p": "pinky", "[": "pinky", "]": "pinky", "\\": "pinky",
  ";": "pinky", "'": "pinky", "Enter": "pinky", "Backspace": "pinky", "/": "pinky",
  // thumbs
  " ": "thumb",
};

/* Physical keyboard layout for rendering the on-screen keyboard. */
const KEYBOARD_LAYOUT = [
  ["`","1","2","3","4","5","6","7","8","9","0","-","="],
  ["q","w","e","r","t","y","u","i","o","p","[","]","\\"],
  ["a","s","d","f","g","h","j","k","l",";","'"],
  ["z","x","c","v","b","n","m",",",".","/"],
  [" "],
];

/* Helpful kid-friendly feedback strings. */
const FEEDBACK_GREAT  = ["Awesome typing!", "You're on fire!", "Super speedy!", "Nice work, champ!", "Keep crushing it!"];
const FEEDBACK_GOOD   = ["Nice job!", "Good run!", "Keep going!", "You're getting it!"];
const FEEDBACK_RETRY  = ["Almost! Try again.", "Slow down, you've got this.", "Watch the finger colors!"];
