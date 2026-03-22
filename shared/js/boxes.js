// Shared box primitives — used by both web/ and web2/
(function() {

  function drawCornerMarks(ctx, x, y, w, h, color, cornerLen, thickness) {
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.beginPath();
    ctx.moveTo(x + cornerLen, y); ctx.lineTo(x, y); ctx.lineTo(x, y + cornerLen);
    ctx.moveTo(x + w - cornerLen, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cornerLen);
    ctx.stroke();
  }

  function Box(x, y, w, h, color, title, body, sectionIdx) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.color = color; this.title = title;
    this.body = body || '';
    this.bodyLines = this.body ? this.body.split('\n') : [];
    this.sectionIdx = sectionIdx != null ? sectionIdx : -1;
  }

  function ShelfSlot(x, y, w, h, color, title, sectionIdx) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.color = color; this.title = title;
    this.sectionIdx = sectionIdx != null ? sectionIdx : -1;
  }

  ShelfSlot.prototype.drawBase = function(ctx, isActive) {
    ctx.fillStyle = rgba(CONFIG.BOX_BG_COLOR, CONFIG.SHELF_BG_OPACITY);
    ctx.fillRect(this.x, this.y, this.w, this.h);

    var col, corner, thickness;
    if (isActive) {
      col = CONFIG.GOLD_ACCENT;
      corner = CONFIG.SHELF_CORNER_LEN + 2;
      thickness = 2;
    } else {
      col = this.color;
      corner = CONFIG.SHELF_CORNER_LEN;
      thickness = 1;
    }
    drawCornerMarks(ctx, this.x, this.y, this.w, this.h, col, corner, thickness);

    ctx.font = CONFIG.SHELF_FONT_PX + 'px sans-serif';
    ctx.fillStyle = isActive ? CONFIG.GOLD_ACCENT : grayRgb(180);
    ctx.fillText(this.title, this.x + 4, this.y + this.h - 6);
  };

  window.Box = Box;
  window.ShelfSlot = ShelfSlot;
  window.drawCornerMarks = drawCornerMarks;
})();
