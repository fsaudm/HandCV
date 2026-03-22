// Dial + teleport mode overrides
Object.assign(CONFIG, {
  // Dial — absolute tilt mode
  DIAL_DEAD_ZONE: 12,        // degrees from vertical before scrolling starts
  DIAL_MAX_TILT: 45,         // degrees at which scroll speed maxes out
  DIAL_SCROLL_INTERVAL: 18,  // frames between scroll steps at max tilt
  DIAL_MIN_INTERVAL: 6,      // fastest scroll interval (frames) at full tilt
  DIAL_INDICATOR_RADIUS: 40,
  DIAL_SMOOTHING: 0.5,

  // Hands together
  HANDS_TOGETHER_DIST: 100,
  // Animation
  TELEPORT_EXPAND_SPEED: 0.05,
  TELEPORT_COLLAPSE_SPEED: 0.07,

  // Expanded box
  EXPANDED_W: 420,
  EXPANDED_H: 300,
  EXPANDED_Y_OFFSET: 40,

  // Cooldowns
  EXPAND_COOLDOWN: 30,
  COLLAPSE_COOLDOWN: 30,

  // Selected glow
  SELECTED_GLOW_ALPHA: 0.15,
});
