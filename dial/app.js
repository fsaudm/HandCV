// Main loop — Dial Mode
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
  var drawHandSkeleton = AppHelpers.drawHandSkeleton;
  var drawArc = AppHelpers.drawArc;

  // ── Resume data (loaded from resume/*.md) ──
  var sections;
  try {
    var manifest = await fetch('../resume/index.json').then(function(r) { return r.json(); });
    sections = [];
    for (var mi = 0; mi < manifest.length; mi++) {
      var mdText = await fetch('../resume/' + manifest[mi]).then(function(r) { return r.text(); });
      var parts = mdText.split('---');
      var fm = {};
      parts[1].trim().split('\n').forEach(function(line) {
        var kv = line.split(':');
        if (kv.length >= 2) fm[kv[0].trim()] = kv.slice(1).join(':').trim();
      });
      sections.push({ title: fm.title, body: parts.slice(2).join('---').trim() });
    }
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

  // ── MediaPipe HandLandmarker ──
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

  // ── Helpers ──
  function angleDiff(a, b) {
    var d = a - b;
    return ((d % 360) + 540) % 360 - 180;
  }

  // ── State ──
  var shelfSlots = AppHelpers.buildShelf(sections, W);
  var state = 'BROWSING'; // BROWSING | EXPANDING | DIFFUSING_IN | EXPANDED | DIFFUSING_OUT | COLLAPSING
  var selectedIndex = 0;
  var expandedBox = null;

  // Dial tracking — relative tilt (recalibrates on fist release)
  var smoothedAngle = null;
  var baseAngle = null;
  var dialFrameAccum = 0;
  var dialStepCount = 0;
  var dialLastDir = 0;        // 1 = right, -1 = left, 0 = neutral
  var dialWasPaused = false;

  function resetDial() {
    smoothedAngle = null; baseAngle = null;
    dialFrameAccum = 0; dialStepCount = 0;
    dialLastDir = 0; dialWasPaused = false;
  }

  // Expand/collapse cooldowns
  var expandCooldown = 0;
  var collapseCooldown = 0;

  // Link hover
  var linkHoldFrames = 0;
  var hoveredLinkUrl = null;

  var onboardingShown = true;
  var prevFrameTime = performance.now() / 1000;

  // ── Frame loop ──
  function onFrame() {
    requestAnimationFrame(onFrame);

    var results = handLandmarker.detectForVideo(video, performance.now());
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

    // ── Identify hands ──
    var leftHand = null, rightHand = null;
    if (results.landmarks) {
      for (var i = 0; i < results.landmarks.length; i++) {
        var lm = results.landmarks[i];
        if (C.SHOW_HAND_SKELETON) drawHandSkeleton(ctx, lm, W, H);

        var isLeft = false;
        if (results.handedness && results.handedness[i]) {
          isLeft = (results.handedness[i][0].categoryName === 'Left');
        }
        if (isLeft) leftHand = lm;
        else rightHand = lm;
      }
    }

    // ── Hand labels + thumb-index line ──
    if (leftHand) {
      var lWrist = G.lmPx(leftHand[G.WRIST], W, H);
      ctx.font = C.TITLE_FONT_PX + 'px sans-serif';
      ctx.fillStyle = rgba(C.GOLD_ACCENT, 0.55);
      ctx.textAlign = 'center';
      ctx.fillText('dial', lWrist.x, lWrist.y + 40);
      ctx.textAlign = 'left';

      // Thin line between thumb tip and index tip
      var thumb = G.lmPx(leftHand[G.THUMB_TIP], W, H);
      var index = G.lmPx(leftHand[G.INDEX_TIP], W, H);
      ctx.beginPath();
      ctx.moveTo(thumb.x, thumb.y);
      ctx.lineTo(index.x, index.y);
      ctx.strokeStyle = rgba(C.GOLD_ACCENT, 0.3);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (rightHand) {
      var rWrist = G.lmPx(rightHand[G.WRIST], W, H);
      var rOpen = G.isOpenHand(rightHand, W, H);
      // Wrist ring: gold when open, dim when fist
      ctx.beginPath();
      ctx.arc(rWrist.x, rWrist.y, C.DIAL_INDICATOR_RADIUS, 0, 2 * Math.PI);
      ctx.strokeStyle = rOpen ? rgba(C.GOLD_ACCENT, 0.4) : grayRgb(40);
      ctx.lineWidth = 1;
      ctx.stroke();
      // Label
      ctx.font = C.TITLE_FONT_PX + 'px sans-serif';
      ctx.fillStyle = rOpen ? rgba(C.GOLD_ACCENT, 0.55) : grayRgb(50);
      ctx.textAlign = 'center';
      ctx.fillText('teleport', rWrist.x, rWrist.y + 40);
      ctx.textAlign = 'left';
    }

    // ── Dismiss onboarding on first gesture ──
    if (onboardingShown && (leftHand || rightHand)) {
      onboardingShown = false;
    }

    // ── Cooldown ticks ──
    if (expandCooldown > 0) expandCooldown--;
    if (collapseCooldown > 0) collapseCooldown--;

    // ── State machine ──
    if (state === 'BROWSING') {
      // LEFT HAND DIAL — relative tilt (recalibrates on fist release)
      var deadZone = C.DIAL_DEAD_ZONE_PCT * C.DIAL_MAX_TILT;
      if (leftHand && G.isOpenHand(leftHand, W, H)) {
        var rawAngle = G.getHandAngle(leftHand, W, H);

        // Recalibrate if just released fist or first appearance
        if (smoothedAngle === null || dialWasPaused) {
          smoothedAngle = rawAngle;
          baseAngle = rawAngle;
        } else {
          var diff = angleDiff(rawAngle, smoothedAngle);
          smoothedAngle = smoothedAngle + C.DIAL_SMOOTHING * diff;
        }
        dialWasPaused = false;

        var tilt = angleDiff(smoothedAngle, baseAngle);

        if (Math.abs(tilt) > deadZone) {
          var dir = tilt > 0 ? 1 : -1;
          // Reset step count on direction change
          if (dir !== dialLastDir) {
            dialStepCount = 0;
            dialFrameAccum = 0;
            dialLastDir = dir;
          }
          var excess = Math.abs(tilt) - deadZone;
          var range = C.DIAL_MAX_TILT - deadZone;
          var t = Math.min(excess / range, 1);
          var interval;
          if (dialStepCount === 0) {
            interval = 0;
          } else if (dialStepCount === 1) {
            interval = C.DIAL_FIRST_DELAY;
          } else {
            interval = Math.round(C.DIAL_SCROLL_INTERVAL - (C.DIAL_SCROLL_INTERVAL - C.DIAL_MIN_INTERVAL) * t);
          }
          dialFrameAccum++;
          if (dialFrameAccum >= interval) {
            if (tilt > 0) {
              selectedIndex = (selectedIndex + 1) % shelfSlots.length;
            } else {
              selectedIndex = (selectedIndex - 1 + shelfSlots.length) % shelfSlots.length;
            }
            dialFrameAccum = 0;
            dialStepCount++;
          }
        } else {
          dialFrameAccum = 0;
          dialStepCount = 0;
        }

        // Draw tilt indicator - fills in the direction of tilt
        var wristPos = G.lmPx(leftHand[G.WRIST], W, H);
        var progress = Math.min(Math.abs(tilt) / C.DIAL_MAX_TILT, 1);
        var indicatorColor = Math.abs(tilt) > deadZone ? C.GOLD_ACCENT : grayRgb(80);
        drawArc(ctx, wristPos.x, wristPos.y, C.DIAL_INDICATOR_RADIUS, progress,
                indicatorColor, 1, tilt < 0);
      } else if (leftHand) {
        // Fist detected - paused, show dim ring
        dialFrameAccum = 0; dialStepCount = 0;
        dialWasPaused = true;
        var wristPos = G.lmPx(leftHand[G.WRIST], W, H);
        ctx.beginPath();
        ctx.arc(wristPos.x, wristPos.y, C.DIAL_INDICATOR_RADIUS, 0, 2 * Math.PI);
        ctx.strokeStyle = grayRgb(40);
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        resetDial();
      }

      // RIGHT HAND: open hand = expand selected box
      if (rightHand && expandCooldown === 0) {
        if (G.isOpenHand(rightHand, W, H)) {
          var sec = sections[selectedIndex];
          var slot = shelfSlots[selectedIndex];
          expandedBox = new Box(
            slot.x, slot.y, slot.w, slot.h,
            C.GOLD_ACCENT, sec.title, sec.body, selectedIndex
          );
          expandedBox.expanding = true;
          var targetX = Math.round(W / 2 - C.EXPANDED_W / 2);
          var targetY = Math.round(H / 2 - C.EXPANDED_H / 2 + C.EXPANDED_Y_OFFSET);
          expandedBox.animateTo(targetX, targetY, C.EXPANDED_W, C.EXPANDED_H);
          state = 'EXPANDING';
          expandCooldown = C.EXPAND_COOLDOWN;
        }
      }

    } else if (state === 'EXPANDING') {
      expandedBox.tick();
      if (!expandedBox.animating) {
        expandedBox.startDiffusion(true);
        state = 'DIFFUSING_IN';
      }

    } else if (state === 'DIFFUSING_IN') {
      expandedBox.tick();
      if (expandedBox.diffPhase === 'revealed') {
        state = 'EXPANDED';
      }

    } else if (state === 'EXPANDED') {
      var shouldCollapse = collapseCooldown === 0 && (
        (rightHand && !G.isOpenHand(rightHand, W, H)) ||
        (leftHand && rightHand && G.areHandsTogether(leftHand, rightHand, W, H))
      );
      if (shouldCollapse) {
        expandedBox.startDiffusion(false);
        state = 'DIFFUSING_OUT';
        collapseCooldown = C.COLLAPSE_COOLDOWN;
        expandCooldown = C.EXPAND_COOLDOWN;
      }

      // Draw distance indicator between hands when both visible
      if (leftHand && rightHand) {
        var lc = G.handCenter(leftHand, W, H);
        var rc = G.handCenter(rightHand, W, H);
        var dist = Math.hypot(lc.x - rc.x, lc.y - rc.y);
        var alpha = Math.max(0, Math.min(0.4, 1 - dist / (C.HANDS_TOGETHER_DIST * 2)));
        if (alpha > 0) {
          ctx.beginPath();
          ctx.moveTo(lc.x, lc.y); ctx.lineTo(rc.x, rc.y);
          ctx.strokeStyle = rgba(C.GOLD_ACCENT, alpha);
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Link hover with index fingertip
      var linkHit = false;
      if (rightHand && expandedBox && expandedBox.linkHitboxes.length) {
        var idx = G.lmPx(rightHand[G.INDEX_TIP], W, H);
        for (var li = 0; li < expandedBox.linkHitboxes.length; li++) {
          var lk = expandedBox.linkHitboxes[li];
          if (idx.x >= lk.x && idx.x <= lk.x + lk.w && idx.y >= lk.y && idx.y <= lk.y + lk.h) {
            linkHit = true;
            if (hoveredLinkUrl === lk.url) {
              linkHoldFrames++;
            } else {
              hoveredLinkUrl = lk.url;
              linkHoldFrames = 1;
            }
            // Draw gold dot at fingertip
            ctx.beginPath();
            ctx.arc(idx.x, idx.y, 4, 0, 2 * Math.PI);
            ctx.fillStyle = C.GOLD_ACCENT;
            ctx.fill();
            // Draw progress ring
            drawArc(ctx, idx.x, idx.y, C.LINK_HOVER_RING_RADIUS,
                    linkHoldFrames / C.LINK_HOLD_FRAMES, C.GOLD_ACCENT, 2);
            // Open link when ring completes
            if (linkHoldFrames >= C.LINK_HOLD_FRAMES) {
              var win = window.open(hoveredLinkUrl, '_blank');
              if (win) win.focus();
              linkHoldFrames = 0;
              hoveredLinkUrl = null;
            }
            break;
          }
        }
      }
      if (!linkHit) {
        linkHoldFrames = 0;
        hoveredLinkUrl = null;
      }

    } else if (state === 'DIFFUSING_OUT') {
      expandedBox.tick();
      if (expandedBox.diffPhase === 'faded') {
        var slot = shelfSlots[selectedIndex];
        expandedBox.expanding = false;
        expandedBox.animateTo(slot.x, slot.y, slot.w, slot.h);
        state = 'COLLAPSING';
      }

    } else if (state === 'COLLAPSING') {
      expandedBox.tick();
      if (!expandedBox.animating) {
        expandedBox = null;
        state = 'BROWSING';
        resetDial();
      }
    }

    // ── Update shelf selection ──
    for (var si = 0; si < shelfSlots.length; si++) {
      shelfSlots[si].selected = (si === selectedIndex);
    }

    // ── Draw shelf ──
    for (var s = 0; s < shelfSlots.length; s++) shelfSlots[s].draw(ctx);

    // ── Draw expanded box ──
    if (expandedBox) expandedBox.draw(ctx);

    // ── Onboarding ──
    if (onboardingShown) {
      ctx.fillStyle = 'rgba(15, 15, 20, 0.7)';
      ctx.fillRect(0, 0, W, H);

      ctx.textAlign = 'center';
      ctx.font = '16px sans-serif';
      ctx.fillStyle = grayRgb(160);
      var cy = H / 2;
      ctx.fillText('Open left hand + tilt to browse', W / 2, cy - 50);
      ctx.fillText('Close left hand to pause browsing', W / 2, cy - 20);
      ctx.fillText('Open right hand to expand a card', W / 2, cy + 10);
      ctx.fillText('Close right hand to collapse', W / 2, cy + 40);
      ctx.font = '14px sans-serif';
      var pre = 'Hover finger on ';
      var linkWord = 'links';
      var post = ' to open them';
      var fullW = ctx.measureText(pre + linkWord + post).width;
      var startX = W / 2 - fullW / 2;
      ctx.textAlign = 'left';
      ctx.fillStyle = grayRgb(160);
      ctx.fillText(pre, startX, cy + 75);
      ctx.fillStyle = C.LINK_COLOR;
      ctx.fillText(linkWord, startX + ctx.measureText(pre).width, cy + 75);
      ctx.fillStyle = grayRgb(160);
      ctx.fillText(post, startX + ctx.measureText(pre + linkWord).width, cy + 75);
      ctx.textAlign = 'center';
      ctx.font = '12px sans-serif';
      ctx.fillStyle = grayRgb(100);
      ctx.fillText('Show your hands to the camera to begin', W / 2, cy + 105);
      ctx.textAlign = 'left';
    }

    // ── FPS ──
    var fps = 1.0 / (now - prevFrameTime);
    prevFrameTime = now;
    ctx.font = '12px sans-serif';
    ctx.fillStyle = grayRgb(60);
    ctx.fillText('FPS ' + Math.round(fps), W - 70, H - 12);

    // ── Legend ──
    ctx.font = C.LEGEND_FONT_PX + 'px sans-serif';
    var legendLines = [
      ['L open + tilt:', 'browse'],
      ['L close:', 'pause browsing'],
      ['R open:', 'expand'],
      ['R close:', 'collapse']
    ];
    var colX = 0;
    for (var li = 0; li < legendLines.length; li++) {
      var kw = ctx.measureText(legendLines[li][0]).width;
      if (kw > colX) colX = kw;
    }
    colX += 12; // gap after label
    var maxLineW = 0;
    for (var li2 = 0; li2 < legendLines.length; li2++) {
      var lineW = colX + ctx.measureText(legendLines[li2][1]).width;
      if (lineW > maxLineW) maxLineW = lineW;
    }
    var lx = 10, legendH = legendLines.length * 14 + 10;
    var legendMargin = 40;
    var ly = H - legendH - legendMargin;
    var lw = maxLineW + 16;
    drawCornerMarks(ctx, lx, ly, lw, legendH, grayRgb(40), 6, 1);
    for (var li3 = 0; li3 < legendLines.length; li3++) {
      var row = li3 * 14 + 14;
      ctx.fillStyle = grayRgb(45);
      ctx.fillText(legendLines[li3][0], lx + 8, ly + row);
      ctx.fillStyle = grayRgb(60);
      ctx.fillText(legendLines[li3][1], lx + 8 + colX, ly + row);
    }
  }

  requestAnimationFrame(onFrame);
  } // end init
})();
