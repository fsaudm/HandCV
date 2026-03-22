// Dial + teleport mode overrides
Object.assign(CONFIG, {
  // Dial — absolute tilt mode
  DIAL_DEAD_ZONE_PCT: 0.10,   // fraction of MAX_TILT before scrolling starts (20%)
  DIAL_MAX_TILT: 45,         // degrees at which scroll speed maxes out
  DIAL_SCROLL_INTERVAL: 28,  // frames between scroll steps at gentle tilt
  DIAL_MIN_INTERVAL: 10,     // fastest scroll interval (frames) at full tilt
  DIAL_INDICATOR_RADIUS: 20,
  DIAL_SMOOTHING: 0.5,

  // Hands together
  HANDS_TOGETHER_DIST: 100,
  // Animation
  TELEPORT_EXPAND_SPEED: 0.15,
  TELEPORT_COLLAPSE_SPEED: 0.12,

  // Expanded box
  EXPANDED_W: 420,
  EXPANDED_H: 300,
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
});
