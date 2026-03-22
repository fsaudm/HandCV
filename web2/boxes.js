// Dial + teleport mode - extends shared Box/ShelfSlot with teleport animation + pluggable text effects
(function() {
  var C = CONFIG;
  var URL_RE = /https?:\/\/\S+/g;

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function wrapLines(ctx, lines, maxW) {
    var wrapped = [];
    for (var i = 0; i < lines.length; i++) {
      var words = lines[i].split(' ');
      var line = '';
      for (var j = 0; j < words.length; j++) {
        var test = line ? line + ' ' + words[j] : words[j];
        if (ctx.measureText(test).width > maxW && line) {
          wrapped.push(line);
          line = words[j];
        } else {
          line = test;
        }
      }
      if (line) wrapped.push(line);
    }
    return wrapped;
  }

  // ── Extend Box constructor ──
  var _BaseBox = Box;
  window.Box = function(x, y, w, h, color, title, body, sectionIdx) {
    _BaseBox.call(this, x, y, w, h, color, title, body, sectionIdx);
    this.animating = false;
    this.animProgress = 0;
    this.expanding = true;
    this.sourceX = x; this.sourceY = y; this.sourceW = w; this.sourceH = h;
    this.targetX = x; this.targetY = y; this.targetW = w; this.targetH = h;
    this.linkHitboxes = [];
    // Text effect state
    this.diffPhase = 'idle'; // idle | revealing | revealed | fading | faded
    this.diffTick = 0;
    this.diffTotal = C.TEXT_EFFECT_FRAMES;
    this.textEffect = TextEffects.get(C.TEXT_EFFECT);
  };
  window.Box.prototype = Object.create(_BaseBox.prototype);
  window.Box.prototype.constructor = window.Box;

  Box.prototype.animateTo = function(tx, ty, tw, th) {
    this.sourceX = this.x; this.sourceY = this.y;
    this.sourceW = this.w; this.sourceH = this.h;
    this.targetX = tx; this.targetY = ty;
    this.targetW = tw; this.targetH = th;
    this.animProgress = 0;
    this.animating = true;
  };

  Box.prototype.startDiffusion = function(revealing) {
    this.diffPhase = revealing ? 'revealing' : 'fading';
    this.diffTick = 0;
  };

  Box.prototype.tick = function() {
    if (this.animating) {
      var speed = this.expanding ? C.TELEPORT_EXPAND_SPEED : C.TELEPORT_COLLAPSE_SPEED;
      this.animProgress = Math.min(1, this.animProgress + speed);
      var t = easeOutCubic(this.animProgress);
      this.x = Math.round(this.sourceX + (this.targetX - this.sourceX) * t);
      this.y = Math.round(this.sourceY + (this.targetY - this.sourceY) * t);
      this.w = Math.round(this.sourceW + (this.targetW - this.sourceW) * t);
      this.h = Math.round(this.sourceH + (this.targetH - this.sourceH) * t);
      if (this.animProgress >= 1) {
        this.x = this.targetX; this.y = this.targetY;
        this.w = this.targetW; this.h = this.targetH;
        this.animating = false;
      }
    }
    if (this.diffPhase === 'revealing' || this.diffPhase === 'fading') {
      this.diffTick++;
      if (this.diffTick >= this.diffTotal) {
        this.diffPhase = this.diffPhase === 'revealing' ? 'revealed' : 'faded';
      }
    }
  };

  Box.prototype.draw = function(ctx) {
    var fx = this.textEffect;
    var isRevealing = this.diffPhase === 'revealing';
    var isFading = this.diffPhase === 'fading';
    var isActive = isRevealing || isFading;
    var isVisible = isActive || this.diffPhase === 'revealed';

    // Background
    ctx.fillStyle = rgba(C.BOX_BG_COLOR, C.BOX_BG_OPACITY);
    ctx.fillRect(this.x, this.y, this.w, this.h);

    // Corner marks
    var at = this.animProgress;
    var cornerLen = C.SHELF_CORNER_LEN + (C.CORNER_LEN - C.SHELF_CORNER_LEN) * (this.expanding ? at : 1 - at);
    drawCornerMarks(ctx, this.x, this.y, this.w, this.h, this.color, cornerLen, C.CORNER_THICKNESS);

    // Title
    var isExpanded = (this.w > C.DEFAULT_BOX_W * 2);
    if (isExpanded && isVisible) {
      var titleAlpha = isActive ? fx.alpha(this.diffTick, this.diffTotal, isRevealing) : 1;
      var titleStr = isActive ? fx.transform(this.title, this.diffTick, this.diffTotal, isRevealing) : this.title;
      ctx.font = C.TITLE_FONT_PX + 'px sans-serif';
      ctx.fillStyle = grayRgb(Math.round(220 * titleAlpha));
      ctx.fillText(titleStr, this.x + 8, this.y + 16);
    } else if (!isExpanded) {
      ctx.font = C.SHELF_FONT_PX + 'px sans-serif';
      ctx.fillStyle = grayRgb(180);
      ctx.fillText(this.title, this.x + 4, this.y + this.h - 6);
    }

    // Body text
    this.linkHitboxes = [];
    if (isVisible && this.bodyLines.length && isExpanded) {
      ctx.font = C.BODY_FONT_PX + 'px sans-serif';
      var maxW = this.w - 24;
      var wrapped = wrapLines(ctx, this.bodyLines, maxW);
      var bodyAlpha = isActive ? fx.alpha(this.diffTick, this.diffTotal, isRevealing) : 1;
      var v = Math.round(200 * bodyAlpha);
      var lx = this.x + 12;

      for (var i = 0; i < wrapped.length; i++) {
        var ly = this.y + 38 + i * C.LINE_HEIGHT;
        if (ly > this.y + this.h - 10) break;

        var line = wrapped[i];
        var displayLine = isActive ? fx.transform(line, this.diffTick, this.diffTotal, isRevealing) : line;

        var match = line.match(URL_RE);
        if (match && this.diffPhase === 'revealed') {
          var cursor = 0;
          var cx = lx;
          for (var m = 0; m < match.length; m++) {
            var url = match[m];
            var idx = line.indexOf(url, cursor);
            if (idx > cursor) {
              ctx.fillStyle = grayRgb(v);
              ctx.fillText(line.substring(cursor, idx), cx, ly);
              cx += ctx.measureText(line.substring(cursor, idx)).width;
            }
            ctx.fillStyle = rgba(C.LINK_COLOR, bodyAlpha);
            ctx.fillText(url, cx, ly);
            var linkW = ctx.measureText(url).width;
            this.linkHitboxes.push({ url: url, x: cx, y: ly - 12, w: linkW, h: 16 });
            cx += linkW;
            cursor = idx + url.length;
          }
          if (cursor < line.length) {
            ctx.fillStyle = grayRgb(v);
            ctx.fillText(line.substring(cursor), cx, ly);
          }
        } else {
          ctx.fillStyle = grayRgb(v);
          ctx.fillText(displayLine, lx, ly);
        }
      }
    }
  };

  // ── Extend ShelfSlot ──
  ShelfSlot.prototype.selected = false;

  ShelfSlot.prototype.draw = function(ctx) {
    if (this.selected) {
      ctx.fillStyle = rgba(C.GOLD_ACCENT, C.SELECTED_GLOW_ALPHA);
      ctx.fillRect(this.x - 2, this.y - 2, this.w + 4, this.h + 4);
    }
    this.drawBase(ctx, this.selected);
  };
})();
