// Dial mode configuration
window.CONFIG = {
  CAM_OPACITY: 0.95,

  // Gesture thresholds
  OPEN_HAND_MIN: 70,

  // Box drawing
  CORNER_LEN: 18,
  CORNER_THICKNESS: 2,
  LINE_HEIGHT: 22,
  BOX_BG_OPACITY: 0.6,
  BOX_BG_COLOR: '#0F0F14',

  // Font sizes
  TITLE_FONT_PX: 14,
  BODY_FONT_PX: 12,
  SHELF_FONT_PX: 9,
  LEGEND_FONT_PX: 9,

  // Highlight
  GOLD_ACCENT: '#FFD700',

  // Shelf
  SHELF_SLOT_W: 70,
  SHELF_SLOT_H: 38,
  SHELF_GAP: 12,
  SHELF_CORNER_LEN: 8,
  SHELF_BG_OPACITY: 0.4,
  SHELF_CORNER_COLOR: '#A0A0A0',

  // Interaction
  DEFAULT_BOX_W: 70,

  // Hand skeleton
  SHOW_HAND_SKELETON: true,
  HAND_NODE_RADIUS: 3,
  HAND_NODE_COLOR: '#505064',
  HAND_BONE_COLOR: '#323246',
  HAND_BONE_THICKNESS: 1,

  // Dial - relative tilt with recalibration on fist release
  DIAL_DEAD_ZONE_PCT: 0.40,   // fraction of MAX_TILT before scrolling starts
  DIAL_MAX_TILT: 45,          // degrees at which scroll speed maxes out
  DIAL_FIRST_DELAY: 50,       // frames to wait after first step before continuous scroll (~0.8s)
  DIAL_SCROLL_INTERVAL: 30,   // frames between scroll steps at gentle tilt
  DIAL_MIN_INTERVAL: 12,      // fastest scroll interval (frames) at full tilt
  DIAL_INDICATOR_RADIUS: 20,
  DIAL_SMOOTHING: 0.35,       // lower = smoother/slower response

  // Hands together
  HANDS_TOGETHER_DIST: 100,

  // Animation
  TELEPORT_EXPAND_SPEED: 0.15,
  TELEPORT_COLLAPSE_SPEED: 0.12,

  // Expanded box
  EXPANDED_W: 480,
  EXPANDED_H: 350,
  EXPANDED_Y_OFFSET: 40,

  // Cooldowns
  EXPAND_COOLDOWN: 15,
  COLLAPSE_COOLDOWN: 15,

  // Text effect: 'diffusion' | 'none'
  TEXT_EFFECT: 'diffusion',
  TEXT_EFFECT_FRAMES: 12,

  // Selected glow
  SELECTED_GLOW_ALPHA: 0.15,

  // Links
  LINK_HOLD_FRAMES: 45,
  LINK_COLOR: '#6699FF',
  LINK_HOVER_RING_RADIUS: 12,

  // Fallback resume sections
  FALLBACK_SECTIONS: [
    { title: 'Experience', body: 'Software Engineer\n@ Company Name\n2022 - Present' },
    { title: 'Skills', body: 'Python - CV - MediaPipe\nCreative Coding\nInteraction Design' },
    { title: 'Projects', body: 'HandCV\nHand-gesture interactive\nresume / portfolio' },
    { title: 'Education', body: 'B.S. Computer Science\nUniversity Name\n2018 - 2022' },
    { title: 'Contact', body: 'hello@example.com\ngithub.com/you\nlinkedin.com/in/you' },
    { title: 'About', body: 'the.poet.engineer\nBuilder of things\nthat move with hands' },
  ],
};

// Color helpers
window.rgba = function(hex, alpha) {
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
};

window.grayRgb = function(v) {
  v = Math.max(0, Math.min(255, Math.round(v)));
  return 'rgb(' + v + ',' + v + ',' + v + ')';
};
