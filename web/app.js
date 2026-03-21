// Main loop — uses @mediapipe/tasks-vision HandLandmarker (sync API)
import { FilesetResolver, HandLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18";

(async function() {
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');

  try { await init(); } catch(err) {
    canvas.width = 800; canvas.height = 400;
    ctx.fillStyle = '#0F0F14'; ctx.fillRect(0, 0, 800, 400);
    ctx.font = '16px sans-serif'; ctx.fillStyle = '#FF6666';
    ctx.fillText('Error: ' + err.message, 40, 200);
    console.error(err);
    return;
  }

  async function init() {
  var C = CONFIG;
  var G = Gestures;

  // ── Resume data ──
  var sections;
  try {
    var resp = await fetch('resume.json');
    sections = await resp.json();
    if (sections.sections) sections = sections.sections;
  } catch(e) {
    sections = C.FALLBACK_SECTIONS;
  }

  // ── Webcam ──
  var video = document.getElementById('webcam');

  var stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
  video.srcObject = stream;
  await new Promise(function(r) { video.onloadedmetadata = r; });
  await video.play();

  var W = video.videoWidth, H = video.videoHeight;
  canvas.width = W; canvas.height = H;

  // ── MediaPipe HandLandmarker (new sync API) ──
  var visionWasm = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
  );
  var handLandmarker = await HandLandmarker.createFromOptions(visionWasm, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: 0.7,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  // ── Onboarding images ──
  var onboardOpen = new Image(); onboardOpen.src = 'img/hand_open.png';
  var onboardPinch = new Image(); onboardPinch.src = 'img/hand_pinching.png';

  // ── Helpers ──
  var drawHandSkeleton = AppHelpers.drawHandSkeleton;
  var drawArc = AppHelpers.drawArc;

  function snapToGrid(v) { return Math.round(v / C.GRID_SIZE) * C.GRID_SIZE; }

  var maxShelfSlots = Math.floor((W - 40) / (C.SHELF_SLOT_W + C.SHELF_GAP));

  function drawArrow(ctx, x1, y1, x2, y2, color, lineWidth) {
    var angle = Math.atan2(y2 - y1, x2 - x1);
    var headLen = 8;
    ctx.strokeStyle = color; ctx.lineWidth = lineWidth;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
    ctx.stroke();
  }

  // ── State ──
  var boxes = [];
  var shelfSlots = AppHelpers.buildShelf(sections, W, snapToGrid, maxShelfSlots);

  var draggingBox = null;
  var dragWrist = null;
  var prevPinchStates = {};
  var prevFrameTime = performance.now() / 1000;

  var leftFistCooldown = 0, leftFistHoldFrames = 0, leftFistWristPos = null;

  var onboardingShown = true;

  var prevFistStates = { left: false, right: false };
  var prevOpenStates = { left: false, right: false };
  var openHandCooldown = 0;

  var ghostSlots = [];
  var ghostHoldFrames = {};
  var ghostBirthFrame = {};
  var frameCount = 0;

  // ── Frame loop (sync — no callbacks) ──
  function onFrame() {
    requestAnimationFrame(onFrame);

    var results = handLandmarker.detectForVideo(video, performance.now());

    frameCount++;
    var now = performance.now() / 1000;

    // ── Draw webcam (mirrored) ──
    ctx.save();
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, W, H);
    ctx.restore();

    // Dark overlay
    ctx.fillStyle = rgba('#000000', 1.0 - C.CAM_OPACITY);
    ctx.fillRect(0, 0, W, H);

    // ── Shelf ──
    for (var s = 0; s < shelfSlots.length; s++) shelfSlots[s].draw(ctx);

    // ── 1. Gather hand data ──
    var handsData = [];
    var newPinchStates = {};

    if (results.landmarks) {
      for (var i = 0; i < results.landmarks.length; i++) {
        var lm = results.landmarks[i];
        if (C.SHOW_HAND_SKELETON) drawHandSkeleton(ctx, lm, W, H);

        var wasPinching = prevPinchStates[i] || false;
        var pr = G.isPinching(lm, W, H, null, wasPinching);
        newPinchStates[i] = pr.isPinch;

        var isLeft = false;
        if (results.handedness && results.handedness[i]) {
          isLeft = (results.handedness[i][0].categoryName === 'Left');
        }
        handsData.push({ isPinch: pr.isPinch, pinch: pr.mid, landmarks: lm, isLeft: isLeft });

        if (pr.isPinch) {
          ctx.beginPath();
          ctx.arc(pr.mid.x, pr.mid.y, C.PINCH_DOT_RADIUS, 0, 2 * Math.PI);
          ctx.fillStyle = C.GOLD_ACCENT;
          ctx.fill();
          if (onboardingShown) onboardingShown = false;
        }
      }
    }
    prevPinchStates = newPinchStates;

    // ── 2. Reset per-frame flags ──
    for (var b = 0; b < boxes.length; b++) boxes[b].highlighted = false;
    for (var s2 = 0; s2 < shelfSlots.length; s2++) shelfSlots[s2].highlighted = false;

    // ── 3. TWO-HAND TOGGLE CHECK (before drag/grab) ──
    var twoHandToggled = false;
    if (handsData.length >= 2) {
      var tightPinches = [];
      for (var ti = 0; ti < handsData.length; ti++) {
        if (handsData[ti].isPinch) tightPinches.push(handsData[ti].pinch);
      }
      if (tightPinches.length >= 2) {
        var tp1 = tightPinches[0], tp2 = tightPinches[1];

        // Check placed boxes
        for (var tbi = 0; tbi < boxes.length; tbi++) {
          var tbox = boxes[tbi];
          if (!tbox.alive() || tbox.discarding) continue;
          var near1 = tp1.x >= tbox.x - C.EXPAND_MARGIN && tp1.x <= tbox.x + tbox.w + C.EXPAND_MARGIN &&
                      tp1.y >= tbox.y - C.EXPAND_MARGIN && tp1.y <= tbox.y + tbox.h + C.EXPAND_MARGIN;
          var near2 = tp2.x >= tbox.x - C.EXPAND_MARGIN && tp2.x <= tbox.x + tbox.w + C.EXPAND_MARGIN &&
                      tp2.y >= tbox.y - C.EXPAND_MARGIN && tp2.y <= tbox.y + tbox.h + C.EXPAND_MARGIN;
          if (near1 && near2 && tbox.toggleCooldown === 0) {
            tbox.open = !tbox.open;
            tbox.toggleCooldown = C.TOGGLE_COOLDOWN_FRAMES;
            twoHandToggled = true;
            break;
          }
        }

        // Also check the currently dragged box
        if (!twoHandToggled && draggingBox && draggingBox.toggleCooldown === 0) {
          var db = draggingBox;
          var dn1 = tp1.x >= db.x - C.EXPAND_MARGIN && tp1.x <= db.x + db.w + C.EXPAND_MARGIN &&
                    tp1.y >= db.y - C.EXPAND_MARGIN && tp1.y <= db.y + db.h + C.EXPAND_MARGIN;
          var dn2 = tp2.x >= db.x - C.EXPAND_MARGIN && tp2.x <= db.x + db.w + C.EXPAND_MARGIN &&
                    tp2.y >= db.y - C.EXPAND_MARGIN && tp2.y <= db.y + db.h + C.EXPAND_MARGIN;
          if (dn1 && dn2) {
            if (boxes.indexOf(draggingBox) === -1) {
              draggingBox.x = snapToGrid(draggingBox.x);
              draggingBox.y = snapToGrid(draggingBox.y);
              boxes.push(draggingBox);
            }
            draggingBox.open = !draggingBox.open;
            draggingBox.toggleCooldown = C.TOGGLE_COOLDOWN_FRAMES;
            draggingBox = null; dragWrist = null;
            twoHandToggled = true;
          }
        }
      }
    }

    // ── 3b. HAND-OPEN EXPAND (fist→open near closed box) ──
    if (openHandCooldown > 0) openHandCooldown--;
    var curFistByHand = { left: false, right: false };
    var curOpenByHand = { left: false, right: false };
    // Always track hand state, even during two-hand toggles
    for (var ohi = 0; ohi < handsData.length; ohi++) {
      var ohLm = handsData[ohi].landmarks;
      var ohKey = handsData[ohi].isLeft ? 'left' : 'right';
      curFistByHand[ohKey] = G.isFist(ohLm, W, H);
      curOpenByHand[ohKey] = G.isOpenHand(ohLm, W, H);
    }
    if (!twoHandToggled) {
      for (var ohi2 = 0; ohi2 < handsData.length; ohi2++) {
        var ohLm2 = handsData[ohi2].landmarks;
        var ohKey2 = handsData[ohi2].isLeft ? 'left' : 'right';
        // fist→open transition = expand closed box
        if (curOpenByHand[ohKey2] && prevFistStates[ohKey2] && openHandCooldown === 0) {
          var palmPos = G.lmPx(ohLm2[G.INDEX_MCP], W, H);
          for (var obi = 0; obi < boxes.length; obi++) {
            var ob = boxes[obi];
            if (!ob.alive() || ob.discarding || ob.open) continue;
            if (palmPos.x >= ob.x - C.EXPAND_MARGIN && palmPos.x <= ob.x + ob.w + C.EXPAND_MARGIN &&
                palmPos.y >= ob.y - C.EXPAND_MARGIN && palmPos.y <= ob.y + ob.h + C.EXPAND_MARGIN &&
                ob.toggleCooldown === 0) {
              ob.open = true;
              ob.toggleCooldown = C.TOGGLE_COOLDOWN_FRAMES;
              openHandCooldown = C.OPEN_HAND_COOLDOWN_FRAMES;
              break;
            }
          }
        }
      }
    }
    prevFistStates = curFistByHand;
    prevOpenStates = curOpenByHand;

    // ── 4. DRAG LOGIC (skip if two-hand toggle fired) ──
    if (!twoHandToggled && draggingBox !== null) {
      var bestHand = null, bestWristDist = Infinity;
      for (var di = 0; di < handsData.length; di++) {
        var dlm = handsData[di].landmarks;
        var dw = G.lmPx(dlm[G.WRIST], W, H);
        var wristDist = dragWrist ? Math.hypot(dw.x - dragWrist.x, dw.y - dragWrist.y) : 0;
        var dp = G.isPinching(dlm, W, H, C.PINCH_DRAG_RELEASE, true);
        if (dp.isPinch && wristDist < bestWristDist) {
          bestWristDist = wristDist;
          bestHand = { mid: dp.mid, wrist: dw };
        }
      }

      if (bestHand) {
        dragWrist = bestHand.wrist;
        draggingBox.x = bestHand.mid.x + draggingBox.dragOffset[0];
        draggingBox.y = bestHand.mid.y + draggingBox.dragOffset[1];
      } else {
        draggingBox.x = snapToGrid(draggingBox.x);
        draggingBox.y = snapToGrid(draggingBox.y);
        if (boxes.indexOf(draggingBox) === -1) boxes.push(draggingBox);
        draggingBox = null; dragWrist = null;
      }
    }

    // ── 5. HOVER + GRAB (skip if dragging or two-hand toggle) ──
    if (!twoHandToggled && draggingBox === null) {
      // Hover highlight
      var globalBestDist = Infinity, globalBestTarget = null;
      var highlightHandIdx = -1, highlightFingerPos = null;

      for (var hi = 0; hi < handsData.length; hi++) {
        var hd = handsData[hi];
        var it = G.lmPx(hd.landmarks[G.INDEX_TIP], W, H);
        var tt = G.lmPx(hd.landmarks[G.THUMB_TIP], W, H);

        for (var bi = 0; bi < boxes.length; bi++) {
          var box = boxes[bi];
          if (!box.alive() || box.discarding) continue;
          var bcx = box.x + box.w / 2, bcy = box.y + box.h / 2;
          if (box.contains(it.x, it.y)) {
            var d = Math.hypot(it.x - bcx, it.y - bcy);
            if (d < globalBestDist) { globalBestDist = d; globalBestTarget = box; highlightHandIdx = hi; highlightFingerPos = it; }
          }
          if (box.contains(tt.x, tt.y)) {
            var d2 = Math.hypot(tt.x - bcx, tt.y - bcy);
            if (d2 < globalBestDist) { globalBestDist = d2; globalBestTarget = box; highlightHandIdx = hi; highlightFingerPos = tt; }
          }
        }

        for (var si = 0; si < shelfSlots.length; si++) {
          var slot = shelfSlots[si];
          var margin = C.EXPAND_MARGIN;
          var scx = slot.x + slot.w / 2, scy = slot.y + slot.h / 2;
          var inIdx = it.x >= slot.x - margin && it.x <= slot.x + slot.w + margin &&
                      it.y >= slot.y - margin && it.y <= slot.y + slot.h + margin;
          var inThb = tt.x >= slot.x - margin && tt.x <= slot.x + slot.w + margin &&
                      tt.y >= slot.y - margin && tt.y <= slot.y + slot.h + margin;
          if (inIdx) {
            var dIdx = Math.hypot(it.x - scx, it.y - scy);
            if (dIdx < globalBestDist) { globalBestDist = dIdx; globalBestTarget = slot; highlightHandIdx = hi; highlightFingerPos = it; }
          }
          if (inThb) {
            var dThb = Math.hypot(tt.x - scx, tt.y - scy);
            if (dThb < globalBestDist) { globalBestDist = dThb; globalBestTarget = slot; highlightHandIdx = hi; highlightFingerPos = tt; }
          }
        }
      }

      if (globalBestTarget) {
        globalBestTarget.highlighted = true;
        if (highlightFingerPos) {
          ctx.beginPath();
          ctx.arc(highlightFingerPos.x, highlightFingerPos.y, C.PINCH_DOT_RADIUS, 0, 2 * Math.PI);
          ctx.fillStyle = C.GOLD_ACCENT; ctx.fill();
        }
      }

      // Grab logic
      for (var gi = 0; gi < handsData.length; gi++) {
        var ghd = handsData[gi];
        if (!ghd.isPinch || gi !== highlightHandIdx) continue;
        var gpx = ghd.pinch.x, gpy = ghd.pinch.y;
        var grabbed = false;

        for (var gbi = boxes.length - 1; gbi >= 0; gbi--) {
          var gbox = boxes[gbi];
          if (gbox.highlighted && gbox.alive() && !gbox.discarding) {
            gbox.dragOffset = [gbox.x - gpx, gbox.y - gpy];
            draggingBox = gbox;
            var gw = G.lmPx(ghd.landmarks[G.WRIST], W, H);
            dragWrist = gw;
            boxes.splice(gbi, 1); boxes.push(gbox);
            grabbed = true; break;
          }
        }
        if (grabbed) break;

        for (var gsi = 0; gsi < shelfSlots.length; gsi++) {
          var gslot = shelfSlots[gsi];
          if (gslot.highlighted && boxes.length < C.MAX_BOXES) {
            var secIdx = gslot.sectionIdx;
            var sec = sections[secIdx];
            var newBox = new Box(
              gpx - C.DEFAULT_BOX_W / 2, gpy - C.DEFAULT_BOX_H / 2,
              C.DEFAULT_BOX_W, C.DEFAULT_BOX_H, C.BOX_COLOR, sec.title, sec.body, secIdx
            );
            newBox.dragOffset = [-C.DEFAULT_BOX_W / 2, -C.DEFAULT_BOX_H / 2];
            draggingBox = newBox;
            var gsw = G.lmPx(ghd.landmarks[G.WRIST], W, H);
            dragWrist = gsw;
            ghostSlots.push({ secIdx: secIdx, x: gslot.x + gslot.w / 2, y: gslot.y + gslot.h / 2 });
            ghostBirthFrame[secIdx] = frameCount;
            shelfSlots.splice(gsi, 1);
            grabbed = true; break;
          }
        }
        if (grabbed) break;
      }
    }

    // ── 6. LEFT FIST = RESET ──
    var leftFistDetected = false;
    if (leftFistCooldown > 0) { leftFistCooldown--; }
    else {
      for (var fi = 0; fi < handsData.length; fi++) {
        if (handsData[fi].isLeft && G.isFist(handsData[fi].landmarks, W, H)) {
          leftFistDetected = true;
          var lfw = G.lmPx(handsData[fi].landmarks[G.INDEX_MCP], W, H);
          leftFistWristPos = lfw;
          break;
        }
      }
    }
    if (leftFistDetected) {
      leftFistHoldFrames++;
      if (leftFistHoldFrames >= C.LEFT_FIST_RING_FRAMES) {
        boxes = []; draggingBox = null; dragWrist = null;
        shelfSlots = AppHelpers.buildShelf(sections, W, snapToGrid, maxShelfSlots);
        ghostSlots = []; ghostHoldFrames = {}; ghostBirthFrame = {};
        leftFistCooldown = C.FIST_COOLDOWN_FRAMES;
        leftFistHoldFrames = 0; leftFistWristPos = null;
      }
    } else { leftFistHoldFrames = 0; leftFistWristPos = null; }

    // ── 7. RIGHT HAND: open→fist = COLLAPSE nearest open box (instant) ──
    for (var rfi = 0; rfi < handsData.length; rfi++) {
      if (handsData[rfi].isLeft) continue;
      var rfLm = handsData[rfi].landmarks;
      var rfKey = 'right';
      var rfNowFist = G.isFist(rfLm, W, H);
      // Transition: was open last frame, now fist
      if (rfNowFist && prevOpenStates[rfKey] && openHandCooldown === 0) {
        var rfPos = G.lmPx(rfLm[G.INDEX_MCP], W, H);
        var rfBest = null, rfBestDist = Infinity;
        for (var rbi = 0; rbi < boxes.length; rbi++) {
          var rb = boxes[rbi];
          if (!rb.alive() || rb.discarding || !rb.open) continue;
          var rbcx = rb.x + rb.w / 2, rbcy = rb.y + rb.h / 2;
          var rbd = Math.hypot(rfPos.x - rbcx, rfPos.y - rbcy);
          if (rbd < rfBestDist && rbd < Math.max(rb.w, rb.h) / 2 + C.EXPAND_MARGIN) {
            rfBestDist = rbd; rfBest = rb;
          }
        }
        if (rfBest) {
          rfBest.open = false;
          rfBest.toggleCooldown = C.TOGGLE_COOLDOWN_FRAMES;
          openHandCooldown = C.OPEN_HAND_COOLDOWN_FRAMES;
        }
      }
    }

    // ── 8. GHOST DOTS — hold to restore ──
    var ghostFingerHit = -1;
    for (var ghi = 0; ghi < ghostSlots.length; ghi++) {
      var gs = ghostSlots[ghi];
      for (var ghj = 0; ghj < handsData.length; ghj++) {
        var git = G.lmPx(handsData[ghj].landmarks[G.INDEX_TIP], W, H);
        if (Math.hypot(git.x - gs.x, git.y - gs.y) < C.GHOST_HIT_RADIUS) { ghostFingerHit = gs.secIdx; break; }
      }
      if (ghostFingerHit >= 0) break;
    }
    var activeGhostIds = {};
    if (ghostFingerHit >= 0) {
      activeGhostIds[ghostFingerHit] = true;
      ghostHoldFrames[ghostFingerHit] = (ghostHoldFrames[ghostFingerHit] || 0) + 1;
      if (ghostHoldFrames[ghostFingerHit] >= C.FIST_RING_FRAMES) {
        var ghSec = sections[ghostFingerHit];
        var ghInsPos = 0;
        for (var ghsi = 0; ghsi < shelfSlots.length; ghsi++) {
          if (shelfSlots[ghsi].sectionIdx < ghostFingerHit) ghInsPos = ghsi + 1;
        }
        shelfSlots.splice(ghInsPos, 0, new ShelfSlot(0, 0, C.SHELF_SLOT_W, C.SHELF_SLOT_H, C.SHELF_CORNER_COLOR, ghSec.title, ghostFingerHit));
        AppHelpers.repositionShelf(shelfSlots, W, snapToGrid);
        boxes = boxes.filter(function(b) { return b.sectionIdx !== ghostFingerHit; });
        ghostSlots = ghostSlots.filter(function(g) { return g.secIdx !== ghostFingerHit; });
        delete ghostHoldFrames[ghostFingerHit]; delete ghostBirthFrame[ghostFingerHit];
      }
    }
    for (var gk in ghostHoldFrames) {
      if (!activeGhostIds[gk]) delete ghostHoldFrames[gk];
    }

    // ── 9. ANIMATE & DRAW ──
    for (var ai = 0; ai < boxes.length; ai++) boxes[ai].tick();
    boxes = boxes.filter(function(b) { return b.alive(); });

    if (draggingBox && boxes.indexOf(draggingBox) === -1) draggingBox.draw(ctx);
    for (var dbi = 0; dbi < boxes.length; dbi++) boxes[dbi].draw(ctx);

    // Ghost dots
    for (var gdi = 0; gdi < ghostSlots.length; gdi++) {
      var gd = ghostSlots[gdi];
      var beingHeld = ghostHoldFrames[gd.secIdx] != null;
      ctx.beginPath();
      ctx.arc(gd.x, gd.y, C.GHOST_DOT_RADIUS, 0, 2 * Math.PI);
      ctx.strokeStyle = beingHeld ? C.GOLD_ACCENT : grayRgb(50);
      ctx.lineWidth = 1;
      ctx.stroke();
      if (beingHeld) {
        drawArc(ctx, gd.x, gd.y, C.GHOST_RING_RADIUS, ghostHoldFrames[gd.secIdx] / C.FIST_RING_FRAMES, C.GOLD_ACCENT, 1);
      }
    }

    // Fist rings
    if (leftFistWristPos && leftFistHoldFrames > 0) {
      drawArc(ctx, leftFistWristPos.x, leftFistWristPos.y, C.FIST_RING_RADIUS,
              leftFistHoldFrames / C.LEFT_FIST_RING_FRAMES, C.GOLD_ACCENT, 2);
    }

    // ── ONBOARDING ──
    if (onboardingShown) {
      ctx.fillStyle = rgba('#0F0F14', C.ONBOARDING_OPACITY);
      ctx.fillRect(0, 0, W, H);

      var cxH = W / 2, cyH = H / 2, imgH = C.ONBOARDING_IMG_HEIGHT;

      if (onboardOpen.complete && onboardOpen.naturalWidth > 0) {
        var oScale = imgH / onboardOpen.naturalHeight;
        var oW = Math.round(onboardOpen.naturalWidth * oScale);
        ctx.globalAlpha = 0.5;
        ctx.filter = 'invert(1)';
        ctx.drawImage(onboardOpen, cxH - oW - 30, cyH - imgH / 2, oW, imgH);
        ctx.filter = 'none';
        ctx.globalAlpha = 1.0;
      }

      drawArrow(ctx, cxH - 20, cyH, cxH + 20, cyH, grayRgb(140), 2);

      if (onboardPinch.complete && onboardPinch.naturalWidth > 0) {
        var pScale = imgH / onboardPinch.naturalHeight;
        var pW = Math.round(onboardPinch.naturalWidth * pScale);
        var pOX = cxH + 30, pOY = cyH - imgH / 2;
        ctx.globalAlpha = 0.5;
        ctx.filter = 'invert(1)';
        ctx.drawImage(onboardPinch, pOX, pOY, pW, imgH);
        ctx.filter = 'none';
        ctx.globalAlpha = 1.0;
        ctx.beginPath();
        ctx.arc(pOX + pW * 0.72, pOY + imgH * 0.38, C.PINCH_DOT_RADIUS + 1, 0, 2 * Math.PI);
        ctx.fillStyle = C.GOLD_ACCENT; ctx.fill();
      }

      ctx.font = '16px sans-serif';
      ctx.fillStyle = grayRgb(160);
      ctx.textAlign = 'center';
      ctx.fillText('pinch to interact', cxH, cyH + imgH / 2 + 30);
      ctx.textAlign = 'left';
    }

    // ── FPS ──
    var fps = 1.0 / (now - prevFrameTime);
    prevFrameTime = now;
    ctx.font = '12px sans-serif';
    ctx.fillStyle = grayRgb(60);
    ctx.fillText('FPS ' + Math.round(fps), W - 70, H - 12);

    // ── Legend ──
    var legendY = H - C.LEGEND_H - C.LEGEND_MARGIN;
    var lx = 10, ly = legendY, lw = C.LEGEND_W, lh = C.LEGEND_H;
    drawCornerMarks(ctx, lx, ly, lw, lh, grayRgb(40), 6, 1);
    ctx.font = C.LEGEND_FONT_PX + 'px sans-serif';
    ctx.fillStyle = grayRgb(55);
    ctx.fillText('pinch  grab/drag', lx + 8, ly + 16);
    ctx.fillText('2-hand  open/close', lx + 8, ly + 30);
    ctx.fillText('L fist  reset all', lx + 8, ly + 44);
    ctx.fillText('open→fist  collapse', lx + 8, ly + 58);
  }

  requestAnimationFrame(onFrame);
  } // end init
})();
