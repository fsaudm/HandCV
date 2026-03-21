// Dial + teleport mode — extends shared Box/ShelfSlot with teleport animation
(function() {
  var C = CONFIG;

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
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

  Box.prototype.tick = function() {
    if (!this.animating) return;
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
  };

  Box.prototype.draw = function(ctx) {
    var t = this.animProgress;
    var bodyAlpha;
    if (this.expanding) {
      bodyAlpha = t > 0.5 ? (t - 0.5) / 0.5 : 0;
    } else {
      bodyAlpha = t < 0.5 ? 1 - t / 0.5 : 0;
    }

    // Background
    ctx.fillStyle = rgba(C.BOX_BG_COLOR, C.BOX_BG_OPACITY);
    ctx.fillRect(this.x, this.y, this.w, this.h);

    // Corner marks
    var cornerLen = C.SHELF_CORNER_LEN + (C.CORNER_LEN - C.SHELF_CORNER_LEN) * (this.expanding ? t : 1 - t);
    drawCornerMarks(ctx, this.x, this.y, this.w, this.h, this.color, cornerLen, C.CORNER_THICKNESS);

    // Title
    var isExpanded = (this.w > C.DEFAULT_BOX_W * 2);
    if (isExpanded) {
      ctx.font = C.TITLE_FONT_PX + 'px sans-serif';
      ctx.fillStyle = grayRgb(220);
      ctx.fillText(this.title, this.x + 8, this.y + 16);
    } else {
      ctx.font = C.SHELF_FONT_PX + 'px sans-serif';
      ctx.fillStyle = grayRgb(180);
      ctx.fillText(this.title.slice(0, 6), this.x + 4, this.y + this.h - 6);
    }

    // Body text
    if (bodyAlpha > 0 && this.bodyLines.length) {
      var v = Math.round(200 * bodyAlpha);
      ctx.font = C.BODY_FONT_PX + 'px sans-serif';
      ctx.fillStyle = grayRgb(v);
      for (var i = 0; i < this.bodyLines.length; i++) {
        var ly = this.y + 38 + i * C.LINE_HEIGHT;
        if (ly > this.y + this.h - 10) break;
        ctx.fillText(this.bodyLines[i], this.x + 12, ly);
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
