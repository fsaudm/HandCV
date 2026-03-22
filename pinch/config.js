// Pinch mode configuration
window.CONFIG = {
  CAM_OPACITY: 0.95,

  // Gesture thresholds
  FIST_CURL_MAX: 80,
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
  HIGHLIGHT_GROW: 4,
  HIGHLIGHT_SCALE: 1.05,

  // Shelf
  SHELF_SLOT_W: 70,
  SHELF_SLOT_H: 38,
  SHELF_GAP: 12,
  SHELF_CORNER_LEN: 8,
  SHELF_BG_OPACITY: 0.4,
  SHELF_CORNER_COLOR: '#A0A0A0',

  // Interaction
  DEFAULT_BOX_W: 70,
  DEFAULT_BOX_H: 38,
  BOX_COLOR: '#B4B4B4',

  // Hand skeleton
  SHOW_HAND_SKELETON: true,
  HAND_NODE_RADIUS: 3,
  HAND_NODE_COLOR: '#505064',
  HAND_BONE_COLOR: '#323246',
  HAND_BONE_THICKNESS: 1,

  // Pinch thresholds
  PINCH_THRESHOLD: 24,
  PINCH_RELEASE_THRESHOLD: 34,
  PINCH_DRAG_RELEASE: 70,

  // Expand / interaction
  EXPAND_MARGIN: 40,

  // Fist
  FIST_COOLDOWN_FRAMES: 45,
  FIST_RING_FRAMES: 60,
  LEFT_FIST_RING_FRAMES: 120,
  FIST_RING_RADIUS: 28,

  // Open hand
  OPEN_HAND_COOLDOWN_FRAMES: 30,

  // Box animation
  OPEN_SPEED: 0.06,
  CLOSE_SPEED: 0.08,

  // Open box dimensions
  OPEN_BOX_W: 320,
  OPEN_BOX_H: 240,

  // Layout
  MAX_BOXES: 20,
  GRID_SIZE: 40,
  TOGGLE_COOLDOWN_FRAMES: 20,

  // Pinch dot
  PINCH_DOT_RADIUS: 5,

  // Ghost dots
  GHOST_HIT_RADIUS: 20,
  GHOST_DOT_RADIUS: 3,
  GHOST_RING_RADIUS: 8,

  // Onboarding
  ONBOARDING_OPACITY: 0.7,
  ONBOARDING_IMG_HEIGHT: 140,

  // Legend
  LEGEND_W: 160,
  LEGEND_H: 70,
  LEGEND_MARGIN: 40,

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
