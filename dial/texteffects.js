// Pluggable text effects for box content reveal/hide.
// Each effect implements: { transform(str, tick, total, revealing), alpha(tick, total, revealing) }
// Set CONFIG.TEXT_EFFECT to the name of the effect, or 'none' to disable.
(function() {
  var DIFF_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#%&*+-=?';

  function randomChar() {
    return DIFF_CHARS[Math.floor(Math.random() * DIFF_CHARS.length)];
  }

  var effects = {
    diffusion: {
      transform: function(str, tick, total, revealing) {
        var progress = Math.min(tick / total, 1);
        var resolved = Math.floor(progress * str.length);
        var out = '';
        for (var i = 0; i < str.length; i++) {
          if (str[i] === ' ' || str[i] === '\n') { out += str[i]; continue; }
          if (revealing) {
            out += i < resolved ? str[i] : randomChar();
          } else {
            out += i < resolved ? randomChar() : str[i];
          }
        }
        return out;
      },
      alpha: function(tick, total, revealing) {
        var progress = Math.min(tick / total, 1);
        return revealing ? Math.min(1, progress * 1.5) : Math.max(0, 1 - progress * 1.2);
      }
    },
    none: {
      transform: function(str) { return str; },
      alpha: function(tick, total, revealing) { return revealing ? 1 : 0; }
    }
  };

  window.TextEffects = {
    get: function(name) {
      return effects[name] || effects.none;
    }
  };
})();
