// Shared gesture primitives — used by both web/ and web2/
(function() {
  var THUMB_TIP = 4, INDEX_TIP = 8, MIDDLE_TIP = 12, RING_TIP = 16, PINKY_TIP = 20;
  var WRIST = 0, INDEX_MCP = 5, MIDDLE_MCP = 9;

  function lmPx(lm, w, h) {
    // Mirror x to match the horizontally-flipped video display
    return { x: Math.round((1.0 - lm.x) * w), y: Math.round(lm.y * h), z: lm.z };
  }

  function isFist(landmarks, w, h) {
    var mcp = lmPx(landmarks[INDEX_MCP], w, h);
    var tips = [THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP];
    for (var j = 0; j < tips.length; j++) {
      var tip = lmPx(landmarks[tips[j]], w, h);
      if (Math.hypot(tip.x - mcp.x, tip.y - mcp.y) > CONFIG.FIST_CURL_MAX) return false;
    }
    return true;
  }

  function isOpenHand(landmarks, w, h) {
    var mcp = lmPx(landmarks[INDEX_MCP], w, h);
    var tips = [THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP];
    for (var j = 0; j < tips.length; j++) {
      var tip = lmPx(landmarks[tips[j]], w, h);
      if (Math.hypot(tip.x - mcp.x, tip.y - mcp.y) < CONFIG.OPEN_HAND_MIN) return false;
    }
    return true;
  }

  window.Gestures = {
    lmPx: lmPx,
    isFist: isFist,
    isOpenHand: isOpenHand,
    THUMB_TIP: THUMB_TIP,
    INDEX_TIP: INDEX_TIP,
    MIDDLE_TIP: MIDDLE_TIP,
    RING_TIP: RING_TIP,
    PINKY_TIP: PINKY_TIP,
    WRIST: WRIST,
    INDEX_MCP: INDEX_MCP,
    MIDDLE_MCP: MIDDLE_MCP,
  };
})();
