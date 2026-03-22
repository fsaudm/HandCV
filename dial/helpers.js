// Drawing helpers for dial mode
(function() {
  var G = Gestures;
  var C = CONFIG;

  var BONE_CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [5,9],[9,10],[10,11],[11,12],
    [9,13],[13,14],[14,15],[15,16],
    [13,17],[17,18],[18,19],[19,20],[0,17]
  ];

  function drawHandSkeleton(ctx, landmarks, w, h) {
    ctx.beginPath();
    for (var b = 0; b < BONE_CONNECTIONS.length; b++) {
      var a0 = BONE_CONNECTIONS[b][0], a1 = BONE_CONNECTIONS[b][1];
      var p0 = G.lmPx(landmarks[a0], w, h);
      var p1 = G.lmPx(landmarks[a1], w, h);
      ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
    }
    ctx.strokeStyle = C.HAND_BONE_COLOR;
    ctx.lineWidth = C.HAND_BONE_THICKNESS;
    ctx.stroke();

    ctx.beginPath();
    for (var j = 0; j < landmarks.length; j++) {
      var p = G.lmPx(landmarks[j], w, h);
      ctx.moveTo(p.x + C.HAND_NODE_RADIUS, p.y);
      ctx.arc(p.x, p.y, C.HAND_NODE_RADIUS, 0, 2 * Math.PI);
    }
    ctx.fillStyle = C.HAND_NODE_COLOR;
    ctx.fill();
  }

  function drawArc(ctx, cx, cy, r, progress, color, lineWidth, ccw) {
    ctx.beginPath();
    if (ccw) {
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 - 2 * Math.PI * progress, true);
    } else {
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * progress, false);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  function buildShelf(secs, fw) {
    var num = secs.length;
    var totalW = num * (C.SHELF_SLOT_W + C.SHELF_GAP) - C.SHELF_GAP;
    var startX = Math.round(fw - totalW - 20);
    var shelfY = 32;
    var slots = [];
    for (var i = 0; i < num; i++) {
      slots.push(new ShelfSlot(
        Math.round(startX + i * (C.SHELF_SLOT_W + C.SHELF_GAP)), shelfY,
        C.SHELF_SLOT_W, C.SHELF_SLOT_H, C.SHELF_CORNER_COLOR, secs[i].title
      ));
    }
    return slots;
  }

  window.AppHelpers = {
    drawHandSkeleton: drawHandSkeleton,
    drawArc: drawArc,
    buildShelf: buildShelf,
  };
})();
