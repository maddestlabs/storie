---
name: "Klondike Solitaire"
theme: "stonegarden"
font: "Cutive+Mono"
shaders: "vintage"
---

Classic Klondike solitaire. Drag cards between tableau columns, move runs to foundations, deal from the stock.

- **Drag** a card (or run) to move it
- **Double-click** a card to auto-move it to a foundation
- **Click stock** (top-left) to deal; click through empty stock to reset
- Cards render via `ui` immediate-mode + `pushMaskRoundedRect` for proper card shapes
- Card ranks and suit glyphs are drawn with `ui.text`; no textures required

## Demo

```js
// ─── Constants ────────────────────────────────────────────────────────────────
var SUITS       = ['♠','♥','♦','♣'];   // spade, heart, diamond, club
var RANKS       = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
var SUIT_RED    = [false, true, true, false]; // index matches SUITS
var NUM_TABLEAU = 7;
var STOCK_DEAL  = 1;   // cards dealt per click (set to 3 for draw-3 variant)
var DECK_AGE    = 1.0; // 0 = pristine (no aging), 1 = very worn; scales all card age effects
var FELT_TINT   = 0.5; // 0 = original texture unaltered, 1 = fully recoloured by theme felt colour
var BG_SCALE    = 0.75; // tile size multiplier: >1 zooms in (larger tiles), <1 zooms out (more tiles)

// ─── Card helpers ─────────────────────────────────────────────────────────────
function cardId(suit, rank) { return suit * 13 + rank; }         // 0-51
function cardSuit(id)       { return Math.floor(id / 13); }      // 0-3
function cardRank(id)       { return id % 13; }                  // 0-12
function isRed(id)          { return SUIT_RED[cardSuit(id)]; }
function rankLabel(r)       { return RANKS[r]; }
function suitLabel(s)       { return SUITS[s]; }
function cardLabel(id)      { return rankLabel(cardRank(id)) + suitLabel(cardSuit(id)); }

function shuffledDeck(rng) {
  var deck = [];
  for (var i = 0; i < 52; i++) deck.push(i);
  // Seeded Fisher-Yates
  for (var i2 = deck.length - 1; i2 > 0; i2--) {
    var j = Math.floor(rng() * (i2 + 1));
    var tmp = deck[i2]; deck[i2] = deck[j]; deck[j] = tmp;
  }
  return deck;
}

// ─── Game state ───────────────────────────────────────────────────────────────
// Each "slot" is an array of { id, faceUp } objects.
// Foundations: 4 piles (one per suit), ace-to-king.
// Tableau: 7 columns. Stock: face-down draw pile. Waste: face-up discard.
scope.gs = scope.gs || null;

// newGame(seed?) — pass a seed to replay a known game, or omit for a fresh random one.
function newGame(seed) {
  var useSeed = (seed !== undefined && seed !== null) ? (seed >>> 0) : random.seed();
  var rng = random.rng(useSeed);
  var deck = shuffledDeck(rng);
  var di = 0;

  var tableau = [];
  for (var col = 0; col < NUM_TABLEAU; col++) {
    var pile = [];
    for (var row = 0; row <= col; row++) {
      pile.push({ id: deck[di++], faceUp: row === col });
    }
    tableau.push(pile);
  }

  var stock = [];
  while (di < 52) stock.push({ id: deck[di++], faceUp: false });

  scope.gs = {
    tableau:     tableau,
    foundations: [[], [], [], []],
    stock:       stock,
    waste:       [],
    drag:        null,   // { cards, fromPile, fromIndex, ox, oy, x, y }
    dblTap:      null,   // { id, at } — for double-click detection
    won:         false,
    moveCount:   0,
    seed:        useSeed,
  };
}

// ─── Move validation ──────────────────────────────────────────────────────────
function canPlaceOnFoundation(card, foundation) {
  var suit = cardSuit(card.id);
  if (foundation.length === 0) return cardRank(card.id) === 0;  // must be Ace
  var top = foundation[foundation.length - 1];
  return cardSuit(top.id) === suit && cardRank(top.id) === cardRank(card.id) - 1;
}

function canPlaceOnTableau(card, column) {
  if (column.length === 0) return cardRank(card.id) === 12;  // only King on empty
  var top = column[column.length - 1];
  if (!top.faceUp) return false;
  return isRed(card.id) !== isRed(top.id) && cardRank(top.id) === cardRank(card.id) + 1;
}

// Try to auto-move a card to the best foundation. Returns true if moved.
function autoToFoundation(card, fromPile, fromIndex) {
  var suit = cardSuit(card.id);
  var found = scope.gs.foundations[suit];
  if (!canPlaceOnFoundation(card, found)) return false;
  fromPile.splice(fromIndex, 1);
  found.push({ id: card.id, faceUp: true });
  // Flip new top of source column
  if (fromPile.length > 0 && !fromPile[fromPile.length - 1].faceUp) {
    fromPile[fromPile.length - 1].faceUp = true;
  }
  scope.gs.moveCount++;
  checkWin();
  return true;
}

function checkWin() {
  var g = scope.gs;
  for (var s = 0; s < 4; s++) {
    if (g.foundations[s].length < 13) return;
  }
  g.won = true;
}

// ─── Layout ────────────────────────────────────────────────────────────────────
// Returns a layout descriptor based on current canvas size.
// All coordinates in physical pixels (what ui.rect uses).
function computeLayout() {
  var W  = ui.metrics.canvasWidth  || 1920;
  var H  = ui.metrics.canvasHeight || 1080;
  var portrait = H > W;

  // Card dimensions: standard 2.5:3.5 ratio, scaled to fit.
  var cols   = NUM_TABLEAU;                                     // 7 tableau columns
  var hPad   = portrait ? Math.floor(W * 0.025) : Math.floor(W * 0.022);
  var vPad   = portrait ? Math.floor(H * 0.025) : Math.floor(H * 0.028);
  var colGap = Math.floor(hPad * 0.6);
  var cw     = Math.floor((W - hPad * 2 - colGap * (cols - 1)) / cols);
  var ch     = Math.round(cw * (3.5 / 2.5));
  // Clamp card size for very large or very small screens
  var maxCH  = portrait ? Math.floor(H * 0.22) : Math.floor(H * 0.28);
  if (ch > maxCH) { ch = maxCH; cw = Math.round(ch * (2.5 / 3.5)); }

  // Vertical card offset within a tableau column (how much of card is exposed).
  // Clamp to available height so the deepest initial column (col 7: 6 stacked
  // cards + 1 face-up top) always fits on screen regardless of window shape.
  // tableauY = 2*vPad + ch, so available height = H - tableauY - vPad - ch
  //                                              = H - 3*vPad - 2*ch
  var tableauAvailH = H - 3 * vPad - 2 * ch;
  var maxColOffset  = tableauAvailH > 0 ? Math.floor(tableauAvailH / 6) : 10;
  var stackOffset   = Math.min(Math.max(Math.round(ch * 0.28), 18), maxColOffset);
  var faceUpOffset  = Math.min(Math.max(Math.round(ch * 0.38), 24), maxColOffset);
  faceUpOffset = Math.max(faceUpOffset, stackOffset); // never collapse below stack

  // Top row: stock (col 0), waste (col 1), gap, foundations (cols 3-6)
  var topRowY = vPad;
  var topRowXs = [];
  for (var ci = 0; ci < cols; ci++) {
    topRowXs.push(hPad + ci * (cw + colGap));
  }

  // Tableau starts below top row
  var tableauY = topRowY + ch + vPad;

  return {
    W: W, H: H,
    cw: cw, ch: ch,
    hPad: hPad, vPad: vPad, colGap: colGap,
    topRowY: topRowY,
    topRowXs: topRowXs,
    tableauY: tableauY,
    stackOffset: stackOffset,
    faceUpOffset: faceUpOffset,
    radius: Math.max(3, Math.round(cw * 0.07)),
  };
}
scope._layout = null;

// ─── Hit testing ──────────────────────────────────────────────────────────────
// Returns { zone, pileKey, index } or null.
//   zone: 'stock' | 'waste' | 'foundation' | 'tableau'
//   pileKey: foundation index or tableau col index
//   index: card index within pile (-1 = empty slot)
function hitTest(px, py, layout) {
  var L = layout;
  var cw = L.cw; var ch = L.ch;

  // Stock
  if (px >= L.topRowXs[0] && px < L.topRowXs[0] + cw &&
      py >= L.topRowY    && py < L.topRowY + ch) {
    return { zone: 'stock', pileKey: 0, index: -1 };
  }
  // Waste
  if (px >= L.topRowXs[1] && px < L.topRowXs[1] + cw &&
      py >= L.topRowY    && py < L.topRowY + ch) {
    return { zone: 'waste', pileKey: 0, index: scope.gs.waste.length - 1 };
  }
  // Foundations (slots 3-6)
  for (var f = 0; f < 4; f++) {
    var fx = L.topRowXs[3 + f];
    if (px >= fx && px < fx + cw && py >= L.topRowY && py < L.topRowY + ch) {
      return { zone: 'foundation', pileKey: f, index: scope.gs.foundations[f].length - 1 };
    }
  }
  // Tableau columns
  for (var col = 0; col < NUM_TABLEAU; col++) {
    var cx2 = L.topRowXs[col];
    var pile = scope.gs.tableau[col];
    // Compute each card's rect (same as draw logic)
    var cardRects = tableauCardRects(pile, cx2, L);
    // Hit test from top (visually last) down
    for (var ci2 = cardRects.length - 1; ci2 >= 0; ci2--) {
      var r = cardRects[ci2];
      // Exposed height: to next card or full card if last
      var expH = (ci2 === cardRects.length - 1) ? ch : cardRects[ci2 + 1].y - r.y;
      expH = Math.max(expH, 14);
      if (px >= r.x && px < r.x + cw && py >= r.y && py < r.y + expH) {
        return { zone: 'tableau', pileKey: col, index: ci2 };
      }
    }
    // Empty column slot
    if (pile.length === 0 &&
        px >= cx2 && px < cx2 + cw &&
        py >= L.tableauY && py < L.tableauY + ch) {
      return { zone: 'tableau', pileKey: col, index: -1 };
    }
  }
  return null;
}

// Compute per-column stack/faceUp offsets that guarantee the column fits within
// the available tableau height. Counts only the n-1 inter-card gaps (the top card
// needs no offset below it). If the preferred offsets already fit, they're returned
// unchanged — compression only kicks in when the column is tall enough to overflow.
function colOffsets(pile, L) {
  var nFD = 0, nFU = 0;
  for (var i = 0; i < pile.length - 1; i++) {
    if (pile[i].faceUp) nFU++; else nFD++;
  }
  var availH = L.H - L.tableauY - L.vPad - L.ch;
  if (availH <= 0 || nFD + nFU === 0) return { so: L.stackOffset, fo: L.faceUpOffset };
  var prefTotal = nFD * L.stackOffset + nFU * L.faceUpOffset;
  if (prefTotal <= availH) return { so: L.stackOffset, fo: L.faceUpOffset };
  var scale = availH / prefTotal;
  return {
    so: Math.max(8,  Math.floor(L.stackOffset  * scale)),
    fo: Math.max(10, Math.floor(L.faceUpOffset * scale)),
  };
}

// Compute y positions for each card in a tableau column
function tableauCardRects(pile, colX, L) {
  var rects = [];
  var y = L.tableauY;
  var offs = colOffsets(pile, L);
  for (var i = 0; i < pile.length; i++) {
    rects.push({ x: colX, y: y });
    if (i < pile.length - 1) {
      y += pile[i].faceUp ? offs.fo : offs.so;
    }
  }
  return rects;
}

// ─── Input handling ────────────────────────────────────────────────────────────
function handleInput(L) {
  var g = scope.gs;
  var mx = ui.pointer.x();
  var my = ui.pointer.y();
  var clicked = ui.pointer.clicked(0);
  var down = ui.pointer.down(0);
  var now = Date.now();

  // ── Drag update ────────────────────────────────────────────────
  if (g.drag) {
    g.drag.x = mx - g.drag.ox;
    g.drag.y = my - g.drag.oy;
  }

  // ── Release: try to drop dragged cards ─────────────────────────
  // Use !down while drag is active — matches the minesweeper pointer pattern.
  if (!down && g.drag) {
    var dropped = false;
    var dragCards = g.drag.cards;
    var topDragCard = dragCards[0];

    // Check foundations (single-card drops only)
    if (dragCards.length === 1) {
      for (var f = 0; f < 4; f++) {
        var fx = L.topRowXs[3 + f];
        var fy = L.topRowY;
        if (mx >= fx && mx < fx + L.cw && my >= fy && my < fy + L.ch) {
          if (canPlaceOnFoundation(topDragCard, g.foundations[f])) {
            // Remove from source
            g.drag.fromPile.splice(g.drag.fromIndex, dragCards.length);
            flipTopIfNeeded(g.drag.fromPile);
            g.foundations[f].push({ id: topDragCard.id, faceUp: true });
            g.moveCount++;
            checkWin();
            dropped = true;
          }
          break;
        }
      }
    }

    // Check tableau columns
    if (!dropped) {
      for (var col = 0; col < NUM_TABLEAU; col++) {
        var cx2 = L.topRowXs[col];
        var colPile = g.tableau[col];
        // Generous drop zone: anywhere over the column strip
        var colTop = L.tableauY;
        var _coffs = colOffsets(colPile, L);
        var colBot = colTop + L.ch + colPile.length * _coffs.fo + 40;
        if (mx >= cx2 && mx < cx2 + L.cw && my >= colTop - 20 && my < colBot) {
          if (canPlaceOnTableau(topDragCard, colPile)) {
            g.drag.fromPile.splice(g.drag.fromIndex, dragCards.length);
            flipTopIfNeeded(g.drag.fromPile);
            for (var dc = 0; dc < dragCards.length; dc++) {
              colPile.push({ id: dragCards[dc].id, faceUp: true });
            }
            g.moveCount++;
            dropped = true;
          }
          break;
        }
      }
    }

    // Return cards to source if drop failed
    if (!dropped) {
      for (var dc2 = 0; dc2 < dragCards.length; dc2++) {
        g.drag.fromPile.splice(g.drag.fromIndex + dc2, 0, dragCards[dc2]);
      }
    }

    g.drag = null;
    return;
  }

  // ── Click / press ───────────────────────────────────────────────
  if (!clicked) return;

  var hit = hitTest(mx, my, L);
  if (!hit) return;

  // Double-click detection
  var isDblClick = false;
  if (g.dblTap && g.dblTap.x === hit.pileKey && g.dblTap.z === hit.zone &&
      now - g.dblTap.at < 420) {
    isDblClick = true;
    g.dblTap = null;
  } else {
    g.dblTap = { x: hit.pileKey, z: hit.zone, at: now };
  }

  // Stock click
  if (hit.zone === 'stock') {
    if (g.stock.length > 0) {
      for (var s2 = 0; s2 < STOCK_DEAL && g.stock.length > 0; s2++) {
        var card = g.stock.pop();
        card.faceUp = true;
        g.waste.push(card);
      }
    } else {
      // Reset: flip waste back to stock
      while (g.waste.length > 0) {
        var wc = g.waste.pop();
        wc.faceUp = false;
        g.stock.push(wc);
      }
    }
    return;
  }

  // Waste top card — start drag or double-click auto-move
  if (hit.zone === 'waste' && g.waste.length > 0) {
    var wTop = g.waste[g.waste.length - 1];
    if (isDblClick) {
      autoToFoundation(wTop, g.waste, g.waste.length - 1);
      return;
    }
    // Start drag
    var wx = L.topRowXs[1]; var wy = L.topRowY;
    g.drag = { cards: [wTop], fromPile: g.waste, fromIndex: g.waste.length - 1,
               ox: mx - wx, oy: my - wy, x: wx, y: wy };
    g.waste.splice(g.waste.length - 1, 1);
    return;
  }

  // Foundation — start drag (move back to tableau)
  if (hit.zone === 'foundation' && hit.pileKey >= 0) {
    var fnd = g.foundations[hit.pileKey];
    if (fnd.length === 0) return;
    var fCard = fnd[fnd.length - 1];
    var fCardX = L.topRowXs[3 + hit.pileKey]; var fCardY = L.topRowY;
    g.drag = { cards: [fCard], fromPile: fnd, fromIndex: fnd.length - 1,
               ox: mx - fCardX, oy: my - fCardY, x: fCardX, y: fCardY };
    fnd.splice(fnd.length - 1, 1);
    return;
  }

  // Tableau card
  if (hit.zone === 'tableau') {
    var tCol  = hit.pileKey;
    var tPile = g.tableau[tCol];
    var tIdx  = hit.index;
    if (tIdx < 0 || tIdx >= tPile.length) return;
    var tCard = tPile[tIdx];
    if (!tCard.faceUp) {
      // Flip face-down top card
      if (tIdx === tPile.length - 1) tCard.faceUp = true;
      return;
    }
    // Double-click: auto-move single top card to foundation
    if (isDblClick && tIdx === tPile.length - 1) {
      autoToFoundation(tCard, tPile, tIdx);
      return;
    }
    // Drag the card and any cards below it (a run)
    var runCards = tPile.slice(tIdx);
    var rects2 = tableauCardRects(tPile, L.topRowXs[tCol], L);
    var startX = rects2[tIdx].x; var startY = rects2[tIdx].y;
    tPile.splice(tIdx, runCards.length);
    g.drag = { cards: runCards, fromPile: tPile, fromIndex: tIdx,
               ox: mx - startX, oy: my - startY, x: startX, y: startY };
    return;
  }
}

function flipTopIfNeeded(pile) {
  if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
    pile[pile.length - 1].faceUp = true;
  }
}

// ─── Palette ──────────────────────────────────────────────────────────────────
// Card face/ink/back colors are fixed (theme-independent) so cards always look
// like real playing cards. Only table felt, status text, and UI chrome use theme.
function getPalette() {
  var base    = getStyle('default');
  var bgAlt   = getStyle('bgAlt');
  var accent1 = getStyle('accent1');
  var dim     = getStyle('dim');
  var success = getStyle('success');
  function a(c, alpha) {
    var r = (c >>> 24) & 255; var g2 = (c >>> 16) & 255;
    var b2 = (c >>> 8) & 255;
    return ui.colors.rgba(r, g2, b2, Math.max(0, Math.min(255, Math.round(alpha * 255))));
  }
  // Lighten accent1.fg 70% towards white for a pale theme-tinted card back.
  // Computed as a packed 0xRRGGBBAA int so there's no alpha scaling bug.
  var _a1 = accent1.fg;
  var _a1r = (_a1 >>> 24) & 255, _a1g = (_a1 >>> 16) & 255, _a1b = (_a1 >>> 8) & 255;
  var _lt = 0.70;
  var _cbR = Math.round(_a1r + (255 - _a1r) * _lt);
  var _cbG = Math.round(_a1g + (255 - _a1g) * _lt);
  var _cbB = Math.round(_a1b + (255 - _a1b) * _lt);
  var _cardBack = ((_cbR & 255) * 0x1000000 + (_cbG & 255) * 0x10000 + (_cbB & 255) * 0x100 + 255) >>> 0;

  return {
    // Table
    bg:           base.bg,
    felt:         a(bgAlt.bg, 1.0),
    // Card face — fixed warm off-white, fully opaque
    cardFace:     ui.colors.rgba(250, 248, 242, 255),
    // Card back — accent1 lightened 70% towards white, with full accent1 panel.
    // Both are packed 0xRRGGBBAA integers to avoid the legacy alpha scaling bug.
    cardBack:    _cardBack,   // pale accent1 tint
    cardBackInv: accent1.fg,  // full accent1 for center panel
    // Borders — fixed grays
    cardBorder:   ui.colors.rgba(160, 154, 142, 255),
    cardBorderSel:a(accent1.fg, 1.0),
    // Shadow — fixed dark, fully opaque
    cardShadow:   ui.colors.rgba(0,   0,   0,  10),
    // Suit ink — fixed classic red and near-black
    red:          ui.colors.rgba(196,  28,  28, 255),
    black:        ui.colors.rgba(18,   18,  22, 255),
    // Slots
    slotBorder:   a(base.fg, 0.20),
    slotFill:     a(base.fg, 0.06),
    // UI chrome
    wonBanner:    a(success.fg, 0.95),
    dimText:      a(dim.fg, 0.85),
  };
}

// ─── Card jitter helpers ──────────────────────────────────────────────────────
// Stable deterministic {dx, dy, angleDeg} per card ID — based on sin hash so it
// never changes for a given card, giving the "human-dealt" Hardwood Solitaire feel.
function cardJitter(id) {
  var a = Math.sin((id + 1) * 127.1)        * 43758.5453;
  var b = Math.sin((id + 1) * 311.7 + 1.0) * 43758.5453;
  var c = Math.sin((id + 1) *  74.3 + 2.0) * 43758.5453;
  var dx    = (a - Math.floor(a)) * 2.0 - 1.0;   // [-1, 1]
  var dy    = (b - Math.floor(b)) * 2.0 - 1.0;   // [-1, 1]
  var aFrac = (c - Math.floor(c)) * 2.0 - 1.0;   // [-1, 1]
  return { dx: dx * 2.4, dy: dy * 2.4, angleDeg: aFrac * 1.5 };
}

// Returns a stable 0–1 "worn-ness" factor per card id (sin-hash, same approach
// as cardJitter). 0 = pristine, 1 = very worn. Cards vary across the deck to
// simulate a set that's been shuffled many times with uneven wear.
function cardAge(id) {
  if (DECK_AGE <= 0) return 0;
  var h = Math.sin((id + 1) * 209.3 + 5.7) * 43758.5453;
  return (h - Math.floor(h)) * DECK_AGE;  // per-card variation scaled by DECK_AGE
}

function _rotPt(ptx, pty, cx, cy, cosA, sinA) {
  var rx = ptx - cx; var ry = pty - cy;
  return { x: cx + rx * cosA - ry * sinA, y: cy + rx * sinA + ry * cosA };
}

// Smooth rounded-rect polygon (N arc steps per corner) rotated around card centre.
// 4 corners × (N+1) points = 28-point polygon — visually indistinguishable from
// pushMaskRoundedRect, but supports arbitrary rotation via _rotPt.
function roundedRectPoly(x, y, w, h, r, cx, cy, cosA, sinA) {
  var pts = [];
  var N = 6; // arc subdivisions per corner
  // Each entry: [corner-centre x, corner-centre y, start angle (rad), end angle (rad)]
  // Angles measured in screen coords (y-down): 0=right, π/2=down, π=left, 3π/2=up.
  var corners = [
    [x+r,   y+r,   Math.PI,       3*Math.PI/2],  // top-left
    [x+w-r, y+r,   3*Math.PI/2,   2*Math.PI  ],  // top-right
    [x+w-r, y+h-r, 0,             Math.PI/2  ],  // bottom-right
    [x+r,   y+h-r, Math.PI/2,     Math.PI    ],  // bottom-left
  ];
  for (var ci = 0; ci < 4; ci++) {
    var ocx = corners[ci][0]; var ocy = corners[ci][1];
    var a0  = corners[ci][2]; var a1  = corners[ci][3];
    for (var s = 0; s <= N; s++) {
      var a = a0 + (a1 - a0) * s / N;
      pts.push(_rotPt(ocx + Math.cos(a) * r, ocy + Math.sin(a) * r, cx, cy, cosA, sinA));
    }
  }
  return pts;
}

// ─── Card drawing ─────────────────────────────────────────────────────────────
// drawCard renders a single playing card at (x, y) using ui primitives only.
// faceUp=true draws front; false draws back (double-border frame + crosshatch).
// Optional jitter: { dx, dy, angleDeg } — positional + rotational deviation.
function drawCard(pal, x, y, cw, ch, radius, cardObj, isDragging, jitter, age) {
  var id = cardObj ? cardObj.id : -1;
  var faceUp = cardObj ? cardObj.faceUp : false;
  var _age = (age > 0) ? Math.min(age, 1.0) : 0;

  // Stable positional + rotational deviation (simulates human-dealt card placement).
  var jx = jitter ? x + (jitter.dx || 0) : x;
  var jy = jitter ? y + (jitter.dy || 0) : y;
  var angDeg = (jitter && !isDragging) ? (jitter.angleDeg || 0) : 0;
  var angRad = angDeg * Math.PI / 180;
  var cosA = Math.cos(angRad); var sinA = Math.sin(angRad);
  var jcx = jx + cw * 0.5; var jcy = jy + ch * 0.5;

  // Drag lift: scale the card up ~4% when being dragged, simulating it held above the
  // felt. The card grows outward from the pick-up centre point. jx/jy/cw/ch are all
  // local copies so this is safe; jcx/jcy are recomputed after rounding.
  if (isDragging) {
    var _liftS = 1.04;
    cw = Math.round(cw * _liftS);
    ch = Math.round(ch * _liftS);
    jx = Math.round(jcx - cw * 0.5);
    jy = Math.round(jcy - ch * 0.5);
    jcx = jx + cw * 0.5;
    jcy = jy + ch * 0.5;
  }

  // Shadow — three-layer spread when dragging (simulates card ~15px above the felt);
  // single tight rect when at rest. Offsets and alphas chosen so the total perceived
  // shadow density is comparable to the resting shadow despite the larger spread.
  if (isDragging) {
    ui.rect(jx + 14, jy + 18, cw, ch, ui.colors.rgba(0, 0, 0, 3));  // wide penumbra
    ui.rect(jx + 10, jy + 13, cw, ch, ui.colors.rgba(0, 0, 0, 5));  // mid shadow
    ui.rect(jx + 6,  jy + 8,  cw, ch, ui.colors.rgba(0, 0, 0, 8));  // umbra core
  } else {
    ui.rect(jx + 3, jy + 3, cw, ch, pal.cardShadow);
  }

  // Set material before the mask so ALL draws inside (base, vignette strips,
  // sepia overlays, text glyphs) share the same flat-or-bumpy surface intent.
  // Material is now sticky — one call covers everything until the next setMaterial.
  if (faceUp && id >= 0) {
    // Card face: subtle paper relief — Sobel picks up the card border, text, and
    // vignette edges as very gentle ridges. normalScale:0.12 is enough to feel
    // slightly textured without looking bumpy. roughness:0.55 → soft diffuse roll.
    ui.setMaterial({ roughness: 0.55, normalScale: 0.18 });
  } else {
    // Card back: slightly smoother than the face (laminated surface).
    // A little normalScale lets the center panel edge and border show as a
    // faint raised frame under raking light. Low roughness → visible gloss.
    ui.setMaterial({ roughness: 0.3, normalScale: 0.18 });
  }

  // Card mask — rotated beveled polygon when angle is significant, else rounded rect
  if (Math.abs(angDeg) > 0.05) {
    ui.pushMaskPolygon(roundedRectPoly(jx, jy, cw, ch, radius, jcx, jcy, cosA, sinA));
  } else {
    ui.pushMaskRoundedRect(jx, jy, cw, ch, radius);
  }

  if (faceUp && id >= 0) {
    // ── Face ──────────────────────────────────────────────────────
    ui.rect(jx, jy, cw, ch, pal.cardFace);
    // Sepia yellowing: warm amber wash over the face paper — quadratic so young
    // cards stay white and only well-worn cards show a visible warm cast.
    if (_age > 0) {
      ui.rect(jx, jy, cw, ch, ui.colors.rgba(200, 160, 80, Math.round(_age * _age * 36)));
    }

    var suit = cardSuit(id);
    var rank = cardRank(id);
    var ink = SUIT_RED[suit] ? pal.red : pal.black;
    var rankStr = rankLabel(rank);
    var suitStr = suitLabel(suit);

    // Corner rank label (top-left)
    ui.text(rankStr, jx + 4, jy + 3, ink);
    ui.text(suitStr, jx + 4, jy + 3 + (ui.metrics.charHeight || 14), ink);

    // Center suit symbol — scaled up, centered using measured width
    var _mw = ui.metrics.measureTextWidth ? ui.metrics.measureTextWidth : function(s) { return (ui.metrics.charWidth || 10) * s.length; };
    var centerScale = 1.6;
    var cx3 = jx + Math.floor((cw - _mw(suitStr) * centerScale) * 0.5);
    var cy3 = jy + Math.floor((ch - (ui.metrics.charHeight || 14) * centerScale) * 0.5) - 2;
    ui.text(suitStr, cx3, cy3, ink, centerScale);

    // Bottom-right corner — right-aligned using measured widths
    var bry = jy + ch - 4 - (ui.metrics.charHeight || 14) * 2;
    ui.text(rankStr, jx + cw - 4 - _mw(rankStr), bry, ink);
    ui.text(suitStr, jx + cw - 4 - _mw(suitStr), bry + (ui.metrics.charHeight || 14), ink);

    // Foxing / age spots on card face: tiny warm-brown marks scattered across
    // the print. Count grows cubically with age; placed before the vignette so
    // edge marks are naturally darkened by it. Two hues alternate (foxing =
    // warm amber, stain = cooler brown).
    if (_age > 0) {
      var _fN = Math.round(_age * _age * _age * 50);
      var _fhs = ((id * 2654435761) >>> 0);
      for (var _fi = 0; _fi < _fN; _fi++) {
        _fhs = ((_fhs * 1664525 + 1013904223) >>> 0);  var _fx = jx + Math.round((_fhs / 4294967296) * (cw - 4));
        _fhs = ((_fhs * 1664525 + 1013904223) >>> 0);  var _fy = jy + Math.round((_fhs / 4294967296) * (ch - 4));
        _fhs = ((_fhs * 1664525 + 1013904223) >>> 0);  var _fw = 1 + Math.round((_fhs / 4294967296) * 2.5);
        _fhs = ((_fhs * 1664525 + 1013904223) >>> 0);  var _ft = 1 + Math.round((_fhs / 4294967296) * 2.5);
        _fhs = ((_fhs * 1664525 + 1013904223) >>> 0);
        var _fa = Math.round((0.08 + (_fhs / 4294967296) * 0.22) * _age * 255);
        _fhs = ((_fhs * 1664525 + 1013904223) >>> 0);
        var _fc = (_fhs / 4294967296) > 0.55
          ? ui.colors.rgba(175, 135, 58, _fa)   // warm foxing
          : ui.colors.rgba(110, 82, 48, _fa);    // cooler stain
        ui.rect(_fx, _fy, _fw, _ft, _fc);
      }
    }

    // Edge vignette: N graduated strips per edge with cubic alpha falloff.
    // Each strip is ~3px thick; the alpha steps from ~48 at the card edge
    // down to ~0 at vDepth pixels in. Corners double-overlap (top+left strips
    // composite together) giving ~32% darkening there vs ~19% on a plain edge —
    // matching the natural laminate curvature of a real card.
    // 16 strips per edge (64 rect calls total per card).
    var vDepth = Math.max(5, Math.round(Math.min(cw, ch) * 0.50));
    var vN = 16; var vBaseA = 48;
    for (var vi = 0; vi < vN; vi++) {
      var vt = (vN - vi) / vN;                   // 1.0 at outermost, steps to 0
      var va = Math.round(vBaseA * vt * vt * vt); // cubic: fast fade, subtle tail
      if (va < 1) continue;
      var vc = ui.colors.rgba(75, 70, 0, va);
      var vd0 = Math.round(vi       * vDepth / vN);
      var vd1 = Math.round((vi + 1) * vDepth / vN);
      var vth = Math.max(1, vd1 - vd0);
      ui.rect(jx,             jy + vd0,       cw,  vth, vc);  // top
      ui.rect(jx,             jy+ch-vd0-vth,  cw,  vth, vc);  // bottom
      ui.rect(jx + vd0,       jy,             vth, ch,  vc);  // left
      ui.rect(jx+cw-vd0-vth,  jy,             vth, ch,  vc);  // right
    }

  } else {
    // ── Back: off-white base, accent1 center panel, icon glyph ───
    ui.rect(jx, jy, cw, ch, pal.cardBack);
    // Sepia yellowing on the border area — same formula as face
    if (_age > 0) {
      ui.rect(jx, jy, cw, ch, ui.colors.rgba(200, 160, 80, Math.round(_age * _age * 36)));
    }
    // Inset center panel
    var bMarX = Math.max(5, Math.round(cw * 0.12));
    var bMarY = Math.max(5, Math.round(ch * 0.12));
    var bPanX = jx + bMarX;  var bPanY = jy + bMarY;
    var bPanW = cw - bMarX * 2;  var bPanH = ch - bMarY * 2;
    ui.rect(bPanX, bPanY, bPanW, bPanH, pal.cardBackInv);
    // Glyph centered in the panel at 25% of its panel-filling scale.
    // Use measureTextWidth for the actual emoji render width (may exceed charWidth),
    // which is why the old _bCw-based centering drifted rightward.
    var _bCh = ui.metrics.charHeight || 14;
    var char = '⚜';
    var _bGW = ui.metrics.measureTextWidth(char) || (ui.metrics.charWidth || 10);
    var _bFillScale = Math.min(bPanW / _bGW, bPanH / _bCh);
    var _bScale = _bFillScale * 0.95;
    ui.text(char, bPanX + Math.floor((bPanW - _bGW * _bScale) * 0.5),
                  bPanY + Math.floor((bPanH - _bCh * _bScale) * 0.5),
                  pal.cardBack, _bScale);

    // Age spots — border margin only so they don't obscure the panel glyph
    if (_age > 0) {
      var _bN = Math.round(_age * _age * _age * 35);
      var _bhs = ((id * 2654435761 + 9999) >>> 0);
      for (var _bi = 0; _bi < _bN; _bi++) {
        _bhs = ((_bhs * 1664525 + 1013904223) >>> 0);  var _bsx = _bhs / 4294967296;
        _bhs = ((_bhs * 1664525 + 1013904223) >>> 0);  var _bsy = _bhs / 4294967296;
        _bhs = ((_bhs * 1664525 + 1013904223) >>> 0);  var _bw = 1 + Math.round((_bhs / 4294967296) * 2.0);
        _bhs = ((_bhs * 1664525 + 1013904223) >>> 0);  var _bt = 1 + Math.round((_bhs / 4294967296) * 2.0);
        _bhs = ((_bhs * 1664525 + 1013904223) >>> 0);
        var _ba = Math.round((0.06 + (_bhs / 4294967296) * 0.18) * _age * 255);
        // Map into card coords; skip spots that fall inside the center panel
        var _bx = jx + Math.round(_bsx * (cw - 3));
        var _by = jy + Math.round(_bsy * (ch - 3));
        if (_bx >= bPanX && _bx < bPanX + bPanW && _by >= bPanY && _by < bPanY + bPanH) continue;
        ui.rect(_bx, _by, _bw, _bt, ui.colors.rgba(140, 120, 90, _ba));
      }
    }

    // Edge vignette — same cubic fade as card face
    var vDepth = Math.max(5, Math.round(Math.min(cw, ch) * 0.40));
    var vN = 16; var vBaseA = 48;
    for (var vi = 0; vi < vN; vi++) {
      var vt = (vN - vi) / vN;
      var va = Math.round(vBaseA * vt * vt * vt);
      if (va < 1) continue;
      var vc = ui.colors.rgba(0, 0, 0, va);
      var vd0 = Math.round(vi       * vDepth / vN);
      var vd1 = Math.round((vi + 1) * vDepth / vN);
      var vth = Math.max(1, vd1 - vd0);
      ui.rect(jx,             jy + vd0,       cw,  vth, vc);
      ui.rect(jx,             jy+ch-vd0-vth,  cw,  vth, vc);
      ui.rect(jx + vd0,       jy,             vth, ch,  vc);
      ui.rect(jx+cw-vd0-vth,  jy,             vth, ch,  vc);
    }
  }

  ui.popMask();
}

// Empty slot placeholder (for foundations and tableau empty columns)
function drawEmptySlot(pal, x, y, cw, ch, radius, label) {
  ui.pushMaskRoundedRect(x, y, cw, ch, radius);
  ui.rect(x, y, cw, ch, pal.slotFill);
  // Border inside mask so it clips to rounded corners
  ui.rect(x,          y,          cw, 1,  pal.slotBorder);
  ui.rect(x,          y + ch - 1, cw, 1,  pal.slotBorder);
  ui.rect(x,          y,          1,  ch, pal.slotBorder);
  ui.rect(x + cw - 1, y,          1,  ch, pal.slotBorder);
  ui.popMask();
  if (label) {
    var lx = x + Math.floor((cw - (ui.metrics.charWidth || 10) * label.length) * 0.5);
    var ly = y + Math.floor((ch - (ui.metrics.charHeight || 14)) * 0.5);
    ui.text(label, lx, ly, pal.slotBorder);
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────
function drawGame(L, pal) {
  var g = scope.gs;
  var cw = L.cw; var ch = L.ch; var r = L.radius;

  // Paper texture background – tiled at native image resolution.
  // Falls back to a solid felt colour while the texture is loading (or if unavailable).
  var _bgId = scope._bgTexId;
  var _bgW  = scope._bgTexW;
  var _bgH  = scope._bgTexH;
  if (!scope.__bgLogged && _bgId) {
    console.log('[klondike] drawGame: bgId=' + _bgId + ' bgW=' + _bgW + ' bgH=' + _bgH);
    scope.__bgLogged = true;
  }
  if (_bgId && _bgW > 0 && _bgH > 0) {
    // Background texture: full Sobel bump on the wood/cloth image.
    // roughness:0.9 → low roughDepth Z → steep gradients → noticeable ridge relief.
    // normalScale:1.0 → Sobel gradients fully unscaled.
    ui.setMaterial({ roughness: 0.9, normalScale: 1.0 });
    // Compute blended tint: lerp each channel from 255 (white = no-op) toward pal.felt.
    var _ft = Math.max(0, Math.min(1, FELT_TINT));
    var _fR = (_ft <= 0) ? 255 : Math.round(255 + (((pal.felt >>> 24) & 255) - 255) * _ft);
    var _fG = (_ft <= 0) ? 255 : Math.round(255 + (((pal.felt >>> 16) & 255) - 255) * _ft);
    var _fB = (_ft <= 0) ? 255 : Math.round(255 + (((pal.felt >>>  8) & 255) - 255) * _ft);
    var _bgTint = ui.colors.rgba(_fR, _fG, _fB, 255);
    // Scaled tile dimensions: native size × BG_SCALE. Loop step uses scaled size;
    // UV crop fractions are relative to the scaled tile so edges stay seamless.
    var _bgTW = Math.max(1, Math.round(_bgW * BG_SCALE));
    var _bgTH = Math.max(1, Math.round(_bgH * BG_SCALE));
    for (var _ty = 0; _ty < L.H; _ty += _bgTH) {
      for (var _tx = 0; _tx < L.W; _tx += _bgTW) {
        var _tw = Math.min(_bgTW, L.W - _tx);
        var _th = Math.min(_bgTH, L.H - _ty);
        if (_tw === _bgTW && _th === _bgTH) {
          ui.image(_bgId, _tx, _ty, _bgTW, _bgTH, { tint: _bgTint });
        } else {
          // Partial tile at right/bottom edges – draw with a cropped UV region.
          ui.image(_bgId, _tx, _ty, _tw, _th, { tint: _bgTint, uv: { u: 0, v: 0, w: _tw / _bgTW, h: _th / _bgTH } });
        }
      }
    }
  } else {
    // Solid felt fallback: rough textile. normalScale:1.0 ready for when a
    // patterned felt texture is added; solid color has no Sobel gradient so
    // it renders flat either way.
    ui.setMaterial({ roughness: 0.95, normalScale: 1.0 });
    ui.rect(0, 0, L.W, L.H, pal.felt);
  }

  // ── Top row ──────────────────────────────────────────────────────────────────

  // Stock pile
  var stockX = L.topRowXs[0]; var topY = L.topRowY;
  if (g.stock.length > 0) {
    drawCard(pal, stockX, topY, cw, ch, r, { id: 0, faceUp: false }, false);
    // Small count badge
    var countStr = String(g.stock.length);
    ui.text(countStr, stockX + cw - (ui.metrics.charWidth || 10) * countStr.length - 4,
            topY + 4, pal.dimText);
  } else {
    drawEmptySlot(pal, stockX, topY, cw, ch, r, '↺');
  }

  // Waste pile (show top card, peek second)
  var wasteX = L.topRowXs[1];
  if (g.waste.length > 1) {
    // Peek — slightly offset, face down visually shows as face up (it's been dealt)
    drawCard(pal, wasteX + 3, topY + 2, cw, ch, r,
             { id: g.waste[g.waste.length - 2].id, faceUp: true }, false,
             null, cardAge(g.waste[g.waste.length - 2].id));
  }
  if (g.waste.length > 0) {
    drawCard(pal, wasteX, topY, cw, ch, r, g.waste[g.waste.length - 1], false,
             null, cardAge(g.waste[g.waste.length - 1].id));
  } else {
    drawEmptySlot(pal, wasteX, topY, cw, ch, r, '');
  }

  // Foundations (slots 3-6, one per suit)
  for (var f = 0; f < 4; f++) {
    var fx = L.topRowXs[3 + f];
    var fnd = g.foundations[f];
    if (fnd.length > 0) {
      drawCard(pal, fx, topY, cw, ch, r, fnd[fnd.length - 1], false,
               null, cardAge(fnd[fnd.length - 1].id));
    } else {
      drawEmptySlot(pal, fx, topY, cw, ch, r, SUITS[f]);
    }
  }

  // ── Tableau ───────────────────────────────────────────────────────────────────
  for (var col = 0; col < NUM_TABLEAU; col++) {
    var cx2 = L.topRowXs[col];
    var pile = g.tableau[col];

    if (pile.length === 0) {
      drawEmptySlot(pal, cx2, L.tableauY, cw, ch, r, '');
      continue;
    }

    var rects2 = tableauCardRects(pile, cx2, L);
    for (var ci2 = 0; ci2 < pile.length; ci2++) {
      // Skip cards that are currently being dragged
      if (g.drag && g.drag.fromPile === pile && ci2 >= g.drag.fromIndex) continue;
      drawCard(pal, rects2[ci2].x, rects2[ci2].y, cw, ch, r, pile[ci2], false, cardJitter(pile[ci2].id), cardAge(pile[ci2].id));
    }
  }

  // ── Dragged cards (drawn on top of everything) ────────────────────────────────
  if (g.drag) {
    var dy2 = g.drag.y;
    for (var dc = 0; dc < g.drag.cards.length; dc++) {
      drawCard(pal, g.drag.x, dy2, cw, ch, r, g.drag.cards[dc], dc === 0,
               null, cardAge(g.drag.cards[dc].id));
      dy2 += L.faceUpOffset;
    }
  }

  // ── Status bar ──────────────────────────────────────────────────────────────
  var statStr = 'Moves: ' + g.moveCount;
  if (g.won) statStr = '✓ You won! (' + g.moveCount + ' moves)';
  var sColor = g.won ? pal.wonBanner : pal.dimText;
  ui.text(statStr, L.hPad, L.H - (ui.metrics.charHeight || 14) - 4, sColor);

  // Seed display (bottom-center)
  var seedStr = 'Seed: ' + g.seed;
  var _mwFn = ui.metrics.measureTextWidth ? ui.metrics.measureTextWidth : function(s) { return (ui.metrics.charWidth || 10) * s.length; };
  ui.text(seedStr,
    Math.floor((L.W - _mwFn(seedStr)) * 0.5),
    L.H - (ui.metrics.charHeight || 14) - 4,
    pal.dimText);

  // Hint: Replay and New Game buttons
  var _bH   = (ui.metrics.charHeight || 14) * 2 + 4;
  var _bW   = Math.max(90, (ui.metrics.charWidth || 10) * 10);
  var _gap  = 6;
  var _bY   = L.H - _bH - 4;
  ui.button('btn-replay-game',
    L.W - L.hPad - (_bW * 2 + _gap),
    _bY, _bW, _bH, 'Replay');
  ui.button('btn-new-game',
    L.W - L.hPad - _bW,
    _bY, _bW, _bH, 'New Game');
}
```

