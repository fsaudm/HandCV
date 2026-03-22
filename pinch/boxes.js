// Box primitives and pinch mode animation
(function() {
  var C = CONFIG;

  function drawCornerMarks(ctx, x, y, w, h, color, cornerLen, thickness) {
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.beginPath();
    ctx.moveTo(x + cornerLen, y); ctx.lineTo(x, y); ctx.lineTo(x, y + cornerLen);
    ctx.moveTo(x + w - cornerLen, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cornerLen);
    ctx.stroke();
  }

  // ── Box ──
  function Box(x, y, w, h, color, title, body, sectionIdx) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.color = color; this.title = title;
    this.body = body || '';
    this.bodyLines = this.body ? this.body.split('\n') : [];
    this.sectionIdx = sectionIdx != null ? sectionIdx : -1;
    this.closedW = w; this.closedH = h;
    this.openW = C.OPEN_BOX_W; this.openH = C.OPEN_BOX_H;
    this.open = false;
    this.openProgress = 0;
    this.dragOffset = [0, 0];
    this.highlighted = false;
    this.toggleCooldown = 0;
  }

  Box.prototype.contains = function(px, py) {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  };

  Box.prototype.tick = function() {
    if (this.open && this.openProgress < 1) this.openProgress = Math.min(1, this.openProgress + C.OPEN_SPEED);
    else if (!this.open && this.openProgress > 0) this.openProgress = Math.max(0, this.openProgress - C.CLOSE_SPEED);
    var op = this.openProgress;
    var cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    this.w = Math.round(this.closedW + (this.openW - this.closedW) * op);
    this.h = Math.round(this.closedH + (this.openH - this.closedH) * op);
    this.x = Math.round(cx - this.w / 2);
    this.y = Math.round(cy - this.h / 2);
    if (this.toggleCooldown > 0) this.toggleCooldown--;
  };

  Box.prototype.draw = function(ctx) {
    var op = this.openProgress;
    var hoverScale = (op < 0.3) ? 1.0 : (this.highlighted ? C.HIGHLIGHT_SCALE : 1.0);
    var cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    var sw = Math.round(this.w * hoverScale);
    var sh = Math.round(this.h * hoverScale);
    var sx = Math.round(cx - sw / 2);
    var sy = Math.round(cy - sh / 2);

    var baseCorner = C.SHELF_CORNER_LEN + (C.CORNER_LEN - C.SHELF_CORNER_LEN) * op;
    var baseThick = 1 + Math.round((C.CORNER_THICKNESS - 1) * op);

    var corner, col, thickness;
    if (this.highlighted) {
      corner = Math.round(baseCorner + C.HIGHLIGHT_GROW);
      col = C.GOLD_ACCENT;
      thickness = baseThick + 1;
    } else {
      corner = Math.round(baseCorner);
      col = grayRgb(180);
      thickness = baseThick;
    }

    var baseOpacity = C.SHELF_BG_OPACITY;
    var openExtra = (C.BOX_BG_OPACITY - C.SHELF_BG_OPACITY) * op;
    ctx.fillStyle = rgba(C.BOX_BG_COLOR, baseOpacity + openExtra);
    ctx.fillRect(sx, sy, sw, sh);

    drawCornerMarks(ctx, sx, sy, sw, sh, col, corner, thickness);

    // Title
    if (op < 0.3) {
      ctx.font = C.SHELF_FONT_PX + 'px sans-serif';
      ctx.fillStyle = grayRgb(180);
      ctx.fillText(this.title, sx + 4, sy + sh - 6);
    } else {
      ctx.font = C.TITLE_FONT_PX + 'px sans-serif';
      var titleAlpha = 0.4 + 0.6 * op;
      ctx.fillStyle = grayRgb(Math.round(255 * titleAlpha));
      ctx.fillText(this.title, sx + 8, sy + 16);
    }

    // Body text
    if (op > 0.3 && this.bodyLines.length) {
      var v = Math.round(200 * Math.min(1, (op - 0.3) / 0.7));
      ctx.font = C.BODY_FONT_PX + 'px sans-serif';
      ctx.fillStyle = grayRgb(v);
      for (var i = 0; i < this.bodyLines.length; i++) {
        var ly = sy + 38 + i * C.LINE_HEIGHT;
        if (ly > sy + sh - 10) break;
        ctx.fillText(this.bodyLines[i], sx + 12, ly);
      }
    }
  };

  // ── ShelfSlot ──
  function ShelfSlot(x, y, w, h, color, title, sectionIdx) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.color = color; this.title = title;
    this.sectionIdx = sectionIdx != null ? sectionIdx : -1;
    this.highlighted = false;
  }

  ShelfSlot.prototype.drawBase = function(ctx, isActive) {
    ctx.fillStyle = rgba(C.BOX_BG_COLOR, C.SHELF_BG_OPACITY);
    ctx.fillRect(this.x, this.y, this.w, this.h);
    var col = isActive ? C.GOLD_ACCENT : this.color;
    var corner = isActive ? C.SHELF_CORNER_LEN + 2 : C.SHELF_CORNER_LEN;
    var thickness = isActive ? 2 : 1;
    drawCornerMarks(ctx, this.x, this.y, this.w, this.h, col, corner, thickness);
    ctx.font = C.SHELF_FONT_PX + 'px sans-serif';
    ctx.fillStyle = isActive ? C.GOLD_ACCENT : grayRgb(180);
    ctx.fillText(this.title, this.x + 4, this.y + this.h - 6);
  };

  ShelfSlot.prototype.contains = function(px, py) {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  };

  ShelfSlot.prototype.draw = function(ctx) {
    this.drawBase(ctx, this.highlighted);
  };

  window.Box = Box;
  window.ShelfSlot = ShelfSlot;
  window.drawCornerMarks = drawCornerMarks;
})();
