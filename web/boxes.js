// Drag & drop mode — extends shared Box/ShelfSlot with lerp animation
(function() {
  var C = CONFIG;

  // ── Extend Box constructor ──
  var _BaseBox = Box;
  window.Box = function(x, y, w, h, color, title, body, sectionIdx) {
    _BaseBox.call(this, x, y, w, h, color, title, body, sectionIdx);
    this.closedW = w; this.closedH = h;
    this.openW = C.OPEN_BOX_W; this.openH = C.OPEN_BOX_H;
    this.open = false;
    this.openProgress = 0;
    this.discarding = false;
    this.discardProgress = 0;
    this.dragOffset = [0, 0];
    this.highlighted = false;
    this.toggleCooldown = 0;
  };
  window.Box.prototype = Object.create(_BaseBox.prototype);
  window.Box.prototype.constructor = window.Box;

  Box.prototype.alive = function() { return this.discardProgress < 1.0; };

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
    if (this.discarding) this.discardProgress = Math.min(1, this.discardProgress + C.DISCARD_SPEED);
  };

  Box.prototype.draw = function(ctx) {
    if (!this.alive()) return;
    var scale = 1.0 - this.discardProgress;
    if (scale <= 0) return;
    var op = this.openProgress;
    var hoverScale = (op < 0.3) ? 1.0 : (this.highlighted ? C.HIGHLIGHT_SCALE : 1.0);
    var cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    var sw = Math.round(this.w * scale * hoverScale);
    var sh = Math.round(this.h * scale * hoverScale);
    var sx = Math.round(cx - sw / 2);
    var sy = Math.round(cy - sh / 2);

    var baseCorner = C.SHELF_CORNER_LEN + (C.CORNER_LEN - C.SHELF_CORNER_LEN) * op;
    var baseThick = 1 + Math.round((C.CORNER_THICKNESS - 1) * op);

    var corner, col, thickness;
    if (this.highlighted) {
      corner = Math.round((baseCorner + C.HIGHLIGHT_GROW) * Math.max(scale, 0.4));
      col = C.GOLD_ACCENT;
      thickness = baseThick + 1;
    } else {
      corner = Math.round(baseCorner * Math.max(scale, 0.4));
      col = grayRgb(180 * scale);
      thickness = baseThick;
    }

    // background fill
    var baseOpacity = C.SHELF_BG_OPACITY;
    var openExtra = (C.BOX_BG_OPACITY - C.SHELF_BG_OPACITY) * op;
    var alpha = (baseOpacity + openExtra) * scale;
    ctx.fillStyle = rgba(C.BOX_BG_COLOR, alpha);
    ctx.fillRect(sx, sy, sw, sh);

    drawCornerMarks(ctx, sx, sy, sw, sh, col, corner, thickness);

    // title
    var label, tx, ty, fontSize, v;
    if (op < 0.3) {
      label = this.title.slice(0, 6);
      tx = sx + 4; ty = sy + sh - 6;
      fontSize = C.SHELF_FONT_PX;
      v = Math.round(180 * scale);
    } else {
      label = this.title;
      tx = sx + 8; ty = sy + 16;
      fontSize = C.TITLE_FONT_PX;
      var titleAlpha = 0.4 + 0.6 * op;
      v = Math.round(255 * scale * titleAlpha);
    }
    ctx.font = fontSize + 'px sans-serif';
    ctx.fillStyle = grayRgb(v);
    ctx.fillText(label, tx, ty);

    // body text
    if (op > 0.3 && this.bodyLines.length) {
      v = Math.round(200 * Math.min(1, (op - 0.3) / 0.7) * scale);
      ctx.font = C.BODY_FONT_PX + 'px sans-serif';
      ctx.fillStyle = grayRgb(v);
      for (var i = 0; i < this.bodyLines.length; i++) {
        var ly = sy + 38 + i * C.LINE_HEIGHT;
        if (ly > sy + sh - 10) break;
        ctx.fillText(this.bodyLines[i], sx + 12, ly);
      }
    }
  };

  // ── Extend ShelfSlot ──
  ShelfSlot.prototype.highlighted = false;

  ShelfSlot.prototype.contains = function(px, py) {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  };

  ShelfSlot.prototype.draw = function(ctx) {
    this.drawBase(ctx, this.highlighted);
  };
})();