```js on:init
term.layerID = 'default';
term.clear();
newGame(); // fresh random seed on first load
scope._layout   = null;
scope._bgTexId  = null;  // paper texture image id once loaded
scope._bgTexW   = 0;
scope._bgTexH   = 0;
// Kick off async texture load.
ui.loadImageFromURL('assets/img/Moss002_1K.jpg').then(function(id) {
  console.log('[klondike] bg texture load result:', id);
  if (!id) { console.warn('[klondike] bg texture failed to load'); return; }
  scope._bgTexId = id;
  var sz = ui.getImageSize(id);
  console.log('[klondike] bg texture size:', sz);
  if (sz) { scope._bgTexW = sz.width; scope._bgTexH = sz.height; }
});
```

```js on:update
if (!scope.gs) { newGame(); return; }

var L = computeLayout();
scope._layout = L;

// ── Mouse light-follow ───────────────────────────────────────────────────────
var _mW = ui.metrics.canvasWidth  || 1280;
var _mH = ui.metrics.canvasHeight || 720;
//shader.setUniform('lightsobel', 'lightX', ui.pointer.x() / _mW);
//shader.setUniform('lightsobel', 'lightY', ui.pointer.y() / _mH);
//shader.setUniform('lightsoft', 'lightX', ui.pointer.x() / _mW);
//shader.setUniform('lightsoft', 'lightY', ui.pointer.y() / _mH);
// ── End mouse light-follow ────────────────────────────────────────────────────

// Handle Replay / New Game button clicks
var _bH2   = (ui.metrics.charHeight || 14) * 2 + 4;
var _bW2   = Math.max(90, (ui.metrics.charWidth || 10) * 10);
var _gap2  = 6;
var _bY2   = L.H - _bH2 - 4;
if (ui.button('btn-replay-game',
    L.W - L.hPad - (_bW2 * 2 + _gap2),
    _bY2, _bW2, _bH2, 'Replay')) {
  newGame(scope.gs ? scope.gs.seed : undefined);
  scope._layout = null;
  return;
}
if (ui.button('btn-new-game',
    L.W - L.hPad - _bW2,
    _bY2, _bW2, _bH2, 'New Game')) {
  newGame();
  scope._layout = null;
  return;
}

if (!scope.gs.won) {
  handleInput(L);
}
```

```js on:render
if (!scope.gs) return;

term.clear();
ui.clear();

var L = scope._layout || computeLayout();
var pal = getPalette();

try {
  drawGame(L, pal);
} catch(_e) {
  // Keep UI alive if rendering fails
  ui.clear(pal.felt);
  var now = Date.now();
  scope._lastErrAt = scope._lastErrAt || 0;
  if (now - scope._lastErrAt > 1000) {
    scope._lastErrAt = now;
    try { console.warn('[klondike] render error:', _e); } catch { /* ignore */ }
  }
}
```
