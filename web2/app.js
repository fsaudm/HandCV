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
  var state = 'BROWSING'; // BROWSING | EXPANDING | EXPANDED | COLLAPSING
  var selectedIndex = 0;
  var expandedBox = null;

  // Dial tracking
  var prevLeftAngle = null;
  var accumulatedRotation = 0;
  var smoothedAngle = null;
  var dialCooldown = 0;

  // Expand/collapse cooldowns
  var expandCooldown = 0;
  var collapseCooldown = 0;

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
      ctx.fillText('dial', lWrist.x, lWrist.y + 30);
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
      ctx.font = C.TITLE_FONT_PX + 'px sans-serif';
      ctx.fillStyle = rgba(C.GOLD_ACCENT, 0.55);
      ctx.textAlign = 'center';
      ctx.fillText('teleport', rWrist.x, rWrist.y + 30);
      ctx.textAlign = 'left';
    }

    // ── Dismiss onboarding on first gesture ──
    if (onboardingShown && (leftHand || rightHand)) {
      onboardingShown = false;
    }

    // ── Cooldown ticks ──
    if (dialCooldown > 0) dialCooldown--;
    if (expandCooldown > 0) expandCooldown--;
    if (collapseCooldown > 0) collapseCooldown--;

    // ── State machine ──
    if (state === 'BROWSING') {
      // LEFT HAND DIAL
      if (leftHand && dialCooldown === 0) {
        var rawAngle = G.getHandAngle(leftHand, W, H);

        if (smoothedAngle === null) {
          smoothedAngle = rawAngle;
          prevLeftAngle = rawAngle;
        } else {
          // EMA smoothing with wrapping
          var diff = angleDiff(rawAngle, smoothedAngle);
          smoothedAngle = smoothedAngle + C.DIAL_SMOOTHING * diff;
        }

        var delta = angleDiff(smoothedAngle, prevLeftAngle);
        accumulatedRotation += delta;
        prevLeftAngle = smoothedAngle;

        if (Math.abs(accumulatedRotation) > C.DIAL_CLICK_ANGLE) {
          if (accumulatedRotation > 0) {
            selectedIndex = (selectedIndex + 1) % shelfSlots.length;
          } else {
            selectedIndex = (selectedIndex - 1 + shelfSlots.length) % shelfSlots.length;
          }
          accumulatedRotation = 0;
          dialCooldown = C.DIAL_COOLDOWN_FRAMES;
        }

        // Draw dial indicator near left wrist
        var wristPos = G.lmPx(leftHand[G.WRIST], W, H);
        var progress = Math.abs(accumulatedRotation) / C.DIAL_CLICK_ANGLE;
        drawArc(ctx, wristPos.x, wristPos.y, C.DIAL_INDICATOR_RADIUS, Math.min(progress, 1),
                C.GOLD_ACCENT, 2);
      } else if (!leftHand) {
        prevLeftAngle = null;
        smoothedAngle = null;
        accumulatedRotation = 0;
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
        state = 'EXPANDED';
      }

    } else if (state === 'EXPANDED') {
      function beginCollapse() {
        var slot = shelfSlots[selectedIndex];
        expandedBox.expanding = false;
        expandedBox.animateTo(slot.x, slot.y, slot.w, slot.h);
        state = 'COLLAPSING';
        collapseCooldown = C.COLLAPSE_COOLDOWN;
        expandCooldown = C.EXPAND_COOLDOWN;
      }

      // RIGHT HAND: closed fist = collapse
      if (rightHand && collapseCooldown === 0 && G.isFist(rightHand, W, H)) {
        beginCollapse();
      }
      // Secondary: hands together = collapse
      else if (leftHand && rightHand && collapseCooldown === 0 && G.areHandsTogether(leftHand, rightHand, W, H)) {
        beginCollapse();
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

    } else if (state === 'COLLAPSING') {
      expandedBox.tick();
      if (!expandedBox.animating) {
        expandedBox = null;
        state = 'BROWSING';
        // Reset dial state so it doesn't jump
        prevLeftAngle = null;
        smoothedAngle = null;
        accumulatedRotation = 0;
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
      ctx.fillText('tilt left hand to browse', W / 2, cy - 30);
      ctx.fillText('open right hand to expand', W / 2, cy);
      ctx.fillText('close right fist to collapse', W / 2, cy + 30);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = grayRgb(100);
      ctx.fillText('show a hand to begin', W / 2, cy + 70);
      ctx.textAlign = 'left';
    }

    // ── FPS ──
    var fps = 1.0 / (now - prevFrameTime);
    prevFrameTime = now;
    ctx.font = '12px sans-serif';
    ctx.fillStyle = grayRgb(60);
    ctx.fillText('FPS ' + Math.round(fps), W - 70, H - 12);

    // ── Legend ──
    var legendH = 56, legendMargin = 40;
    var legendY = H - legendH - legendMargin;
    var lx = 10, ly = legendY, lw = 170, lh = legendH;
    drawCornerMarks(ctx, lx, ly, lw, lh, grayRgb(40), 6, 1);
    ctx.font = C.LEGEND_FONT_PX + 'px sans-serif';
    ctx.fillStyle = grayRgb(55);
    ctx.fillText('tilt L hand     browse', lx + 8, ly + 16);
    ctx.fillText('R hand open     expand', lx + 8, ly + 30);
    ctx.fillText('R fist          close', lx + 8, ly + 44);
  }

  requestAnimationFrame(onFrame);
  } // end init
})();
