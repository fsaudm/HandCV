// Box primitives and dial mode animation + text effects
(function() {
  var C = CONFIG;
  var LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // Simple markdown tokenizer - produces flat array of render instructions
  function tokenizeBody(text) {
    var lines = text.split('\n');
    var tokens = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      // Blank line
      if (!line.trim()) { tokens.push({ type: 'space' }); continue; }

      // Horizontal rule
      if (/^---+$/.test(line.trim())) { tokens.push({ type: 'hr' }); continue; }

      // Heading
      var hMatch = line.match(/^(#{1,3})\s+(.+)/);
      if (hMatch) { tokens.push({ type: 'heading', depth: hMatch[1].length, segments: parseInline(hMatch[2]) }); continue; }

      // List item
      var liMatch = line.match(/^\s*[-*]\s+(.*)/);
      if (liMatch) { tokens.push({ type: 'listitem', segments: parseInline('· ' + liMatch[1]) }); continue; }

      // Plain line
      tokens.push({ type: 'line', segments: parseInline(line) });
    }
    return tokens;
  }

  // Parse inline content into segments of text and links
  function parseInline(text) {
    var segments = [];
    var last = 0;
    var match;
    LINK_RE.lastIndex = 0;
    while ((match = LINK_RE.exec(text)) !== null) {
      if (match.index > last) segments.push({ text: text.substring(last, match.index) });
      segments.push({ text: match[1], url: match[2] });
      last = LINK_RE.lastIndex;
    }
    if (last < text.length) segments.push({ text: text.substring(last) });
    return segments;
  }

  function wrapSegments(ctx, segments, maxW) {
    // Returns array of lines, each line is array of { text, url? } with wrapping applied
    var lines = [[]];
    var lineW = 0;
    for (var s = 0; s < segments.length; s++) {
      var seg = segments[s];
      var words = seg.text.split(' ');
      for (var w = 0; w < words.length; w++) {
        var word = words[w];
        if (!word && w === 0) continue;
        var prefix = (lineW > 0 && w > 0) ? ' ' : (lineW > 0 ? ' ' : '');
        var testW = ctx.measureText(prefix + word).width;
        if (lineW + testW > maxW && lineW > 0) {
          lines.push([]);
          lineW = 0;
          prefix = '';
          testW = ctx.measureText(word).width;
        }
        var displayText = prefix + word;
        lines[lines.length - 1].push({ text: displayText, url: seg.url });
        lineW += ctx.measureText(displayText).width;
      }
    }
    return lines;
  }

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
    this.bodyTokens = this.body ? tokenizeBody(this.body) : [];
    this.sectionIdx = sectionIdx != null ? sectionIdx : -1;
    this.animating = false;
    this.animProgress = 0;
    this.expanding = true;
    this.sourceX = x; this.sourceY = y; this.sourceW = w; this.sourceH = h;
    this.targetX = x; this.targetY = y; this.targetW = w; this.targetH = h;
    this.linkHitboxes = [];
    this.diffPhase = 'idle';
    this.diffTick = 0;
    this.diffTotal = C.TEXT_EFFECT_FRAMES;
    this.textEffect = TextEffects.get(C.TEXT_EFFECT);
  }

  Box.prototype.updateContent = function(title, body, sectionIdx) {
    this.title = title;
    this.body = body || '';
    this.bodyTokens = this.body ? tokenizeBody(this.body) : [];
    this.sectionIdx = sectionIdx != null ? sectionIdx : -1;
    this.linkHitboxes = [];
  };

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

    ctx.fillStyle = rgba(C.BOX_BG_COLOR, C.BOX_BG_OPACITY);
    ctx.fillRect(this.x, this.y, this.w, this.h);

    var at = this.animProgress;
    var cornerLen = C.SHELF_CORNER_LEN + (C.CORNER_LEN - C.SHELF_CORNER_LEN) * (this.expanding ? at : 1 - at);
    drawCornerMarks(ctx, this.x, this.y, this.w, this.h, this.color, cornerLen, C.CORNER_THICKNESS);

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

    // Body rendering
    this.linkHitboxes = [];
    if (!isVisible || !this.bodyTokens.length || !isExpanded) return;

    var bodyAlpha = isActive ? fx.alpha(this.diffTick, this.diffTotal, isRevealing) : 1;
    var lx = this.x + 12;
    var ly = this.y + 38;
    var maxW = this.w - 24;
    var bottom = this.y + this.h - 10;

    for (var ti = 0; ti < this.bodyTokens.length; ti++) {
      if (ly > bottom) break;
      var tok = this.bodyTokens[ti];

      if (tok.type === 'space') {
        ly += Math.round(C.LINE_HEIGHT * 0.4);
        continue;
      }

      if (tok.type === 'hr') {
        ctx.beginPath();
        ctx.moveTo(lx, ly - 4); ctx.lineTo(lx + maxW, ly - 4);
        ctx.strokeStyle = grayRgb(Math.round(60 * bodyAlpha));
        ctx.lineWidth = 1;
        ctx.stroke();
        ly += 4;
        continue;
      }

      // Heading, listitem, or line
      var indent = tok.type === 'listitem' ? 8 : 0;
      var font, color;
      if (tok.type === 'heading' && tok.depth <= 2) {
        font = C.TITLE_FONT_PX + 'px sans-serif';
        color = Math.round(220 * bodyAlpha);
        ly += 4;
      } else if (tok.type === 'heading') {
        font = C.BODY_FONT_PX + 'px sans-serif';
        color = Math.round(180 * bodyAlpha);
        ly += 2;
      } else {
        font = C.BODY_FONT_PX + 'px sans-serif';
        color = Math.round(200 * bodyAlpha);
      }

      ctx.font = font;
      var wrapped = wrapSegments(ctx, tok.segments, maxW - indent);

      for (var wi = 0; wi < wrapped.length; wi++) {
        if (ly > bottom) break;
        var cx = lx + indent;
        var segs = wrapped[wi];
        for (var si = 0; si < segs.length; si++) {
          var seg = segs[si];
          var label = seg.text;
          var display = isActive ? fx.transform(label, this.diffTick, this.diffTotal, isRevealing) : label;

          if (seg.url && this.diffPhase === 'revealed') {
            ctx.fillStyle = rgba(C.LINK_COLOR, bodyAlpha);
            ctx.fillText(label, cx, ly);
            var tw = ctx.measureText(label).width;
            this.linkHitboxes.push({ url: seg.url, x: cx, y: ly - 12, w: tw, h: 16 });
            cx += tw;
          } else if (seg.url) {
            ctx.fillStyle = rgba(C.LINK_COLOR, bodyAlpha);
            ctx.fillText(display, cx, ly);
            cx += ctx.measureText(label).width;
          } else {
            ctx.fillStyle = grayRgb(color);
            ctx.fillText(display, cx, ly);
            cx += ctx.measureText(label).width;
          }
        }
        ly += C.LINE_HEIGHT;
      }
    }
  };

  // ── ShelfSlot ──
  function ShelfSlot(x, y, w, h, color, title) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.color = color; this.title = title;
    this.selected = false;
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

  ShelfSlot.prototype.draw = function(ctx) {
    if (this.selected) {
      ctx.fillStyle = rgba(C.GOLD_ACCENT, C.SELECTED_GLOW_ALPHA);
      ctx.fillRect(this.x - 2, this.y - 2, this.w + 4, this.h + 4);
    }
    this.drawBase(ctx, this.selected);
  };

  window.Box = Box;
  window.ShelfSlot = ShelfSlot;
  window.drawCornerMarks = drawCornerMarks;
})();
