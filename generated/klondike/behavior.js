export const behaviorBlocks = [
  {
    "id": "block-1",
    "hook": "enter",
    "startLine": 10,
    "endLine": 15,
    "sectionRef": "play-8",
    "targetSectionRef": null,
    "metadata": {
      "on": "enter"
    },
    "code": "scope.sections = scope.sections || {};\nif (typeof worlds.currentSection === 'number') {\n  scope.sections.play = worlds.currentSection;\n}"
  },
  {
    "id": "block-2",
    "hook": "enter",
    "startLine": 31,
    "endLine": 37,
    "sectionRef": "settings-17",
    "targetSectionRef": null,
    "metadata": {
      "on": "enter"
    },
    "code": "scope.sections = scope.sections || {};\nif (typeof worlds.currentSection === 'number') {\n  scope.sections.settings = worlds.currentSection;\n}\nsyncSettingsWidgets();"
  },
  {
    "id": "block-3",
    "hook": "enter",
    "startLine": 54,
    "endLine": 59,
    "sectionRef": "help-39",
    "targetSectionRef": null,
    "metadata": {
      "on": "enter"
    },
    "code": "scope.sections = scope.sections || {};\nif (typeof worlds.currentSection === 'number') {\n  scope.sections.help = worlds.currentSection;\n}"
  },
  {
    "id": "block-4",
    "hook": "global",
    "startLine": 61,
    "endLine": 1053,
    "sectionRef": "help-39",
    "targetSectionRef": null,
    "metadata": {},
    "code": "// ─── Constants ────────────────────────────────────────────────────────────────\nvar SUITS       = ['♠','♥','♦','♣'];   // spade, heart, diamond, club\nvar RANKS       = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];\nvar SUIT_RED    = [false, true, true, false]; // index matches SUITS\nvar NUM_TABLEAU = 7;\nvar STOCK_DEAL  = 1;   // cards dealt per click (set to 3 for draw-3 variant)\nvar DECK_AGE    = 1.0; // 0 = pristine (no aging), 1 = very worn; scales all card age effects\nvar JITTER       = 1.0; // positional and angular scatter scale; 0 = none, 1 = default, 3 = chaotic\nvar JITTER_STEPS = [0, 0.5, 1.0, 2.0, 3.0];   // scale factors per step\nvar JITTER_NAMES = ['None', 'Subtle', 'Normal', 'Wild', 'Chaotic'];\n\n\n// ─── Card helpers ─────────────────────────────────────────────────────────────\nfunction cardId(suit, rank) { return suit * 13 + rank; }         // 0-51\nfunction cardSuit(id)       { return Math.floor(id / 13); }      // 0-3\nfunction cardRank(id)       { return id % 13; }                  // 0-12\nfunction isRed(id)          { return SUIT_RED[cardSuit(id)]; }\nfunction rankLabel(r)       { return RANKS[r]; }\nfunction suitLabel(s)       { return SUITS[s]; }\nfunction cardLabel(id)      { return rankLabel(cardRank(id)) + suitLabel(cardSuit(id)); }\n\nfunction shuffledDeck(rng) {\n  var deck = [];\n  for (var i = 0; i < 52; i++) deck.push(i);\n  // Seeded Fisher-Yates\n  for (var i2 = deck.length - 1; i2 > 0; i2--) {\n    var j = Math.floor(rng() * (i2 + 1));\n    var tmp = deck[i2]; deck[i2] = deck[j]; deck[j] = tmp;\n  }\n  return deck;\n}\n\n// ─── Game state ───────────────────────────────────────────────────────────────\n// Each \"slot\" is an array of { id, faceUp } objects.\n// Foundations: 4 piles (one per suit), ace-to-king.\n// Tableau: 7 columns. Stock: face-down draw pile. Waste: face-up discard.\nscope.gs = scope.gs || null;\n\n// newGame(seed?) — pass a seed to replay a known game, or omit for a fresh random one.\nfunction newGame(seed) {\n  var useSeed = (seed !== undefined && seed !== null) ? (seed >>> 0) : random.seed();\n  var rng = random.rng(useSeed);\n  var deck = shuffledDeck(rng);\n  var di = 0;\n\n  var tableau = [];\n  for (var col = 0; col < NUM_TABLEAU; col++) {\n    var pile = [];\n    for (var row = 0; row <= col; row++) {\n      pile.push({ id: deck[di++], faceUp: row === col });\n    }\n    tableau.push(pile);\n  }\n\n  var stock = [];\n  while (di < 52) stock.push({ id: deck[di++], faceUp: false });\n\n  scope.gs = {\n    tableau:     tableau,\n    foundations: [[], [], [], []],\n    stock:       stock,\n    waste:       [],\n    drag:        null,   // { cards, fromPile, fromIndex, ox, oy, x, y }\n    dblTap:      null,   // { id, at } — for double-click detection\n    won:         false,\n    moveCount:   0,\n    seed:        useSeed,\n  };\n}\n\n// ─── Move validation ──────────────────────────────────────────────────────────\nfunction canPlaceOnFoundation(card, foundation) {\n  var suit = cardSuit(card.id);\n  if (foundation.length === 0) return cardRank(card.id) === 0;  // must be Ace\n  var top = foundation[foundation.length - 1];\n  return cardSuit(top.id) === suit && cardRank(top.id) === cardRank(card.id) - 1;\n}\n\nfunction canPlaceOnTableau(card, column) {\n  if (column.length === 0) return cardRank(card.id) === 12;  // only King on empty\n  var top = column[column.length - 1];\n  if (!top.faceUp) return false;\n  return isRed(card.id) !== isRed(top.id) && cardRank(top.id) === cardRank(card.id) + 1;\n}\n\n// Try to auto-move a card to the best foundation. Returns true if moved.\nfunction autoToFoundation(card, fromPile, fromIndex) {\n  var suit = cardSuit(card.id);\n  var found = scope.gs.foundations[suit];\n  if (!canPlaceOnFoundation(card, found)) return false;\n  fromPile.splice(fromIndex, 1);\n  found.push({ id: card.id, faceUp: true });\n  // Flip new top of source column\n  if (fromPile.length > 0 && !fromPile[fromPile.length - 1].faceUp) {\n    fromPile[fromPile.length - 1].faceUp = true;\n  }\n  scope.gs.moveCount++;\n  checkWin();\n  return true;\n}\n\nfunction checkWin() {\n  var g = scope.gs;\n  for (var s = 0; s < 4; s++) {\n    if (g.foundations[s].length < 13) return;\n  }\n  g.won = true;\n}\n\n// ─── Layout ────────────────────────────────────────────────────────────────────\n// Returns a layout descriptor based on current canvas size.\n// All coordinates in physical pixels (what ui.rect uses).\nfunction computeLayout() {\n  var W  = ui.metrics.canvasWidth  || 1280;\n  var H  = ui.metrics.canvasHeight || 720;\n  var portrait = H > W;\n\n  // Card dimensions: standard 2.5:3.5 ratio, scaled to fit.\n  var cols   = NUM_TABLEAU;                                     // 7 tableau columns\n  var hPad   = portrait ? Math.floor(W * 0.025) : Math.floor(W * 0.022);\n  var vPad   = portrait ? Math.floor(H * 0.025) : Math.floor(H * 0.028);\n  var colGap = Math.floor(hPad * 0.6);\n  var cw     = Math.floor((W - hPad * 2 - colGap * (cols - 1)) / cols);\n  var ch     = Math.round(cw * (3.5 / 2.5));\n  // Clamp card size for very large or very small screens\n  var maxCH  = portrait ? Math.floor(H * 0.22) : Math.floor(H * 0.28);\n  if (ch > maxCH) { ch = maxCH; cw = Math.round(ch * (2.5 / 3.5)); }\n\n  // Vertical card offset within a tableau column (how much of card is exposed).\n  // Clamp to available height so the deepest initial column (col 7: 6 stacked\n  // cards + 1 face-up top) always fits on screen regardless of window shape.\n  // tableauY = 2*vPad + ch, so available height = H - tableauY - vPad - ch\n  //                                              = H - 3*vPad - 2*ch\n  var tableauAvailH = H - 3 * vPad - 2 * ch;\n  var maxColOffset  = tableauAvailH > 0 ? Math.floor(tableauAvailH / 6) : 10;\n  var stackOffset   = Math.min(Math.max(Math.round(ch * 0.28), 18), maxColOffset);\n  var faceUpOffset  = Math.min(Math.max(Math.round(ch * 0.38), 24), maxColOffset);\n  faceUpOffset = Math.max(faceUpOffset, stackOffset); // never collapse below stack\n\n  // Top row: stock (col 0), waste (col 1), gap, foundations (cols 3-6)\n  var topRowY = vPad;\n  var topRowXs = [];\n  for (var ci = 0; ci < cols; ci++) {\n    topRowXs.push(hPad + ci * (cw + colGap));\n  }\n\n  // Tableau starts below top row\n  var tableauY = topRowY + ch + vPad;\n\n  return {\n    W: W, H: H,\n    cw: cw, ch: ch,\n    hPad: hPad, vPad: vPad, colGap: colGap,\n    topRowY: topRowY,\n    topRowXs: topRowXs,\n    tableauY: tableauY,\n    stackOffset: stackOffset,\n    faceUpOffset: faceUpOffset,\n    radius: Math.max(3, Math.round(cw * 0.07)),\n  };\n}\nscope._layout = null;\n\n// ─── Hit testing ──────────────────────────────────────────────────────────────\n// Returns { zone, pileKey, index } or null.\n//   zone: 'stock' | 'waste' | 'foundation' | 'tableau'\n//   pileKey: foundation index or tableau col index\n//   index: card index within pile (-1 = empty slot)\nfunction hitTest(px, py, layout) {\n  var L = layout;\n  var cw = L.cw; var ch = L.ch;\n\n  // Stock\n  if (px >= L.topRowXs[0] && px < L.topRowXs[0] + cw &&\n      py >= L.topRowY    && py < L.topRowY + ch) {\n    return { zone: 'stock', pileKey: 0, index: -1 };\n  }\n  // Waste\n  if (px >= L.topRowXs[1] && px < L.topRowXs[1] + cw &&\n      py >= L.topRowY    && py < L.topRowY + ch) {\n    return { zone: 'waste', pileKey: 0, index: scope.gs.waste.length - 1 };\n  }\n  // Foundations (slots 3-6)\n  for (var f = 0; f < 4; f++) {\n    var fx = L.topRowXs[3 + f];\n    if (px >= fx && px < fx + cw && py >= L.topRowY && py < L.topRowY + ch) {\n      return { zone: 'foundation', pileKey: f, index: scope.gs.foundations[f].length - 1 };\n    }\n  }\n  // Tableau columns\n  for (var col = 0; col < NUM_TABLEAU; col++) {\n    var cx2 = L.topRowXs[col];\n    var pile = scope.gs.tableau[col];\n    // Compute each card's rect (same as draw logic)\n    var cardRects = tableauCardRects(pile, cx2, L);\n    // Hit test from top (visually last) down\n    for (var ci2 = cardRects.length - 1; ci2 >= 0; ci2--) {\n      var r = cardRects[ci2];\n      // Exposed height: to next card or full card if last\n      var expH = (ci2 === cardRects.length - 1) ? ch : cardRects[ci2 + 1].y - r.y;\n      expH = Math.max(expH, 14);\n      if (px >= r.x && px < r.x + cw && py >= r.y && py < r.y + expH) {\n        return { zone: 'tableau', pileKey: col, index: ci2 };\n      }\n    }\n    // Empty column slot\n    if (pile.length === 0 &&\n        px >= cx2 && px < cx2 + cw &&\n        py >= L.tableauY && py < L.tableauY + ch) {\n      return { zone: 'tableau', pileKey: col, index: -1 };\n    }\n  }\n  return null;\n}\n\n// Compute per-column stack/faceUp offsets that guarantee the column fits within\n// the available tableau height. Counts only the n-1 inter-card gaps (the top card\n// needs no offset below it). If the preferred offsets already fit, they're returned\n// unchanged — compression only kicks in when the column is tall enough to overflow.\nfunction colOffsets(pile, L) {\n  var nFD = 0, nFU = 0;\n  for (var i = 0; i < pile.length - 1; i++) {\n    if (pile[i].faceUp) nFU++; else nFD++;\n  }\n  var availH = L.H - L.tableauY - L.vPad - L.ch;\n  if (availH <= 0 || nFD + nFU === 0) return { so: L.stackOffset, fo: L.faceUpOffset };\n  var prefTotal = nFD * L.stackOffset + nFU * L.faceUpOffset;\n  if (prefTotal <= availH) return { so: L.stackOffset, fo: L.faceUpOffset };\n  var scale = availH / prefTotal;\n  return {\n    so: Math.max(8,  Math.floor(L.stackOffset  * scale)),\n    fo: Math.max(10, Math.floor(L.faceUpOffset * scale)),\n  };\n}\n\n// Compute y positions for each card in a tableau column\nfunction tableauCardRects(pile, colX, L) {\n  var rects = [];\n  var y = L.tableauY;\n  var offs = colOffsets(pile, L);\n  for (var i = 0; i < pile.length; i++) {\n    rects.push({ x: colX, y: y });\n    if (i < pile.length - 1) {\n      y += pile[i].faceUp ? offs.fo : offs.so;\n    }\n  }\n  return rects;\n}\n\n// ─── Input handling ────────────────────────────────────────────────────────────\nfunction handleInput(L) {\n  var g = scope.gs;\n  var mx = ui.pointer.x();\n  var my = ui.pointer.y();\n  var clicked = ui.pointer.clicked(0);\n  var down = ui.pointer.down(0);\n  var now = Date.now();\n\n  // ── Drag update ────────────────────────────────────────────────\n  if (g.drag) {\n    g.drag.x = mx - g.drag.ox;\n    g.drag.y = my - g.drag.oy;\n  }\n\n  // ── Release: try to drop dragged cards ─────────────────────────\n  // Use !down while drag is active — matches the minesweeper pointer pattern.\n  if (!down && g.drag) {\n    var dropped = false;\n    var dragCards = g.drag.cards;\n    var topDragCard = dragCards[0];\n\n    // Check foundations (single-card drops only)\n    if (dragCards.length === 1) {\n      for (var f = 0; f < 4; f++) {\n        var fx = L.topRowXs[3 + f];\n        var fy = L.topRowY;\n        if (mx >= fx && mx < fx + L.cw && my >= fy && my < fy + L.ch) {\n          if (canPlaceOnFoundation(topDragCard, g.foundations[f])) {\n            // Remove from source\n            g.drag.fromPile.splice(g.drag.fromIndex, dragCards.length);\n            flipTopIfNeeded(g.drag.fromPile);\n            g.foundations[f].push({ id: topDragCard.id, faceUp: true });\n            g.moveCount++;\n            checkWin();\n            dropped = true;\n          }\n          break;\n        }\n      }\n    }\n\n    // Check tableau columns\n    if (!dropped) {\n      for (var col = 0; col < NUM_TABLEAU; col++) {\n        var cx2 = L.topRowXs[col];\n        var colPile = g.tableau[col];\n        // Generous drop zone: anywhere over the column strip\n        var colTop = L.tableauY;\n        var _coffs = colOffsets(colPile, L);\n        var colBot = colTop + L.ch + colPile.length * _coffs.fo + 40;\n        if (mx >= cx2 && mx < cx2 + L.cw && my >= colTop - 20 && my < colBot) {\n          if (canPlaceOnTableau(topDragCard, colPile)) {\n            g.drag.fromPile.splice(g.drag.fromIndex, dragCards.length);\n            flipTopIfNeeded(g.drag.fromPile);\n            for (var dc = 0; dc < dragCards.length; dc++) {\n              colPile.push({ id: dragCards[dc].id, faceUp: true });\n            }\n            g.moveCount++;\n            dropped = true;\n          }\n          break;\n        }\n      }\n    }\n\n    // Return cards to source if drop failed\n    if (!dropped) {\n      for (var dc2 = 0; dc2 < dragCards.length; dc2++) {\n        g.drag.fromPile.splice(g.drag.fromIndex + dc2, 0, dragCards[dc2]);\n      }\n    }\n\n    g.drag = null;\n    return;\n  }\n\n  // ── Click / press ───────────────────────────────────────────────\n  if (!clicked) return;\n\n  var hit = hitTest(mx, my, L);\n  if (!hit) return;\n\n  // Double-click detection\n  var isDblClick = false;\n  if (g.dblTap && g.dblTap.x === hit.pileKey && g.dblTap.z === hit.zone &&\n      now - g.dblTap.at < 420) {\n    isDblClick = true;\n    g.dblTap = null;\n  } else {\n    g.dblTap = { x: hit.pileKey, z: hit.zone, at: now };\n  }\n\n  // Stock click\n  if (hit.zone === 'stock') {\n    if (g.stock.length > 0) {\n      for (var s2 = 0; s2 < STOCK_DEAL && g.stock.length > 0; s2++) {\n        var card = g.stock.pop();\n        card.faceUp = true;\n        g.waste.push(card);\n      }\n    } else {\n      // Reset: flip waste back to stock\n      while (g.waste.length > 0) {\n        var wc = g.waste.pop();\n        wc.faceUp = false;\n        g.stock.push(wc);\n      }\n    }\n    return;\n  }\n\n  // Waste top card — start drag or double-click auto-move\n  if (hit.zone === 'waste' && g.waste.length > 0) {\n    var wTop = g.waste[g.waste.length - 1];\n    if (isDblClick) {\n      autoToFoundation(wTop, g.waste, g.waste.length - 1);\n      return;\n    }\n    // Start drag\n    var wx = L.topRowXs[1]; var wy = L.topRowY;\n    g.drag = { cards: [wTop], fromPile: g.waste, fromIndex: g.waste.length - 1,\n               ox: mx - wx, oy: my - wy, x: wx, y: wy };\n    g.waste.splice(g.waste.length - 1, 1);\n    return;\n  }\n\n  // Foundation — start drag (move back to tableau)\n  if (hit.zone === 'foundation' && hit.pileKey >= 0) {\n    var fnd = g.foundations[hit.pileKey];\n    if (fnd.length === 0) return;\n    var fCard = fnd[fnd.length - 1];\n    var fCardX = L.topRowXs[3 + hit.pileKey]; var fCardY = L.topRowY;\n    g.drag = { cards: [fCard], fromPile: fnd, fromIndex: fnd.length - 1,\n               ox: mx - fCardX, oy: my - fCardY, x: fCardX, y: fCardY };\n    fnd.splice(fnd.length - 1, 1);\n    return;\n  }\n\n  // Tableau card\n  if (hit.zone === 'tableau') {\n    var tCol  = hit.pileKey;\n    var tPile = g.tableau[tCol];\n    var tIdx  = hit.index;\n    if (tIdx < 0 || tIdx >= tPile.length) return;\n    var tCard = tPile[tIdx];\n    if (!tCard.faceUp) {\n      // Flip face-down top card\n      if (tIdx === tPile.length - 1) tCard.faceUp = true;\n      return;\n    }\n    // Double-click: auto-move single top card to foundation\n    if (isDblClick && tIdx === tPile.length - 1) {\n      autoToFoundation(tCard, tPile, tIdx);\n      return;\n    }\n    // Drag the card and any cards below it (a run)\n    var runCards = tPile.slice(tIdx);\n    var rects2 = tableauCardRects(tPile, L.topRowXs[tCol], L);\n    var startX = rects2[tIdx].x; var startY = rects2[tIdx].y;\n    tPile.splice(tIdx, runCards.length);\n    g.drag = { cards: runCards, fromPile: tPile, fromIndex: tIdx,\n               ox: mx - startX, oy: my - startY, x: startX, y: startY };\n    return;\n  }\n}\n\nfunction flipTopIfNeeded(pile) {\n  if (pile.length > 0 && !pile[pile.length - 1].faceUp) {\n    pile[pile.length - 1].faceUp = true;\n  }\n}\n\n// ─── Palette ──────────────────────────────────────────────────────────────────\n// Card face/ink/back colors are fixed (theme-independent) so cards always look\n// like real playing cards. Only table felt, status text, and UI chrome use theme.\nfunction getPalette() {\n  var base    = getStyle('default');\n  var bgAlt   = getStyle('bgAlt');\n  var accent1 = getStyle('accent1');\n  var dim     = getStyle('dim');\n  var success = getStyle('success');\n  function a(c, alpha) {\n    var r = (c >>> 24) & 255; var g2 = (c >>> 16) & 255;\n    var b2 = (c >>> 8) & 255;\n    return ui.colors.rgba(r, g2, b2, Math.max(0, Math.min(255, Math.round(alpha * 255))));\n  }\n  // Lighten accent1.fg 70% towards white for a pale theme-tinted card back.\n  // Computed as a packed 0xRRGGBBAA int so there's no alpha scaling bug.\n  var _a1 = accent1.fg;\n  var _a1r = (_a1 >>> 24) & 255, _a1g = (_a1 >>> 16) & 255, _a1b = (_a1 >>> 8) & 255;\n  var _lt = 0.70;\n  var _cbR = Math.round(_a1r + (255 - _a1r) * _lt);\n  var _cbG = Math.round(_a1g + (255 - _a1g) * _lt);\n  var _cbB = Math.round(_a1b + (255 - _a1b) * _lt);\n  var _cardBack = ((_cbR & 255) * 0x1000000 + (_cbG & 255) * 0x10000 + (_cbB & 255) * 0x100 + 255) >>> 0;\n\n  return {\n    // Table\n    bg:           base.bg,\n    felt:         a(bgAlt.bg, 1.0),\n    // Card face — fixed warm off-white, fully opaque\n    cardFace:     ui.colors.rgba(250, 248, 242, 255),\n    // Card back — accent1 lightened 70% towards white, with full accent1 panel.\n    // Both are packed 0xRRGGBBAA integers to avoid the legacy alpha scaling bug.\n    cardBack:    _cardBack,   // pale accent1 tint\n    cardBackInv: accent1.fg,  // full accent1 for center panel\n    // Borders — fixed grays\n    cardBorder:   ui.colors.rgba(160, 154, 142, 255),\n    cardBorderSel:a(accent1.fg, 1.0),\n    // Shadow — fixed dark, fully opaque\n    cardShadow:   ui.colors.rgba(0,   0,   0,  10),\n    // Suit ink — fixed classic red and near-black\n    red:          ui.colors.rgba(196,  28,  28, 255),\n    black:        ui.colors.rgba(18,   18,  22, 255),\n    // Slots\n    slotBorder:   a(base.fg, 0.20),\n    slotFill:     a(base.fg, 0.06),\n    // UI chrome\n    wonBanner:    a(success.fg, 0.95),\n    dimText:      a(dim.fg, 0.85),\n  };\n}\n\n// ─── Card jitter helpers ──────────────────────────────────────────────────────\n// Stable deterministic {dx, dy, angleDeg} per card ID — based on sin hash so it\n// never changes for a given card, giving the \"human-dealt\" Hardwood Solitaire feel.\nfunction cardJitter(id) {\n  var a = Math.sin((id + 1) * 127.1)        * 43758.5453;\n  var b = Math.sin((id + 1) * 311.7 + 1.0) * 43758.5453;\n  var c = Math.sin((id + 1) *  74.3 + 2.0) * 43758.5453;\n  var dx    = (a - Math.floor(a)) * 2.0 - 1.0;   // [-1, 1]\n  var dy    = (b - Math.floor(b)) * 2.0 - 1.0;   // [-1, 1]\n  var aFrac = (c - Math.floor(c)) * 2.0 - 1.0;   // [-1, 1]\n  return { dx: dx * 2.4 * JITTER, dy: dy * 2.4 * JITTER, angleDeg: aFrac * 1.5 * JITTER };\n}\n\n// Returns a stable 0–1 \"worn-ness\" factor per card id (sin-hash, same approach\n// as cardJitter). 0 = pristine, 1 = very worn. Cards vary across the deck to\n// simulate a set that's been shuffled many times with uneven wear.\nfunction cardAge(id) {\n  if (DECK_AGE <= 0) return 0;\n  var h = Math.sin((id + 1) * 209.3 + 5.7) * 43758.5453;\n  return (h - Math.floor(h)) * DECK_AGE;  // per-card variation scaled by DECK_AGE\n}\n\nfunction _rotPt(ptx, pty, cx, cy, cosA, sinA) {\n  var rx = ptx - cx; var ry = pty - cy;\n  return { x: cx + rx * cosA - ry * sinA, y: cy + rx * sinA + ry * cosA };\n}\n\n// Smooth rounded-rect polygon (N arc steps per corner) rotated around card centre.\n// 4 corners × (N+1) points = 28-point polygon — visually indistinguishable from\n// pushMaskRoundedRect, but supports arbitrary rotation via _rotPt.\nfunction roundedRectPoly(x, y, w, h, r, cx, cy, cosA, sinA) {\n  var pts = [];\n  var N = 6; // arc subdivisions per corner\n  // Each entry: [corner-centre x, corner-centre y, start angle (rad), end angle (rad)]\n  // Angles measured in screen coords (y-down): 0=right, π/2=down, π=left, 3π/2=up.\n  var corners = [\n    [x+r,   y+r,   Math.PI,       3*Math.PI/2],  // top-left\n    [x+w-r, y+r,   3*Math.PI/2,   2*Math.PI  ],  // top-right\n    [x+w-r, y+h-r, 0,             Math.PI/2  ],  // bottom-right\n    [x+r,   y+h-r, Math.PI/2,     Math.PI    ],  // bottom-left\n  ];\n  for (var ci = 0; ci < 4; ci++) {\n    var ocx = corners[ci][0]; var ocy = corners[ci][1];\n    var a0  = corners[ci][2]; var a1  = corners[ci][3];\n    for (var s = 0; s <= N; s++) {\n      var a = a0 + (a1 - a0) * s / N;\n      pts.push(_rotPt(ocx + Math.cos(a) * r, ocy + Math.sin(a) * r, cx, cy, cosA, sinA));\n    }\n  }\n  return pts;\n}\n\n// ─── Card drawing ─────────────────────────────────────────────────────────────\n// Graduated edge vignette drawn against the axis-aligned bounding box of the card.\n// The caller's active mask (rotated polygon or rounded rect) clips the strips to\n// the exact card outline, so the vignette naturally follows rotated card edges.\n// vr/vg/vb: RGB of the shadow tint (face uses warm ~75,70,0; back uses 0,0,0).\nfunction drawCardVignette(bbX, bbY, bbW, bbH, vDepth, vr, vg, vb) {\n  var vN = 16; var vBaseA = 48;\n  for (var vi = 0; vi < vN; vi++) {\n    var vt = (vN - vi) / vN;\n    var va = Math.round(vBaseA * vt * vt * vt);\n    if (va < 1) continue;\n    var vc = ui.colors.rgba(vr, vg, vb, va);\n    var vd0 = Math.round(vi       * vDepth / vN);\n    var vd1 = Math.round((vi + 1) * vDepth / vN);\n    var vth = Math.max(1, vd1 - vd0);\n    ui.rect(bbX,              bbY + vd0,          bbW, vth, vc);  // top\n    ui.rect(bbX,              bbY+bbH-vd0-vth,    bbW, vth, vc);  // bottom\n    ui.rect(bbX + vd0,        bbY,                vth, bbH, vc);  // left\n    ui.rect(bbX+bbW-vd0-vth,  bbY,                vth, bbH, vc);  // right\n  }\n}\n\n// drawCard renders a single playing card at (x, y) using ui primitives only.\n// faceUp=true draws front; false draws back (double-border frame + crosshatch).\n// Optional jitter: { dx, dy, angleDeg } — positional + rotational deviation.\nfunction drawCard(pal, x, y, cw, ch, radius, cardObj, isDragging, jitter, age) {\n  var id = cardObj ? cardObj.id : -1;\n  var faceUp = cardObj ? cardObj.faceUp : false;\n  var _age = (age > 0) ? Math.min(age, 1.0) : 0;\n\n  // Stable positional + rotational deviation (simulates human-dealt card placement).\n  var jx = jitter ? x + (jitter.dx || 0) : x;\n  var jy = jitter ? y + (jitter.dy || 0) : y;\n  var angDeg = (jitter && !isDragging) ? (jitter.angleDeg || 0) : 0;\n  var angRad = angDeg * Math.PI / 180;\n  var cosA = Math.cos(angRad); var sinA = Math.sin(angRad);\n  var jcx = jx + cw * 0.5; var jcy = jy + ch * 0.5;\n\n  // Drag lift: scale the card up ~4% when being dragged, simulating it held above the\n  // felt. The card grows outward from the pick-up centre point. jx/jy/cw/ch are all\n  // local copies so this is safe; jcx/jcy are recomputed after rounding.\n  if (isDragging) {\n    var _liftS = 1.04;\n    cw = Math.round(cw * _liftS);\n    ch = Math.round(ch * _liftS);\n    jx = Math.round(jcx - cw * 0.5);\n    jy = Math.round(jcy - ch * 0.5);\n    jcx = jx + cw * 0.5;\n    jcy = jy + ch * 0.5;\n  }\n\n  // Bounding box of the rotated card — the smallest axis-aligned rect that fully\n  // contains the rotated polygon. Used for full-card fill rects so that the mask\n  // corners (which extend beyond the unrotated card rect when tilted) are never\n  // left unfilled. For dragged cards angDeg=0 so bbW/bbH === cw/ch exactly.\n  var _absS = Math.abs(sinA); var _absC = Math.abs(cosA);\n  var bbW = Math.ceil(cw * _absC + ch * _absS);\n  var bbH = Math.ceil(cw * _absS + ch * _absC);\n  var bbX = Math.floor(jcx - bbW * 0.5);\n  var bbY = Math.floor(jcy - bbH * 0.5);\n\n  // Shadow — three-layer spread when dragging (simulates card ~15px above the felt);\n  // single tight rect when at rest. Offsets and alphas chosen so the total perceived\n  // shadow density is comparable to the resting shadow despite the larger spread.\n  if (isDragging) {\n    ui.rect(jx + 14, jy + 18, cw, ch, ui.colors.rgba(0, 0, 0, 3));  // wide penumbra\n    ui.rect(jx + 10, jy + 13, cw, ch, ui.colors.rgba(0, 0, 0, 5));  // mid shadow\n    ui.rect(jx + 6,  jy + 8,  cw, ch, ui.colors.rgba(0, 0, 0, 8));  // umbra core\n  } else {\n    ui.rect(bbX + 3, bbY + 3, bbW, bbH, pal.cardShadow);\n  }\n\n  // Set material before the mask so ALL draws inside (base, vignette strips,\n  // sepia overlays, text glyphs) share the same flat-or-bumpy surface intent.\n  // Material is now sticky — one call covers everything until the next setMaterial.\n  if (faceUp && id >= 0) {\n    // Card face: subtle paper relief — Sobel picks up the card border, text, and\n    // vignette edges as very gentle ridges. normalScale:0.12 is enough to feel\n    // slightly textured without looking bumpy. roughness:0.55 → soft diffuse roll.\n    ui.setMaterial({ roughness: 0.55, normalScale: 0.18 });\n  } else {\n    // Card back: slightly smoother than the face (laminated surface).\n    // A little normalScale lets the center panel edge and border show as a\n    // faint raised frame under raking light. Low roughness → visible gloss.\n    ui.setMaterial({ roughness: 0.3, normalScale: 0.18 });\n  }\n\n  // Card mask — rotated beveled polygon when angle is significant, else rounded rect\n  if (Math.abs(angDeg) > 0.05) {\n    ui.pushMaskPolygon(roundedRectPoly(jx, jy, cw, ch, radius, jcx, jcy, cosA, sinA));\n  } else {\n    ui.pushMaskRoundedRect(jx, jy, cw, ch, radius);\n  }\n\n  if (faceUp && id >= 0) {\n    // ── Face ──────────────────────────────────────────────────────\n    ui.rect(bbX, bbY, bbW, bbH, pal.cardFace);\n    // Sepia yellowing: warm amber wash over the face paper — quadratic so young\n    // cards stay white and only well-worn cards show a visible warm cast.\n    if (_age > 0) {\n      ui.rect(bbX, bbY, bbW, bbH, ui.colors.rgba(200, 160, 80, Math.round(_age * _age * 36)));\n    }\n\n    var suit = cardSuit(id);\n    var rank = cardRank(id);\n    var ink = SUIT_RED[suit] ? pal.red : pal.black;\n    var rankStr = rankLabel(rank);\n    var suitStr = suitLabel(suit);\n\n    // Corner rank label (top-left)\n    ui.text(rankStr, jx + 4, jy + 3, ink);\n    ui.text(suitStr, jx + 4, jy + 3 + (ui.metrics.charHeight || 14), ink);\n\n    // Center suit symbol — scaled up, centered using measured width\n    var _mw = ui.metrics.measureTextWidth ? ui.metrics.measureTextWidth : function(s) { return (ui.metrics.charWidth || 10) * s.length; };\n    var centerScale = 1.6;\n    var cx3 = jx + Math.floor((cw - _mw(suitStr) * centerScale) * 0.5);\n    var cy3 = jy + Math.floor((ch - (ui.metrics.charHeight || 14) * centerScale) * 0.5) - 2;\n    ui.text(suitStr, cx3, cy3, ink, centerScale);\n\n    // Bottom-right corner — right-aligned using measured widths\n    var bry = jy + ch - 4 - (ui.metrics.charHeight || 14) * 2;\n    ui.text(rankStr, jx + cw - 4 - _mw(rankStr), bry, ink);\n    ui.text(suitStr, jx + cw - 4 - _mw(suitStr), bry + (ui.metrics.charHeight || 14), ink);\n\n    // Foxing / age spots on card face: tiny warm-brown marks scattered across\n    // the print. Count grows cubically with age; placed before the vignette so\n    // edge marks are naturally darkened by it. Two hues alternate (foxing =\n    // warm amber, stain = cooler brown).\n    if (_age > 0) {\n      var _fN = Math.round(_age * _age * _age * 50);\n      var _fhs = ((id * 2654435761) >>> 0);\n      for (var _fi = 0; _fi < _fN; _fi++) {\n        _fhs = ((_fhs * 1664525 + 1013904223) >>> 0);  var _fx = jx + Math.round((_fhs / 4294967296) * (cw - 4));\n        _fhs = ((_fhs * 1664525 + 1013904223) >>> 0);  var _fy = jy + Math.round((_fhs / 4294967296) * (ch - 4));\n        _fhs = ((_fhs * 1664525 + 1013904223) >>> 0);  var _fw = 1 + Math.round((_fhs / 4294967296) * 2.5);\n        _fhs = ((_fhs * 1664525 + 1013904223) >>> 0);  var _ft = 1 + Math.round((_fhs / 4294967296) * 2.5);\n        _fhs = ((_fhs * 1664525 + 1013904223) >>> 0);\n        var _fa = Math.round((0.08 + (_fhs / 4294967296) * 0.22) * _age * 255);\n        _fhs = ((_fhs * 1664525 + 1013904223) >>> 0);\n        var _fc = (_fhs / 4294967296) > 0.55\n          ? ui.colors.rgba(175, 135, 58, _fa)   // warm foxing\n          : ui.colors.rgba(110, 82, 48, _fa);    // cooler stain\n        ui.rect(_fx, _fy, _fw, _ft, _fc);\n      }\n    }\n\n    // Edge vignette — warm tint, 50% depth on face (more immersive inner glow).\n    drawCardVignette(bbX, bbY, bbW, bbH, Math.max(5, Math.round(Math.min(cw, ch) * 0.50)), 75, 70, 0);\n\n  } else {\n    // ── Back: off-white base, accent1 center panel, icon glyph ───\n    ui.rect(bbX, bbY, bbW, bbH, pal.cardBack);\n    // Sepia yellowing on the border area — same formula as face\n    if (_age > 0) {\n      ui.rect(bbX, bbY, bbW, bbH, ui.colors.rgba(200, 160, 80, Math.round(_age * _age * 36)));\n    }\n    // Inset center panel\n    var bMarX = Math.max(5, Math.round(cw * 0.12));\n    var bMarY = Math.max(5, Math.round(ch * 0.12));\n    var bPanX = jx + bMarX;  var bPanY = jy + bMarY;\n    var bPanW = cw - bMarX * 2;  var bPanH = ch - bMarY * 2;\n    ui.rect(bPanX, bPanY, bPanW, bPanH, pal.cardBackInv);\n    // Glyph centered in the panel at 25% of its panel-filling scale.\n    // Use measureTextWidth for the actual emoji render width (may exceed charWidth),\n    // which is why the old _bCw-based centering drifted rightward.\n    var _bCh = ui.metrics.charHeight || 14;\n    var char = '⚜';\n    var _bGW = ui.metrics.measureTextWidth(char) || (ui.metrics.charWidth || 10);\n    var _bFillScale = Math.min(bPanW / _bGW, bPanH / _bCh);\n    var _bScale = _bFillScale * 0.95;\n    ui.text(char, bPanX + Math.floor((bPanW - _bGW * _bScale) * 0.5),\n                  bPanY + Math.floor((bPanH - _bCh * _bScale) * 0.5),\n                  pal.cardBack, _bScale);\n\n    // Age spots — border margin only so they don't obscure the panel glyph\n    if (_age > 0) {\n      var _bN = Math.round(_age * _age * _age * 35);\n      var _bhs = ((id * 2654435761 + 9999) >>> 0);\n      for (var _bi = 0; _bi < _bN; _bi++) {\n        _bhs = ((_bhs * 1664525 + 1013904223) >>> 0);  var _bsx = _bhs / 4294967296;\n        _bhs = ((_bhs * 1664525 + 1013904223) >>> 0);  var _bsy = _bhs / 4294967296;\n        _bhs = ((_bhs * 1664525 + 1013904223) >>> 0);  var _bw = 1 + Math.round((_bhs / 4294967296) * 2.0);\n        _bhs = ((_bhs * 1664525 + 1013904223) >>> 0);  var _bt = 1 + Math.round((_bhs / 4294967296) * 2.0);\n        _bhs = ((_bhs * 1664525 + 1013904223) >>> 0);\n        var _ba = Math.round((0.06 + (_bhs / 4294967296) * 0.18) * _age * 255);\n        // Map into card coords; skip spots that fall inside the center panel\n        var _bx = jx + Math.round(_bsx * (cw - 3));\n        var _by = jy + Math.round(_bsy * (ch - 3));\n        if (_bx >= bPanX && _bx < bPanX + bPanW && _by >= bPanY && _by < bPanY + bPanH) continue;\n        ui.rect(_bx, _by, _bw, _bt, ui.colors.rgba(140, 120, 90, _ba));\n      }\n    }\n\n    // Edge vignette — neutral tint, 40% depth on back (laminated surface).\n    drawCardVignette(bbX, bbY, bbW, bbH, Math.max(5, Math.round(Math.min(cw, ch) * 0.40)), 0, 0, 0);\n  }\n\n  ui.popMask();\n}\n\n// Empty slot placeholder (for foundations and tableau empty columns)\nfunction drawEmptySlot(pal, x, y, cw, ch, radius, label) {\n  ui.pushMaskRoundedRect(x, y, cw, ch, radius);\n  ui.rect(x, y, cw, ch, pal.slotFill);\n  // Border inside mask so it clips to rounded corners\n  ui.rect(x,          y,          cw, 1,  pal.slotBorder);\n  ui.rect(x,          y + ch - 1, cw, 1,  pal.slotBorder);\n  ui.rect(x,          y,          1,  ch, pal.slotBorder);\n  ui.rect(x + cw - 1, y,          1,  ch, pal.slotBorder);\n  ui.popMask();\n  if (label) {\n    var lx = x + Math.floor((cw - (ui.metrics.charWidth || 10) * label.length) * 0.5);\n    var ly = y + Math.floor((ch - (ui.metrics.charHeight || 14)) * 0.5);\n    ui.text(label, lx, ly, pal.slotBorder);\n  }\n}\n\n// ─── Render ───────────────────────────────────────────────────────────────────\nfunction drawGame(L, pal) {\n  var g = scope.gs;\n  var cw = L.cw; var ch = L.ch; var r = L.radius;\n\n  // ── Top row ──────────────────────────────────────────────────────────────────\n\n  // Stock pile\n  var stockX = L.topRowXs[0]; var topY = L.topRowY;\n  if (g.stock.length > 0) {\n    drawCard(pal, stockX, topY, cw, ch, r, { id: 0, faceUp: false }, false);\n    // Small count badge\n    var countStr = String(g.stock.length);\n    ui.text(countStr, stockX + cw - (ui.metrics.charWidth || 10) * countStr.length - 4,\n            topY + 4, pal.dimText);\n  } else {\n    drawEmptySlot(pal, stockX, topY, cw, ch, r, '↺');\n  }\n\n  // Waste pile (show top card, peek second)\n  var wasteX = L.topRowXs[1];\n  if (g.waste.length > 1) {\n    // Peek — slightly offset, face down visually shows as face up (it's been dealt)\n    drawCard(pal, wasteX + 3, topY + 2, cw, ch, r,\n             { id: g.waste[g.waste.length - 2].id, faceUp: true }, false,\n             null, cardAge(g.waste[g.waste.length - 2].id));\n  }\n  if (g.waste.length > 0) {\n    drawCard(pal, wasteX, topY, cw, ch, r, g.waste[g.waste.length - 1], false,\n             null, cardAge(g.waste[g.waste.length - 1].id));\n  } else {\n    drawEmptySlot(pal, wasteX, topY, cw, ch, r, '');\n  }\n\n  // Foundations (slots 3-6, one per suit)\n  for (var f = 0; f < 4; f++) {\n    var fx = L.topRowXs[3 + f];\n    var fnd = g.foundations[f];\n    if (fnd.length > 0) {\n      drawCard(pal, fx, topY, cw, ch, r, fnd[fnd.length - 1], false,\n               null, cardAge(fnd[fnd.length - 1].id));\n    } else {\n      drawEmptySlot(pal, fx, topY, cw, ch, r, SUITS[f]);\n    }\n  }\n\n  // ── Tableau ───────────────────────────────────────────────────────────────────\n  for (var col = 0; col < NUM_TABLEAU; col++) {\n    var cx2 = L.topRowXs[col];\n    var pile = g.tableau[col];\n\n    if (pile.length === 0) {\n      drawEmptySlot(pal, cx2, L.tableauY, cw, ch, r, '');\n      continue;\n    }\n\n    var rects2 = tableauCardRects(pile, cx2, L);\n    for (var ci2 = 0; ci2 < pile.length; ci2++) {\n      // Skip cards that are currently being dragged\n      if (g.drag && g.drag.fromPile === pile && ci2 >= g.drag.fromIndex) continue;\n      drawCard(pal, rects2[ci2].x, rects2[ci2].y, cw, ch, r, pile[ci2], false, cardJitter(pile[ci2].id), cardAge(pile[ci2].id));\n    }\n  }\n\n  // ── Dragged cards (drawn on top of everything) ────────────────────────────────\n  if (g.drag) {\n    var dy2 = g.drag.y;\n    for (var dc = 0; dc < g.drag.cards.length; dc++) {\n      drawCard(pal, g.drag.x, dy2, cw, ch, r, g.drag.cards[dc], dc === 0,\n               null, cardAge(g.drag.cards[dc].id));\n      dy2 += L.faceUpOffset;\n    }\n  }\n\n  // ── Status bar ──────────────────────────────────────────────────────────────\n  var statStr = 'Moves: ' + g.moveCount;\n  if (g.won) statStr = '✓ You won! (' + g.moveCount + ' moves)';\n  var sColor = g.won ? pal.wonBanner : pal.dimText;\n  ui.text(statStr, L.hPad, L.H - (ui.metrics.charHeight || 14) - 4, sColor);\n\n  // Seed display (bottom-center)\n  var seedStr = 'Seed: ' + g.seed;\n  var _mwFn = ui.metrics.measureTextWidth ? ui.metrics.measureTextWidth : function(s) { return (ui.metrics.charWidth || 10) * s.length; };\n  ui.text(seedStr,\n    Math.floor((L.W - _mwFn(seedStr)) * 0.5),\n    L.H - (ui.metrics.charHeight || 14) - 4,\n    pal.dimText);\n\n  // Hint: Replay and New Game buttons\n  var _bH   = (ui.metrics.charHeight || 14) * 2 + 4;\n  var _bW   = Math.max(90, (ui.metrics.charWidth || 10) * 10);\n  var _gap  = 6;\n  var _bY   = L.H - _bH - 4;\n  ui.button('btn-replay-game',\n    L.W - L.hPad - (_bW * 2 + _gap),\n    _bY, _bW, _bH, 'Replay');\n  ui.button('btn-new-game',\n    L.W - L.hPad - _bW,\n    _bY, _bW, _bH, 'New Game');\n}\n\nvar PLAY_SECTION_FIT       = 0.96;\nvar CARD_SECTION_FIT       = 0.92;\nvar PAN_SNAP_PX            = 60;  // section-pixels of drag needed to snap to next section\nvar SETTINGS_THEME_SLIDER_ID  = 'settings-theme-slider';\nvar SETTINGS_DRAW_LABEL_ID    = 'settings-draw-label';\nvar SETTINGS_JITTER_SLIDER_ID = 'settings-jitter-slider';\nvar SETTINGS_JITTER_LABEL_ID  = 'settings-jitter-label';\n\nvar _navBackStack = [];\n\nfunction getThemeNames() {\n  if (typeof themes !== 'undefined' && themes && typeof themes.list === 'function') {\n    var names = themes.list() || [];\n    if (Array.isArray(names) && names.length > 0) return names;\n  }\n  return ['nord'];\n}\n\nfunction getCurrentThemeName() {\n  if (typeof themes !== 'undefined' && themes && typeof themes.getName === 'function') {\n    return themes.getName() || 'nord';\n  }\n  return 'nord';\n}\n\nfunction syncThemeSelectorState() {\n  if (!scope._settings) scope._settings = { themeIndex: 0 };\n  var names = getThemeNames();\n  var currentName = getCurrentThemeName();\n  var index = names.indexOf(currentName);\n  scope._settings.themeIndex = index >= 0 ? index : 0;\n}\n\nfunction focusWorldSection(target) {\n  if (!worlds || !worlds.camera || typeof worlds.camera.focusOnSectionFit !== 'function') return;\n  var fill = target === 'Play' ? PLAY_SECTION_FIT : CARD_SECTION_FIT;\n  worlds.camera.focusOnSectionFit(target, fill, { keepRotation: true });\n}\n\nfunction currentSectionIndex() {\n  return worlds && typeof worlds.currentSection === 'number' ? worlds.currentSection : null;\n}\n\nfunction getNavigationSourceSection(activated) {\n  if (activated && typeof activated.sectionIndex === 'number') return activated.sectionIndex;\n  return currentSectionIndex();\n}\n\nfunction rememberSectionForBack(sectionIndex) {\n  if (typeof sectionIndex !== 'number') return;\n  if (_navBackStack.length && _navBackStack[_navBackStack.length - 1] === sectionIndex) return;\n  _navBackStack.push(sectionIndex);\n  if (_navBackStack.length > 24) _navBackStack.splice(0, _navBackStack.length - 24);\n}\n\nfunction navigateToSectionWithHistory(target, fromSectionIndex) {\n  rememberSectionForBack(fromSectionIndex);\n  focusWorldSection(target);\n}\n\nfunction goBackInHistory(fallbackTarget) {\n  if (!_navBackStack.length) { if (fallbackTarget) focusWorldSection(fallbackTarget); return; }\n  focusWorldSection(_navBackStack.pop());\n}\n\nfunction syncSettingsWidgets() {\n  if (!worlds || !worlds.widgets) return;\n  syncThemeSelectorState();\n  var sectionRef = (scope.sections && typeof scope.sections.settings === 'number')\n    ? scope.sections.settings : undefined;\n  if (typeof worlds.widgets.configure === 'function') {\n    var themeCount = getThemeNames().length;\n    worlds.widgets.configure(SETTINGS_THEME_SLIDER_ID, {\n      min: 0,\n      max: Math.max(0, themeCount - 1),\n      step: 1,\n      showValue: false,\n    }, sectionRef);\n  }\n  if (typeof worlds.widgets.configure === 'function') {\n    worlds.widgets.configure(SETTINGS_JITTER_SLIDER_ID, {\n      min: 0, max: JITTER_STEPS.length - 1, step: 1, showValue: false,\n    }, sectionRef);\n  }\n  if (typeof worlds.widgets.setValue === 'function') {\n    worlds.widgets.setValue(\n      SETTINGS_DRAW_LABEL_ID,\n      'Draw: ' + scope.STOCK_DEAL + (scope.STOCK_DEAL === 1 ? ' card' : ' cards'),\n      sectionRef\n    );\n    if (scope._settings) {\n      worlds.widgets.setValue(SETTINGS_THEME_SLIDER_ID, scope._settings.themeIndex, sectionRef);\n      var _jIdx = scope._settings.jitterIndex !== undefined ? scope._settings.jitterIndex : 2;\n      worlds.widgets.setValue(SETTINGS_JITTER_SLIDER_ID, _jIdx, sectionRef);\n      worlds.widgets.setValue(SETTINGS_JITTER_LABEL_ID, JITTER_NAMES[_jIdx] || 'Normal', sectionRef);\n    }\n  }\n}\n\nfunction handleSettingsWorldWidgetEvents() {\n  if (!worlds || !worlds.widgets || typeof worlds.widgets.popEvent !== 'function') return;\n  for (;;) {\n    var widgetEvent = worlds.widgets.popEvent();\n    if (!widgetEvent) break;\n    if (widgetEvent.id === SETTINGS_THEME_SLIDER_ID && widgetEvent.action === 'change' && typeof widgetEvent.value === 'number') {\n      if (!scope._settings) scope._settings = { themeIndex: 0, jitterIndex: 2 };\n      var names = getThemeNames();\n      var nextIndex = Math.max(0, Math.min(names.length - 1, Math.round(widgetEvent.value)));\n      var name = names[nextIndex];\n      if (name && typeof themes !== 'undefined' && themes && typeof themes.set === 'function') {\n        if (!themes.set(name)) continue;\n      }\n      scope._settings.themeIndex = nextIndex;\n      syncSettingsWidgets();\n    } else if (widgetEvent.id === SETTINGS_JITTER_SLIDER_ID && widgetEvent.action === 'change' && typeof widgetEvent.value === 'number') {\n      if (!scope._settings) scope._settings = { themeIndex: 0, jitterIndex: 2 };\n      var jIdx = Math.max(0, Math.min(JITTER_STEPS.length - 1, Math.round(widgetEvent.value)));\n      scope._settings.jitterIndex = jIdx;\n      JITTER = JITTER_STEPS[jIdx];\n      syncSettingsWidgets();\n    }\n  }\n}\n\nfunction handleWorldLinkActions() {\n  if (!worlds || !worlds.links || typeof worlds.links.popActivated !== 'function') return;\n  for (;;) {\n    var activated = worlds.links.popActivated();\n    if (!activated) break;\n    var fromSection = getNavigationSourceSection(activated);\n    if (activated.url === 'action:new-game') {\n      scope.newGame();\n      focusWorldSection('Play');\n    } else if (activated.url === 'action:replay-game') {\n      scope.newGame(scope.gs ? scope.gs.seed : undefined);\n      focusWorldSection('Play');\n    } else if (activated.url === 'action:draw-1') {\n      scope.STOCK_DEAL = 1;\n      syncSettingsWidgets();\n    } else if (activated.url === 'action:draw-3') {\n      scope.STOCK_DEAL = 3;\n      syncSettingsWidgets();\n    } else if (activated.url === 'action:history-back') {\n      goBackInHistory('Play');\n    }\n  }\n}"
  },
  {
    "id": "block-5",
    "hook": "init",
    "startLine": 1055,
    "endLine": 1105,
    "sectionRef": "help-39",
    "targetSectionRef": null,
    "metadata": {
      "on": "init"
    },
    "code": "term.layerID = 'default';\nscope.sections = {};\nscope._settings = scope._settings || { themeIndex: 0, jitterIndex: 2 };\nif (scope._settings.jitterIndex === undefined) scope._settings.jitterIndex = 2;\nJITTER = JITTER_STEPS[scope._settings.jitterIndex];\nscope._worldSwipe = null;  // { startY, lastY, totalDy } — background swipe-to-pan gesture\n\nworlds.enable();\nworlds.controls.setEnabled(false);\nif (worlds.links && typeof worlds.links.setKeyHandlingEnabled === 'function') {\n  worlds.links.setKeyHandlingEnabled(true);\n}\nworlds.config.setDefaults({\n  sectionOverflow:          'fit-y',\n  keepRotation: true,\n  straightenOnFocus: true,\n  screenSpaceRecenter: true,\n  screenSpaceRecenterIters: 2,\n  sectionSizeUnits: 'px',\n  sectionOverflow: 'fit-y',\n  sectionListMarker: '➵',\n  sectionListMarkerGapPx: 12,\n  sectionListHangIndentPx: 24,\n  defaultSectionWidth: 960,\n  defaultSectionHeight: 700,\n  autoLayoutSpacing:        100,\n  sectionBorderEnabled:     false,\n  sectionBackground: 'texture:assets/img/PaintedWood008C_1K.jpg;tilePx=640;paperPlaneZ=focus',\n  liveTextureScale: 1,\n});\nworlds.camera.setPosition(0, -80, 260);\nworlds.camera.setRotation(-9 * Math.PI / 180, 2 * Math.PI / 180, 0);\nworlds.camera.setEaseSpeed(0.08, 0.12);\n\nworlds.camera.shake.setParams({\n  strength:  0.4,\n  rate:      0.12,\n  translate: { x: 0.6, y: 0.5, z: 0.2 },\n  rotate:    { x: 1.2 * Math.PI / 180, y: 1.2 * Math.PI / 180, z: 0.008 },\n});\nworlds.camera.shake.setEnabled(true);\n\n// Mark Play as a live section: on:render section:play draws into the 3D card texture.\nworlds.setSectionLive('Play');\n\nscope.newGame(); // fresh random seed on first load\nscope._layout  = null;\n\nworlds.camera.focusOnSectionFit('Play', PLAY_SECTION_FIT, { keepRotation: true });"
  },
  {
    "id": "block-6",
    "hook": "input",
    "startLine": 1107,
    "endLine": 1165,
    "sectionRef": "help-39",
    "targetSectionRef": null,
    "metadata": {
      "on": "input"
    },
    "code": "if (!event) return;\n\n// ── World-background swipe-to-pan (desktop mouse outside live section) ────────\n// 'mouse' events fire on button press/release; 'mouse_move' fires during drag.\n// We only claim the gesture when it isn't already owned by the section handler.\nif (event.type === 'mouse') {\n  var _lmb = !!(event.buttons & 1);\n  if (_lmb && !scope._worldSwipe) {\n    scope._worldSwipe = { startY: event.y, lastY: event.y, totalDy: 0 };\n  } else if (!_lmb && scope._worldSwipe) {\n    var _gDy = scope._worldSwipe.totalDy;\n    scope._worldSwipe = null;\n    var _gCs = currentSectionIndex();\n    var _onPlay     = scope.sections && _gCs === scope.sections.play;\n    var _onSettings = scope.sections && _gCs === scope.sections.settings;\n    var _onHelp     = scope.sections && _gCs === scope.sections.help;\n    if (_onPlay) {\n      // Settings is above Play (y<0): swipe up → Settings; Help is below: swipe down → Help\n      if      (_gDy < -PAN_SNAP_PX) navigateToSectionWithHistory('Settings', _gCs);\n      else if (_gDy >  PAN_SNAP_PX) navigateToSectionWithHistory('Help', _gCs);\n    } else if (_onSettings && _gDy > PAN_SNAP_PX) {\n      // Settings is above Play: swipe down returns to Play\n      goBackInHistory('Play');\n    } else if (_onHelp && _gDy < -PAN_SNAP_PX) {\n      // Help is below Play: swipe up returns to Play\n      goBackInHistory('Play');\n    }\n  }\n  return;\n}\nif (event.type === 'mouse_move') {\n  if (scope._worldSwipe) {\n    scope._worldSwipe.totalDy += (event.y || 0) - scope._worldSwipe.lastY;\n    scope._worldSwipe.lastY    = (event.y || 0);\n  }\n  return;\n}\n\nif (event.type !== 'keydown') return;\nvar k  = event.key;\nvar cs = currentSectionIndex();\nvar onPlay = scope.sections && cs === scope.sections.play;\n\nif (k === 'Escape') {\n  if (onPlay) navigateToSectionWithHistory('Settings', cs);\n  else goBackInHistory('Play');\n} else if ((k === 's' || k === 'S') && onPlay) {\n  navigateToSectionWithHistory('Settings', cs);\n} else if ((k === 'h' || k === 'H' || k === '?') && onPlay) {\n  navigateToSectionWithHistory('Help', cs);\n} else if (k === 'n' || k === 'N') {\n  scope.newGame();\n  focusWorldSection('Play');\n} else if (k === 'r' || k === 'R') {\n  scope.newGame(scope.gs ? scope.gs.seed : undefined);\n  focusWorldSection('Play');\n}"
  },
  {
    "id": "block-7",
    "hook": "update",
    "startLine": 1167,
    "endLine": 1170,
    "sectionRef": "help-39",
    "targetSectionRef": null,
    "metadata": {
      "on": "update"
    },
    "code": "handleWorldLinkActions();\nhandleSettingsWorldWidgetEvents();"
  },
  {
    "id": "block-8",
    "hook": "update",
    "startLine": 1171,
    "endLine": 1243,
    "sectionRef": "help-39",
    "targetSectionRef": "play-8",
    "metadata": {
      "on": "update",
      "section": "play"
    },
    "code": "if (!scope.gs) { newGame(); return; }\n\nvar L = computeLayout();\nscope._layout = L;\n\n// ── Mouse light-follow ───────────────────────────────────────────────────────\nvar _mW = ui.metrics.canvasWidth  || 1280;\nvar _mH = ui.metrics.canvasHeight || 720;\n//shader.setUniform('lightsobel', 'lightX', ui.pointer.x() / _mW);\n//shader.setUniform('lightsobel', 'lightY', ui.pointer.y() / _mH);\n//shader.setUniform('lightsoft', 'lightX', ui.pointer.x() / _mW);\n//shader.setUniform('lightsoft', 'lightY', ui.pointer.y() / _mH);\n// ── End mouse light-follow ────────────────────────────────────────────────────\n\n// Handle Replay / New Game button clicks.\n// Buttons are drawn by drawGame() in the render pass; here we only test input\n// using section-local pointer coordinates (ui.pointer.x/y are section-space\n// in live sections so hit tests match the rendered button positions).\nvar _bH2   = (ui.metrics.charHeight || 14) * 2 + 4;\nvar _bW2   = Math.max(90, (ui.metrics.charWidth || 10) * 10);\nvar _gap2  = 6;\nvar _bY2   = L.H - _bH2 - 4;\nvar _mx2   = ui.pointer.x();\nvar _my2   = ui.pointer.y();\nvar _click2 = ui.pointer.clicked(0);\nvar _replayX2 = L.W - L.hPad - (_bW2 * 2 + _gap2);\nvar _newX2    = L.W - L.hPad - _bW2;\nif (_click2 && _mx2 >= _replayX2 && _mx2 < _replayX2 + _bW2 && _my2 >= _bY2 && _my2 < _bY2 + _bH2) {\n  newGame(scope.gs ? scope.gs.seed : undefined);\n  scope._layout = null;\n  return;\n}\nif (_click2 && _mx2 >= _newX2 && _mx2 < _newX2 + _bW2 && _my2 >= _bY2 && _my2 < _bY2 + _bH2) {\n  newGame();\n  scope._layout = null;\n  return;\n}\n\nif (!scope.gs.won) {\n  // ── Background swipe-to-pan: detect drags on game felt (no card hit) ──────\n  // Swiping up   (dy < -PAN_SNAP_PX) navigates to Settings (section above).\n  // Swiping down (dy >  PAN_SNAP_PX) navigates to Help    (section below).\n  // A live card drag cancels any in-progress swipe gesture.\n  var _pmx = ui.pointer.x();\n  var _pmy = ui.pointer.y();\n  var _pdn = ui.pointer.down(0);\n  if (scope.gs.drag) {\n    // Card drag in progress — cancel any background swipe so they don't conflict.\n    scope._worldSwipe = null;\n  } else if (_pdn && !scope._worldSwipe) {\n    // New press: only start a world-swipe if the pointer is on empty felt.\n    if (!hitTest(_pmx, _pmy, L)) {\n      scope._worldSwipe = { startY: _pmy, lastY: _pmy, totalDy: 0 };\n    }\n  } else if (_pdn && scope._worldSwipe) {\n    // Ongoing drag — accumulate vertical delta.\n    scope._worldSwipe.totalDy += _pmy - scope._worldSwipe.lastY;\n    scope._worldSwipe.lastY    = _pmy;\n  } else if (!_pdn && scope._worldSwipe) {\n    // Released — snap to the appropriate section.\n    var _swipeDy = scope._worldSwipe.totalDy;\n    scope._worldSwipe = null;\n    if (_swipeDy < -PAN_SNAP_PX) {\n      navigateToSectionWithHistory('Settings', scope.sections.play);\n    } else if (_swipeDy > PAN_SNAP_PX) {\n      navigateToSectionWithHistory('Help', scope.sections.play);\n    }\n  }\n\n  handleInput(L);\n}"
  },
  {
    "id": "block-9",
    "hook": "update",
    "startLine": 1245,
    "endLine": 1260,
    "sectionRef": "help-39",
    "targetSectionRef": "settings-17",
    "metadata": {
      "on": "update",
      "section": "settings"
    },
    "code": "// Swipe down (dy > PAN_SNAP_PX) from Settings returns to Play.\n// Settings is above Play in world space, so dragging down moves camera toward Play.\nvar _sdn = ui.pointer.down(0);\nvar _spy = ui.pointer.y();\nif (_sdn && !scope._worldSwipe) {\n  scope._worldSwipe = { startY: _spy, lastY: _spy, totalDy: 0 };\n} else if (_sdn && scope._worldSwipe) {\n  scope._worldSwipe.totalDy += _spy - scope._worldSwipe.lastY;\n  scope._worldSwipe.lastY    = _spy;\n} else if (!_sdn && scope._worldSwipe) {\n  var _sDy = scope._worldSwipe.totalDy;\n  scope._worldSwipe = null;\n  if (_sDy > PAN_SNAP_PX) goBackInHistory('Play');\n}"
  },
  {
    "id": "block-10",
    "hook": "update",
    "startLine": 1262,
    "endLine": 1277,
    "sectionRef": "help-39",
    "targetSectionRef": "help-39",
    "metadata": {
      "on": "update",
      "section": "help"
    },
    "code": "// Swipe up (dy < -PAN_SNAP_PX) from Help returns to Play.\n// Help is below Play in world space, so dragging up moves camera toward Play.\nvar _hdn = ui.pointer.down(0);\nvar _hpy = ui.pointer.y();\nif (_hdn && !scope._worldSwipe) {\n  scope._worldSwipe = { startY: _hpy, lastY: _hpy, totalDy: 0 };\n} else if (_hdn && scope._worldSwipe) {\n  scope._worldSwipe.totalDy += _hpy - scope._worldSwipe.lastY;\n  scope._worldSwipe.lastY    = _hpy;\n} else if (!_hdn && scope._worldSwipe) {\n  var _hDy = scope._worldSwipe.totalDy;\n  scope._worldSwipe = null;\n  if (_hDy < -PAN_SNAP_PX) goBackInHistory('Play');\n}"
  },
  {
    "id": "block-11",
    "hook": "render",
    "startLine": 1279,
    "endLine": 1283,
    "sectionRef": "help-39",
    "targetSectionRef": null,
    "metadata": {
      "on": "render"
    },
    "code": "term.layerID = 'default';\nterm.clear();\nui.clear();"
  },
  {
    "id": "block-12",
    "hook": "render",
    "startLine": 1285,
    "endLine": 1306,
    "sectionRef": "help-39",
    "targetSectionRef": "play-8",
    "metadata": {
      "on": "render",
      "section": "play"
    },
    "code": "if (!scope.gs) return;\n\n// Always recompute layout fresh in render so ui.metrics.canvasWidth/Height\n// return the current live-section texture dimensions (not a stale cached value\n// from the update pass which may have used different canvas dimensions).\nvar L = computeLayout();\nvar pal = getPalette();\n\ntry {\n  drawGame(L, pal);\n} catch(_e) {\n  // Keep UI alive if rendering fails\n  ui.clear(pal.felt);\n  var now = Date.now();\n  scope._lastErrAt = scope._lastErrAt || 0;\n  if (now - scope._lastErrAt > 1000) {\n    scope._lastErrAt = now;\n    try { console.warn('[klondike] render error:', _e); } catch { /* ignore */ }\n  }\n}"
  }
];
function shouldRunBlock(runtimeCtx, targetSectionRef) {
  if (!targetSectionRef) return true;
  return runtimeCtx.currentSectionId === targetSectionRef || runtimeCtx.activeSectionId === targetSectionRef;
}
function runRegisteredBlocks(entries, runtimeCtx, syncBindings) {
  for (const entry of entries) {
    if (!shouldRunBlock(runtimeCtx, entry.targetSectionRef)) continue;
    syncBindings.fromScope();
    entry.fn(runtimeCtx);
    syncBindings.toScope();
  }
}
export function createCompiledBehavior(api = {}, options = {}) {
  const scope = options.scope ?? {};
  const consoleRef = options.console ?? globalThis.console;
  const MathRef = options.Math ?? globalThis.Math;
  const DateRef = options.Date ?? globalThis.Date;
  const {
    term, termCanvas, layer, key, keys, mouse, drop, doc, host, scene, tui, gui,
    getStyle, theme, themes, modules, getFrame, getTime, getDelta, audio, canvas2d, blob, ascii,
    drawAscii, figlet, drawFiglet, ansi, drawAnsi, ui, webgl, webgpu, shader, compositor, worlds,
    random, sys, mouseX, mouseY, mouseCellX, mouseCellY, mousePixelX, mousePixelY,
    termWidth, termHeight, isExporting, getIsExporting, getParam, CompressionStream, DecompressionStream,
    TextEncoder, TextDecoder, Response, atob, btoa,
  } = api;
  const console = consoleRef;
  const Math = MathRef;
  const Date = DateRef;
  const syncBindings = {
    fromScope() {
      if (Object.prototype.hasOwnProperty.call(scope, "_navBackStack")) _navBackStack = scope["_navBackStack"];
      if (Object.prototype.hasOwnProperty.call(scope, "CARD_SECTION_FIT")) CARD_SECTION_FIT = scope["CARD_SECTION_FIT"];
      if (Object.prototype.hasOwnProperty.call(scope, "DECK_AGE")) DECK_AGE = scope["DECK_AGE"];
      if (Object.prototype.hasOwnProperty.call(scope, "JITTER")) JITTER = scope["JITTER"];
      if (Object.prototype.hasOwnProperty.call(scope, "JITTER_NAMES")) JITTER_NAMES = scope["JITTER_NAMES"];
      if (Object.prototype.hasOwnProperty.call(scope, "JITTER_STEPS")) JITTER_STEPS = scope["JITTER_STEPS"];
      if (Object.prototype.hasOwnProperty.call(scope, "NUM_TABLEAU")) NUM_TABLEAU = scope["NUM_TABLEAU"];
      if (Object.prototype.hasOwnProperty.call(scope, "PAN_SNAP_PX")) PAN_SNAP_PX = scope["PAN_SNAP_PX"];
      if (Object.prototype.hasOwnProperty.call(scope, "PLAY_SECTION_FIT")) PLAY_SECTION_FIT = scope["PLAY_SECTION_FIT"];
      if (Object.prototype.hasOwnProperty.call(scope, "RANKS")) RANKS = scope["RANKS"];
      if (Object.prototype.hasOwnProperty.call(scope, "SETTINGS_DRAW_LABEL_ID")) SETTINGS_DRAW_LABEL_ID = scope["SETTINGS_DRAW_LABEL_ID"];
      if (Object.prototype.hasOwnProperty.call(scope, "SETTINGS_JITTER_LABEL_ID")) SETTINGS_JITTER_LABEL_ID = scope["SETTINGS_JITTER_LABEL_ID"];
      if (Object.prototype.hasOwnProperty.call(scope, "SETTINGS_JITTER_SLIDER_ID")) SETTINGS_JITTER_SLIDER_ID = scope["SETTINGS_JITTER_SLIDER_ID"];
      if (Object.prototype.hasOwnProperty.call(scope, "SETTINGS_THEME_SLIDER_ID")) SETTINGS_THEME_SLIDER_ID = scope["SETTINGS_THEME_SLIDER_ID"];
      if (Object.prototype.hasOwnProperty.call(scope, "STOCK_DEAL")) STOCK_DEAL = scope["STOCK_DEAL"];
      if (Object.prototype.hasOwnProperty.call(scope, "SUIT_RED")) SUIT_RED = scope["SUIT_RED"];
      if (Object.prototype.hasOwnProperty.call(scope, "SUITS")) SUITS = scope["SUITS"];
    },
    toScope() {
      scope["_navBackStack"] = _navBackStack;
      scope["_rotPt"] = _rotPt;
      scope["autoToFoundation"] = autoToFoundation;
      scope["canPlaceOnFoundation"] = canPlaceOnFoundation;
      scope["canPlaceOnTableau"] = canPlaceOnTableau;
      scope["CARD_SECTION_FIT"] = CARD_SECTION_FIT;
      scope["cardAge"] = cardAge;
      scope["cardId"] = cardId;
      scope["cardJitter"] = cardJitter;
      scope["cardLabel"] = cardLabel;
      scope["cardRank"] = cardRank;
      scope["cardSuit"] = cardSuit;
      scope["checkWin"] = checkWin;
      scope["colOffsets"] = colOffsets;
      scope["computeLayout"] = computeLayout;
      scope["currentSectionIndex"] = currentSectionIndex;
      scope["DECK_AGE"] = DECK_AGE;
      scope["drawCard"] = drawCard;
      scope["drawCardVignette"] = drawCardVignette;
      scope["drawEmptySlot"] = drawEmptySlot;
      scope["drawGame"] = drawGame;
      scope["flipTopIfNeeded"] = flipTopIfNeeded;
      scope["focusWorldSection"] = focusWorldSection;
      scope["getCurrentThemeName"] = getCurrentThemeName;
      scope["getNavigationSourceSection"] = getNavigationSourceSection;
      scope["getPalette"] = getPalette;
      scope["getThemeNames"] = getThemeNames;
      scope["goBackInHistory"] = goBackInHistory;
      scope["handleInput"] = handleInput;
      scope["handleSettingsWorldWidgetEvents"] = handleSettingsWorldWidgetEvents;
      scope["handleWorldLinkActions"] = handleWorldLinkActions;
      scope["hitTest"] = hitTest;
      scope["isRed"] = isRed;
      scope["JITTER"] = JITTER;
      scope["JITTER_NAMES"] = JITTER_NAMES;
      scope["JITTER_STEPS"] = JITTER_STEPS;
      scope["navigateToSectionWithHistory"] = navigateToSectionWithHistory;
      scope["newGame"] = newGame;
      scope["NUM_TABLEAU"] = NUM_TABLEAU;
      scope["PAN_SNAP_PX"] = PAN_SNAP_PX;
      scope["PLAY_SECTION_FIT"] = PLAY_SECTION_FIT;
      scope["rankLabel"] = rankLabel;
      scope["RANKS"] = RANKS;
      scope["rememberSectionForBack"] = rememberSectionForBack;
      scope["roundedRectPoly"] = roundedRectPoly;
      scope["SETTINGS_DRAW_LABEL_ID"] = SETTINGS_DRAW_LABEL_ID;
      scope["SETTINGS_JITTER_LABEL_ID"] = SETTINGS_JITTER_LABEL_ID;
      scope["SETTINGS_JITTER_SLIDER_ID"] = SETTINGS_JITTER_SLIDER_ID;
      scope["SETTINGS_THEME_SLIDER_ID"] = SETTINGS_THEME_SLIDER_ID;
      scope["shuffledDeck"] = shuffledDeck;
      scope["STOCK_DEAL"] = STOCK_DEAL;
      scope["SUIT_RED"] = SUIT_RED;
      scope["suitLabel"] = suitLabel;
      scope["SUITS"] = SUITS;
      scope["syncSettingsWidgets"] = syncSettingsWidgets;
      scope["syncThemeSelectorState"] = syncThemeSelectorState;
      scope["tableauCardRects"] = tableauCardRects;
    },
  };
// ─── Constants ────────────────────────────────────────────────────────────────
var SUITS       = ['♠','♥','♦','♣'];   // spade, heart, diamond, club
var RANKS       = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
var SUIT_RED    = [false, true, true, false]; // index matches SUITS
var NUM_TABLEAU = 7;
var STOCK_DEAL  = 1;   // cards dealt per click (set to 3 for draw-3 variant)
var DECK_AGE    = 1.0; // 0 = pristine (no aging), 1 = very worn; scales all card age effects
var JITTER       = 1.0; // positional and angular scatter scale; 0 = none, 1 = default, 3 = chaotic
var JITTER_STEPS = [0, 0.5, 1.0, 2.0, 3.0];   // scale factors per step
var JITTER_NAMES = ['None', 'Subtle', 'Normal', 'Wild', 'Chaotic'];


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
  var W  = ui.metrics.canvasWidth  || 1280;
  var H  = ui.metrics.canvasHeight || 720;
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
  return { dx: dx * 2.4 * JITTER, dy: dy * 2.4 * JITTER, angleDeg: aFrac * 1.5 * JITTER };
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
// Graduated edge vignette drawn against the axis-aligned bounding box of the card.
// The caller's active mask (rotated polygon or rounded rect) clips the strips to
// the exact card outline, so the vignette naturally follows rotated card edges.
// vr/vg/vb: RGB of the shadow tint (face uses warm ~75,70,0; back uses 0,0,0).
function drawCardVignette(bbX, bbY, bbW, bbH, vDepth, vr, vg, vb) {
  var vN = 16; var vBaseA = 48;
  for (var vi = 0; vi < vN; vi++) {
    var vt = (vN - vi) / vN;
    var va = Math.round(vBaseA * vt * vt * vt);
    if (va < 1) continue;
    var vc = ui.colors.rgba(vr, vg, vb, va);
    var vd0 = Math.round(vi       * vDepth / vN);
    var vd1 = Math.round((vi + 1) * vDepth / vN);
    var vth = Math.max(1, vd1 - vd0);
    ui.rect(bbX,              bbY + vd0,          bbW, vth, vc);  // top
    ui.rect(bbX,              bbY+bbH-vd0-vth,    bbW, vth, vc);  // bottom
    ui.rect(bbX + vd0,        bbY,                vth, bbH, vc);  // left
    ui.rect(bbX+bbW-vd0-vth,  bbY,                vth, bbH, vc);  // right
  }
}

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

  // Bounding box of the rotated card — the smallest axis-aligned rect that fully
  // contains the rotated polygon. Used for full-card fill rects so that the mask
  // corners (which extend beyond the unrotated card rect when tilted) are never
  // left unfilled. For dragged cards angDeg=0 so bbW/bbH === cw/ch exactly.
  var _absS = Math.abs(sinA); var _absC = Math.abs(cosA);
  var bbW = Math.ceil(cw * _absC + ch * _absS);
  var bbH = Math.ceil(cw * _absS + ch * _absC);
  var bbX = Math.floor(jcx - bbW * 0.5);
  var bbY = Math.floor(jcy - bbH * 0.5);

  // Shadow — three-layer spread when dragging (simulates card ~15px above the felt);
  // single tight rect when at rest. Offsets and alphas chosen so the total perceived
  // shadow density is comparable to the resting shadow despite the larger spread.
  if (isDragging) {
    ui.rect(jx + 14, jy + 18, cw, ch, ui.colors.rgba(0, 0, 0, 3));  // wide penumbra
    ui.rect(jx + 10, jy + 13, cw, ch, ui.colors.rgba(0, 0, 0, 5));  // mid shadow
    ui.rect(jx + 6,  jy + 8,  cw, ch, ui.colors.rgba(0, 0, 0, 8));  // umbra core
  } else {
    ui.rect(bbX + 3, bbY + 3, bbW, bbH, pal.cardShadow);
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
    ui.rect(bbX, bbY, bbW, bbH, pal.cardFace);
    // Sepia yellowing: warm amber wash over the face paper — quadratic so young
    // cards stay white and only well-worn cards show a visible warm cast.
    if (_age > 0) {
      ui.rect(bbX, bbY, bbW, bbH, ui.colors.rgba(200, 160, 80, Math.round(_age * _age * 36)));
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

    // Edge vignette — warm tint, 50% depth on face (more immersive inner glow).
    drawCardVignette(bbX, bbY, bbW, bbH, Math.max(5, Math.round(Math.min(cw, ch) * 0.50)), 75, 70, 0);

  } else {
    // ── Back: off-white base, accent1 center panel, icon glyph ───
    ui.rect(bbX, bbY, bbW, bbH, pal.cardBack);
    // Sepia yellowing on the border area — same formula as face
    if (_age > 0) {
      ui.rect(bbX, bbY, bbW, bbH, ui.colors.rgba(200, 160, 80, Math.round(_age * _age * 36)));
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

    // Edge vignette — neutral tint, 40% depth on back (laminated surface).
    drawCardVignette(bbX, bbY, bbW, bbH, Math.max(5, Math.round(Math.min(cw, ch) * 0.40)), 0, 0, 0);
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

var PLAY_SECTION_FIT       = 0.96;
var CARD_SECTION_FIT       = 0.92;
var PAN_SNAP_PX            = 60;  // section-pixels of drag needed to snap to next section
var SETTINGS_THEME_SLIDER_ID  = 'settings-theme-slider';
var SETTINGS_DRAW_LABEL_ID    = 'settings-draw-label';
var SETTINGS_JITTER_SLIDER_ID = 'settings-jitter-slider';
var SETTINGS_JITTER_LABEL_ID  = 'settings-jitter-label';

var _navBackStack = [];

function getThemeNames() {
  if (typeof themes !== 'undefined' && themes && typeof themes.list === 'function') {
    var names = themes.list() || [];
    if (Array.isArray(names) && names.length > 0) return names;
  }
  return ['nord'];
}

function getCurrentThemeName() {
  if (typeof themes !== 'undefined' && themes && typeof themes.getName === 'function') {
    return themes.getName() || 'nord';
  }
  return 'nord';
}

function syncThemeSelectorState() {
  if (!scope._settings) scope._settings = { themeIndex: 0 };
  var names = getThemeNames();
  var currentName = getCurrentThemeName();
  var index = names.indexOf(currentName);
  scope._settings.themeIndex = index >= 0 ? index : 0;
}

function focusWorldSection(target) {
  if (!worlds || !worlds.camera || typeof worlds.camera.focusOnSectionFit !== 'function') return;
  var fill = target === 'Play' ? PLAY_SECTION_FIT : CARD_SECTION_FIT;
  worlds.camera.focusOnSectionFit(target, fill, { keepRotation: true });
}

function currentSectionIndex() {
  return worlds && typeof worlds.currentSection === 'number' ? worlds.currentSection : null;
}

function getNavigationSourceSection(activated) {
  if (activated && typeof activated.sectionIndex === 'number') return activated.sectionIndex;
  return currentSectionIndex();
}

function rememberSectionForBack(sectionIndex) {
  if (typeof sectionIndex !== 'number') return;
  if (_navBackStack.length && _navBackStack[_navBackStack.length - 1] === sectionIndex) return;
  _navBackStack.push(sectionIndex);
  if (_navBackStack.length > 24) _navBackStack.splice(0, _navBackStack.length - 24);
}

function navigateToSectionWithHistory(target, fromSectionIndex) {
  rememberSectionForBack(fromSectionIndex);
  focusWorldSection(target);
}

function goBackInHistory(fallbackTarget) {
  if (!_navBackStack.length) { if (fallbackTarget) focusWorldSection(fallbackTarget); return; }
  focusWorldSection(_navBackStack.pop());
}

function syncSettingsWidgets() {
  if (!worlds || !worlds.widgets) return;
  syncThemeSelectorState();
  var sectionRef = (scope.sections && typeof scope.sections.settings === 'number')
    ? scope.sections.settings : undefined;
  if (typeof worlds.widgets.configure === 'function') {
    var themeCount = getThemeNames().length;
    worlds.widgets.configure(SETTINGS_THEME_SLIDER_ID, {
      min: 0,
      max: Math.max(0, themeCount - 1),
      step: 1,
      showValue: false,
    }, sectionRef);
  }
  if (typeof worlds.widgets.configure === 'function') {
    worlds.widgets.configure(SETTINGS_JITTER_SLIDER_ID, {
      min: 0, max: JITTER_STEPS.length - 1, step: 1, showValue: false,
    }, sectionRef);
  }
  if (typeof worlds.widgets.setValue === 'function') {
    worlds.widgets.setValue(
      SETTINGS_DRAW_LABEL_ID,
      'Draw: ' + scope.STOCK_DEAL + (scope.STOCK_DEAL === 1 ? ' card' : ' cards'),
      sectionRef
    );
    if (scope._settings) {
      worlds.widgets.setValue(SETTINGS_THEME_SLIDER_ID, scope._settings.themeIndex, sectionRef);
      var _jIdx = scope._settings.jitterIndex !== undefined ? scope._settings.jitterIndex : 2;
      worlds.widgets.setValue(SETTINGS_JITTER_SLIDER_ID, _jIdx, sectionRef);
      worlds.widgets.setValue(SETTINGS_JITTER_LABEL_ID, JITTER_NAMES[_jIdx] || 'Normal', sectionRef);
    }
  }
}

function handleSettingsWorldWidgetEvents() {
  if (!worlds || !worlds.widgets || typeof worlds.widgets.popEvent !== 'function') return;
  for (;;) {
    var widgetEvent = worlds.widgets.popEvent();
    if (!widgetEvent) break;
    if (widgetEvent.id === SETTINGS_THEME_SLIDER_ID && widgetEvent.action === 'change' && typeof widgetEvent.value === 'number') {
      if (!scope._settings) scope._settings = { themeIndex: 0, jitterIndex: 2 };
      var names = getThemeNames();
      var nextIndex = Math.max(0, Math.min(names.length - 1, Math.round(widgetEvent.value)));
      var name = names[nextIndex];
      if (name && typeof themes !== 'undefined' && themes && typeof themes.set === 'function') {
        if (!themes.set(name)) continue;
      }
      scope._settings.themeIndex = nextIndex;
      syncSettingsWidgets();
    } else if (widgetEvent.id === SETTINGS_JITTER_SLIDER_ID && widgetEvent.action === 'change' && typeof widgetEvent.value === 'number') {
      if (!scope._settings) scope._settings = { themeIndex: 0, jitterIndex: 2 };
      var jIdx = Math.max(0, Math.min(JITTER_STEPS.length - 1, Math.round(widgetEvent.value)));
      scope._settings.jitterIndex = jIdx;
      JITTER = JITTER_STEPS[jIdx];
      syncSettingsWidgets();
    }
  }
}

function handleWorldLinkActions() {
  if (!worlds || !worlds.links || typeof worlds.links.popActivated !== 'function') return;
  for (;;) {
    var activated = worlds.links.popActivated();
    if (!activated) break;
    var fromSection = getNavigationSourceSection(activated);
    if (activated.url === 'action:new-game') {
      scope.newGame();
      focusWorldSection('Play');
    } else if (activated.url === 'action:replay-game') {
      scope.newGame(scope.gs ? scope.gs.seed : undefined);
      focusWorldSection('Play');
    } else if (activated.url === 'action:draw-1') {
      scope.STOCK_DEAL = 1;
      syncSettingsWidgets();
    } else if (activated.url === 'action:draw-3') {
      scope.STOCK_DEAL = 3;
      syncSettingsWidgets();
    } else if (activated.url === 'action:history-back') {
      goBackInHistory('Play');
    }
  }
}
  syncBindings.toScope();
function enterBlock1(runtimeCtx = {}) {
  const delta = runtimeCtx.delta;
  const event = runtimeCtx.event;
  scope.sections = scope.sections || {};
  if (typeof worlds.currentSection === 'number') {
    scope.sections.play = worlds.currentSection;
  }
}

function enterBlock2(runtimeCtx = {}) {
  const delta = runtimeCtx.delta;
  const event = runtimeCtx.event;
  scope.sections = scope.sections || {};
  if (typeof worlds.currentSection === 'number') {
    scope.sections.settings = worlds.currentSection;
  }
  syncSettingsWidgets();
}

function enterBlock3(runtimeCtx = {}) {
  const delta = runtimeCtx.delta;
  const event = runtimeCtx.event;
  scope.sections = scope.sections || {};
  if (typeof worlds.currentSection === 'number') {
    scope.sections.help = worlds.currentSection;
  }
}

function initBlock4(runtimeCtx = {}) {
  const delta = runtimeCtx.delta;
  const event = runtimeCtx.event;
  term.layerID = 'default';
  scope.sections = {};
  scope._settings = scope._settings || { themeIndex: 0, jitterIndex: 2 };
  if (scope._settings.jitterIndex === undefined) scope._settings.jitterIndex = 2;
  JITTER = JITTER_STEPS[scope._settings.jitterIndex];
  scope._worldSwipe = null;  // { startY, lastY, totalDy } — background swipe-to-pan gesture

  worlds.enable();
  worlds.controls.setEnabled(false);
  if (worlds.links && typeof worlds.links.setKeyHandlingEnabled === 'function') {
    worlds.links.setKeyHandlingEnabled(true);
  }
  worlds.config.setDefaults({
    sectionOverflow:          'fit-y',
    keepRotation: true,
    straightenOnFocus: true,
    screenSpaceRecenter: true,
    screenSpaceRecenterIters: 2,
    sectionSizeUnits: 'px',
    sectionOverflow: 'fit-y',
    sectionListMarker: '➵',
    sectionListMarkerGapPx: 12,
    sectionListHangIndentPx: 24,
    defaultSectionWidth: 960,
    defaultSectionHeight: 700,
    autoLayoutSpacing:        100,
    sectionBorderEnabled:     false,
    sectionBackground: 'texture:assets/img/PaintedWood008C_1K.jpg;tilePx=640;paperPlaneZ=focus',
    liveTextureScale: 1,
  });
  worlds.camera.setPosition(0, -80, 260);
  worlds.camera.setRotation(-9 * Math.PI / 180, 2 * Math.PI / 180, 0);
  worlds.camera.setEaseSpeed(0.08, 0.12);

  worlds.camera.shake.setParams({
    strength:  0.4,
    rate:      0.12,
    translate: { x: 0.6, y: 0.5, z: 0.2 },
    rotate:    { x: 1.2 * Math.PI / 180, y: 1.2 * Math.PI / 180, z: 0.008 },
  });
  worlds.camera.shake.setEnabled(true);

  // Mark Play as a live section: on:render section:play draws into the 3D card texture.
  worlds.setSectionLive('Play');

  scope.newGame(); // fresh random seed on first load
  scope._layout  = null;

  worlds.camera.focusOnSectionFit('Play', PLAY_SECTION_FIT, { keepRotation: true });
}

function inputBlock5(runtimeCtx = {}) {
  const delta = runtimeCtx.delta;
  const event = runtimeCtx.event;
  if (!event) return;

  // ── World-background swipe-to-pan (desktop mouse outside live section) ────────
  // 'mouse' events fire on button press/release; 'mouse_move' fires during drag.
  // We only claim the gesture when it isn't already owned by the section handler.
  if (event.type === 'mouse') {
    var _lmb = !!(event.buttons & 1);
    if (_lmb && !scope._worldSwipe) {
      scope._worldSwipe = { startY: event.y, lastY: event.y, totalDy: 0 };
    } else if (!_lmb && scope._worldSwipe) {
      var _gDy = scope._worldSwipe.totalDy;
      scope._worldSwipe = null;
      var _gCs = currentSectionIndex();
      var _onPlay     = scope.sections && _gCs === scope.sections.play;
      var _onSettings = scope.sections && _gCs === scope.sections.settings;
      var _onHelp     = scope.sections && _gCs === scope.sections.help;
      if (_onPlay) {
        // Settings is above Play (y<0): swipe up → Settings; Help is below: swipe down → Help
        if      (_gDy < -PAN_SNAP_PX) navigateToSectionWithHistory('Settings', _gCs);
        else if (_gDy >  PAN_SNAP_PX) navigateToSectionWithHistory('Help', _gCs);
      } else if (_onSettings && _gDy > PAN_SNAP_PX) {
        // Settings is above Play: swipe down returns to Play
        goBackInHistory('Play');
      } else if (_onHelp && _gDy < -PAN_SNAP_PX) {
        // Help is below Play: swipe up returns to Play
        goBackInHistory('Play');
      }
    }
    return;
  }
  if (event.type === 'mouse_move') {
    if (scope._worldSwipe) {
      scope._worldSwipe.totalDy += (event.y || 0) - scope._worldSwipe.lastY;
      scope._worldSwipe.lastY    = (event.y || 0);
    }
    return;
  }

  if (event.type !== 'keydown') return;
  var k  = event.key;
  var cs = currentSectionIndex();
  var onPlay = scope.sections && cs === scope.sections.play;

  if (k === 'Escape') {
    if (onPlay) navigateToSectionWithHistory('Settings', cs);
    else goBackInHistory('Play');
  } else if ((k === 's' || k === 'S') && onPlay) {
    navigateToSectionWithHistory('Settings', cs);
  } else if ((k === 'h' || k === 'H' || k === '?') && onPlay) {
    navigateToSectionWithHistory('Help', cs);
  } else if (k === 'n' || k === 'N') {
    scope.newGame();
    focusWorldSection('Play');
  } else if (k === 'r' || k === 'R') {
    scope.newGame(scope.gs ? scope.gs.seed : undefined);
    focusWorldSection('Play');
  }
}

function updateBlock6(runtimeCtx = {}) {
  const delta = runtimeCtx.delta;
  const event = runtimeCtx.event;
  handleWorldLinkActions();
  handleSettingsWorldWidgetEvents();
}

function updateBlock7(runtimeCtx = {}) {
  const delta = runtimeCtx.delta;
  const event = runtimeCtx.event;
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

  // Handle Replay / New Game button clicks.
  // Buttons are drawn by drawGame() in the render pass; here we only test input
  // using section-local pointer coordinates (ui.pointer.x/y are section-space
  // in live sections so hit tests match the rendered button positions).
  var _bH2   = (ui.metrics.charHeight || 14) * 2 + 4;
  var _bW2   = Math.max(90, (ui.metrics.charWidth || 10) * 10);
  var _gap2  = 6;
  var _bY2   = L.H - _bH2 - 4;
  var _mx2   = ui.pointer.x();
  var _my2   = ui.pointer.y();
  var _click2 = ui.pointer.clicked(0);
  var _replayX2 = L.W - L.hPad - (_bW2 * 2 + _gap2);
  var _newX2    = L.W - L.hPad - _bW2;
  if (_click2 && _mx2 >= _replayX2 && _mx2 < _replayX2 + _bW2 && _my2 >= _bY2 && _my2 < _bY2 + _bH2) {
    newGame(scope.gs ? scope.gs.seed : undefined);
    scope._layout = null;
    return;
  }
  if (_click2 && _mx2 >= _newX2 && _mx2 < _newX2 + _bW2 && _my2 >= _bY2 && _my2 < _bY2 + _bH2) {
    newGame();
    scope._layout = null;
    return;
  }

  if (!scope.gs.won) {
    // ── Background swipe-to-pan: detect drags on game felt (no card hit) ──────
    // Swiping up   (dy < -PAN_SNAP_PX) navigates to Settings (section above).
    // Swiping down (dy >  PAN_SNAP_PX) navigates to Help    (section below).
    // A live card drag cancels any in-progress swipe gesture.
    var _pmx = ui.pointer.x();
    var _pmy = ui.pointer.y();
    var _pdn = ui.pointer.down(0);
    if (scope.gs.drag) {
      // Card drag in progress — cancel any background swipe so they don't conflict.
      scope._worldSwipe = null;
    } else if (_pdn && !scope._worldSwipe) {
      // New press: only start a world-swipe if the pointer is on empty felt.
      if (!hitTest(_pmx, _pmy, L)) {
        scope._worldSwipe = { startY: _pmy, lastY: _pmy, totalDy: 0 };
      }
    } else if (_pdn && scope._worldSwipe) {
      // Ongoing drag — accumulate vertical delta.
      scope._worldSwipe.totalDy += _pmy - scope._worldSwipe.lastY;
      scope._worldSwipe.lastY    = _pmy;
    } else if (!_pdn && scope._worldSwipe) {
      // Released — snap to the appropriate section.
      var _swipeDy = scope._worldSwipe.totalDy;
      scope._worldSwipe = null;
      if (_swipeDy < -PAN_SNAP_PX) {
        navigateToSectionWithHistory('Settings', scope.sections.play);
      } else if (_swipeDy > PAN_SNAP_PX) {
        navigateToSectionWithHistory('Help', scope.sections.play);
      }
    }

    handleInput(L);
  }
}

function updateBlock8(runtimeCtx = {}) {
  const delta = runtimeCtx.delta;
  const event = runtimeCtx.event;
  // Swipe down (dy > PAN_SNAP_PX) from Settings returns to Play.
  // Settings is above Play in world space, so dragging down moves camera toward Play.
  var _sdn = ui.pointer.down(0);
  var _spy = ui.pointer.y();
  if (_sdn && !scope._worldSwipe) {
    scope._worldSwipe = { startY: _spy, lastY: _spy, totalDy: 0 };
  } else if (_sdn && scope._worldSwipe) {
    scope._worldSwipe.totalDy += _spy - scope._worldSwipe.lastY;
    scope._worldSwipe.lastY    = _spy;
  } else if (!_sdn && scope._worldSwipe) {
    var _sDy = scope._worldSwipe.totalDy;
    scope._worldSwipe = null;
    if (_sDy > PAN_SNAP_PX) goBackInHistory('Play');
  }
}

function updateBlock9(runtimeCtx = {}) {
  const delta = runtimeCtx.delta;
  const event = runtimeCtx.event;
  // Swipe up (dy < -PAN_SNAP_PX) from Help returns to Play.
  // Help is below Play in world space, so dragging up moves camera toward Play.
  var _hdn = ui.pointer.down(0);
  var _hpy = ui.pointer.y();
  if (_hdn && !scope._worldSwipe) {
    scope._worldSwipe = { startY: _hpy, lastY: _hpy, totalDy: 0 };
  } else if (_hdn && scope._worldSwipe) {
    scope._worldSwipe.totalDy += _hpy - scope._worldSwipe.lastY;
    scope._worldSwipe.lastY    = _hpy;
  } else if (!_hdn && scope._worldSwipe) {
    var _hDy = scope._worldSwipe.totalDy;
    scope._worldSwipe = null;
    if (_hDy < -PAN_SNAP_PX) goBackInHistory('Play');
  }
}

function renderBlock10(runtimeCtx = {}) {
  const delta = runtimeCtx.delta;
  const event = runtimeCtx.event;
  term.layerID = 'default';
  term.clear();
  ui.clear();
}

function renderBlock11(runtimeCtx = {}) {
  const delta = runtimeCtx.delta;
  const event = runtimeCtx.event;
  if (!scope.gs) return;

  // Always recompute layout fresh in render so ui.metrics.canvasWidth/Height
  // return the current live-section texture dimensions (not a stale cached value
  // from the update pass which may have used different canvas dimensions).
  var L = computeLayout();
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
}
  const registeredBlocks = [
    { id: "block-1", hook: "enter", targetSectionRef: null, fn: enterBlock1 },
    { id: "block-2", hook: "enter", targetSectionRef: null, fn: enterBlock2 },
    { id: "block-3", hook: "enter", targetSectionRef: null, fn: enterBlock3 },
    { id: "block-5", hook: "init", targetSectionRef: null, fn: initBlock4 },
    { id: "block-6", hook: "input", targetSectionRef: null, fn: inputBlock5 },
    { id: "block-7", hook: "update", targetSectionRef: null, fn: updateBlock6 },
    { id: "block-8", hook: "update", targetSectionRef: "play-8", fn: updateBlock7 },
    { id: "block-9", hook: "update", targetSectionRef: "settings-17", fn: updateBlock8 },
    { id: "block-10", hook: "update", targetSectionRef: "help-39", fn: updateBlock9 },
    { id: "block-11", hook: "render", targetSectionRef: null, fn: renderBlock10 },
    { id: "block-12", hook: "render", targetSectionRef: "play-8", fn: renderBlock11 }
  ];
  const initBlocks = registeredBlocks.filter((entry) => entry.hook === 'init');
  const updateBlocks = registeredBlocks.filter((entry) => entry.hook === 'update');
  const renderBlocks = registeredBlocks.filter((entry) => entry.hook === 'render');
  const inputBlocks = registeredBlocks.filter((entry) => entry.hook === 'input');
  const dropBlocks = registeredBlocks.filter((entry) => entry.hook === 'drop');
  const exportBlocks = registeredBlocks.filter((entry) => entry.hook === 'export');
  const enterBlocks = registeredBlocks.filter((entry) => entry.hook === 'enter');
  return {
    scope,
    behaviorBlocks,
    init(runtimeCtx = {}) { runRegisteredBlocks(initBlocks, runtimeCtx, syncBindings); },
    update(runtimeCtx = {}) { runRegisteredBlocks(updateBlocks, runtimeCtx, syncBindings); },
    render(runtimeCtx = {}) { runRegisteredBlocks(renderBlocks, runtimeCtx, syncBindings); },
    input(runtimeCtx = {}) { runRegisteredBlocks(inputBlocks, runtimeCtx, syncBindings); },
    drop(runtimeCtx = {}) { runRegisteredBlocks(dropBlocks, runtimeCtx, syncBindings); },
    export(runtimeCtx = {}) { runRegisteredBlocks(exportBlocks, runtimeCtx, syncBindings); },
    enter(sectionId, runtimeCtx = {}) {
      const nextCtx = { ...runtimeCtx, currentSectionId: sectionId };
      runRegisteredBlocks(enterBlocks.filter((entry) => entry.targetSectionRef === null || entry.targetSectionRef === sectionId), nextCtx, syncBindings);
    },
  };
}
