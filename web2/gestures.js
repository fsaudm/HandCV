// Dial + teleport mode — adds dial/teleport gestures to shared Gestures
(function() {
  var G = Gestures;

  G.getHandAngle = function(landmarks, w, h) {
    var wrist = G.lmPx(landmarks[G.WRIST], w, h);
    var mmc = G.lmPx(landmarks[G.MIDDLE_MCP], w, h);
    return Math.atan2(mmc.y - wrist.y, mmc.x - wrist.x) * (180 / Math.PI);
  };

  G.handCenter = function(landmarks, w, h) {
    var wrist = G.lmPx(landmarks[G.WRIST], w, h);
    var mmc = G.lmPx(landmarks[G.MIDDLE_MCP], w, h);
    return { x: (wrist.x + mmc.x) / 2, y: (wrist.y + mmc.y) / 2 };
  };

  G.areHandsTogether = function(leftLm, rightLm, w, h) {
    var lc = G.handCenter(leftLm, w, h);
    var rc = G.handCenter(rightLm, w, h);
    return Math.hypot(lc.x - rc.x, lc.y - rc.y) < CONFIG.HANDS_TOGETHER_DIST;
  };
})();
