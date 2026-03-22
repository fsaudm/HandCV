// Gesture detection for dial mode
(function() {
  var THUMB_TIP = 4, INDEX_TIP = 8;
  var WRIST = 0, INDEX_MCP = 5, MIDDLE_MCP = 9;

  function lmPx(lm, w, h) {
    return { x: Math.round((1.0 - lm.x) * w), y: Math.round(lm.y * h), z: lm.z };
  }

  function isOpenHand(landmarks, w, h) {
    var mcp = lmPx(landmarks[INDEX_MCP], w, h);
    var tips = [THUMB_TIP, INDEX_TIP, 12, 16, 20];
    for (var j = 0; j < tips.length; j++) {
      var tip = lmPx(landmarks[tips[j]], w, h);
      if (Math.hypot(tip.x - mcp.x, tip.y - mcp.y) < CONFIG.OPEN_HAND_MIN) return false;
    }
    return true;
  }

  function getHandAngle(landmarks, w, h) {
    var wrist = lmPx(landmarks[WRIST], w, h);
    var mmc = lmPx(landmarks[MIDDLE_MCP], w, h);
    return Math.atan2(mmc.y - wrist.y, mmc.x - wrist.x) * (180 / Math.PI);
  }

  function handCenter(landmarks, w, h) {
    var wrist = lmPx(landmarks[WRIST], w, h);
    var mmc = lmPx(landmarks[MIDDLE_MCP], w, h);
    return { x: (wrist.x + mmc.x) / 2, y: (wrist.y + mmc.y) / 2 };
  }

  function areHandsTogether(leftLm, rightLm, w, h) {
    var lc = handCenter(leftLm, w, h);
    var rc = handCenter(rightLm, w, h);
    return Math.hypot(lc.x - rc.x, lc.y - rc.y) < CONFIG.HANDS_TOGETHER_DIST;
  }

  window.Gestures = {
    lmPx: lmPx,
    isOpenHand: isOpenHand,
    getHandAngle: getHandAngle,
    handCenter: handCenter,
    areHandsTogether: areHandsTogether,
    THUMB_TIP: THUMB_TIP,
    INDEX_TIP: INDEX_TIP,
    WRIST: WRIST,
  };
})();
