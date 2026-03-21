// Drag & drop mode — adds isPinching to shared Gestures
(function() {
  var G = Gestures;

  G.isPinching = function(landmarks, w, h, threshold, wasPinching) {
    if (threshold == null) {
      threshold = wasPinching ? CONFIG.PINCH_RELEASE_THRESHOLD : CONFIG.PINCH_THRESHOLD;
    }
    var t = G.lmPx(landmarks[G.THUMB_TIP], w, h);
    var i = G.lmPx(landmarks[G.INDEX_TIP], w, h);
    var dist = Math.hypot(t.x - i.x, t.y - i.y);
    var mid = { x: (t.x + i.x) >> 1, y: (t.y + i.y) >> 1 };
    return { isPinch: dist < threshold, mid: mid };
  };
})();
