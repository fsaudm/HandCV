// Gesture detection for pinch mode
(function() {
  var THUMB_TIP = 4, INDEX_TIP = 8;
  var WRIST = 0, INDEX_MCP = 5;

  function lmPx(lm, w, h) {
    return { x: Math.round((1.0 - lm.x) * w), y: Math.round(lm.y * h), z: lm.z };
  }

  function isFist(landmarks, w, h) {
    var mcp = lmPx(landmarks[INDEX_MCP], w, h);
    var tips = [THUMB_TIP, INDEX_TIP, 12, 16, 20];
    for (var j = 0; j < tips.length; j++) {
      var tip = lmPx(landmarks[tips[j]], w, h);
      if (Math.hypot(tip.x - mcp.x, tip.y - mcp.y) > CONFIG.FIST_CURL_MAX) return false;
    }
    return true;
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

  function isPinching(landmarks, w, h, threshold, wasPinching) {
    if (threshold == null) {
      threshold = wasPinching ? CONFIG.PINCH_RELEASE_THRESHOLD : CONFIG.PINCH_THRESHOLD;
    }
    var t = lmPx(landmarks[THUMB_TIP], w, h);
    var i = lmPx(landmarks[INDEX_TIP], w, h);
    var dist = Math.hypot(t.x - i.x, t.y - i.y);
    var mid = { x: (t.x + i.x) >> 1, y: (t.y + i.y) >> 1 };
    return { isPinch: dist < threshold, mid: mid };
  }

  window.Gestures = {
    lmPx: lmPx,
    isFist: isFist,
    isOpenHand: isOpenHand,
    isPinching: isPinching,
    THUMB_TIP: THUMB_TIP,
    INDEX_TIP: INDEX_TIP,
    WRIST: WRIST,
    INDEX_MCP: INDEX_MCP,
  };
})();
