// Home page: hero gameplay video, and the "try it" mini board in the rules section.
(function () {
  "use strict";

  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  // ---------- hero video ----------

  var video = document.querySelector(".phone-video");
  if (video) {
    if (reduceMotion) {
      video.removeAttribute("autoplay");
      video.pause();
    } else {
      // Some in-app browsers ignore the autoplay attribute until play() is called.
      var started = video.play();
      if (started && started.catch) started.catch(function () {});
    }
  }

  // ---------- try-it board ----------

  var root = document.getElementById("trial");
  if (!root) return;

  var zh = (document.documentElement.lang || "").indexOf("zh") === 0;
  var T = zh ? {
    start: "先從下面選一塊拼塊，放在左下角的起點。",
    pickPiece: "先從下面選一塊拼塊。",
    pickCellFirst: "點左下角的起點附近，看看放得下嗎。",
    pickCell: "點棋盤預覽。黃點是你可以接上去的角。",
    okFirst: "✓ 蓋住起點了！再點一次或按「放下」。",
    ok: "✓ 角碰角，可以放！再點一次或按「放下」。",
    blocked: "✗ 這裡放不下。",
    startRule: "✗ 第一塊要蓋住左下角的起點。",
    edge: "✗ 同色不能邊貼邊。",
    corner: "✗ 要用「角」接上自己的拼塊。",
    redBlocked: "紅色搶走了你的角——這就是卡位！換你了。",
    redMoved: "紅色下好了，換你。",
    redStuck: "紅色沒地方放了，換你。",
    stuck: function (n) { return "被卡住了！手上還剩 " + n + " 格，結算時就扣 " + n + " 分。"; },
    allPlaced: "全部放完了，漂亮！",
    endCta: "真正的對局最多 4 人、每人 21 塊拼塊。找朋友來一局？",
    cell: function (x, y, state) { return "第 " + (y + 1) + " 列第 " + (x + 1) + " 格" + (state ? "，" + state : ""); },
    states: { blue: "藍色", red: "紅色", start: "起點", corner: "可以接的角" },
    piece: function (n) { return n + " 格的拼塊"; }
  } : {
    start: "Pick a piece below and cover your start square in the bottom-left corner.",
    pickPiece: "Pick a piece below first.",
    pickCellFirst: "Tap near the bottom-left start square to see if it fits.",
    pickCell: "Tap the board to preview. Yellow dots are corners you can build from.",
    okFirst: "✓ Start square covered! Tap again or press Place.",
    ok: "✓ Corner to corner — that works! Tap again or press Place.",
    blocked: "✗ It doesn't fit there.",
    startRule: "✗ Your first piece must cover the start square in the bottom-left.",
    edge: "✗ Same colour can't touch along an edge.",
    corner: "✗ Connect to your own pieces at a corner.",
    redBlocked: "Red just took one of your corners — that's blocking! Your turn.",
    redMoved: "Red has moved. Your turn.",
    redStuck: "Red has nowhere to go. Your turn.",
    stuck: function (n) { return "You're boxed in! " + n + " squares left in your hand — that's −" + n + " points."; },
    allPlaced: "You placed every piece. Nice!",
    endCta: "A real game has up to 4 players with 21 pieces each. Ready to take on your friends?",
    cell: function (x, y, state) { return "Row " + (y + 1) + ", column " + (x + 1) + (state ? ", " + state : ""); },
    states: { blue: "blue", red: "red", start: "start square", corner: "open corner" },
    piece: function (n) { return n + "-square piece"; }
  };

  var N = 8;
  var START = { blue: [0, N - 1], red: [N - 1, 0] };
  var SHAPES = {
    P5: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]],
    L4: [[0, 0], [0, 1], [0, 2], [1, 2]],
    T4: [[0, 0], [1, 0], [2, 0], [1, 1]],
    Z4: [[0, 0], [1, 0], [1, 1], [2, 1]],
    I3: [[0, 0], [1, 0], [2, 0]],
    V3: [[0, 0], [1, 0], [0, 1]],
    O1: [[0, 0]]
  };
  var BLUE_SET = ["P5", "L4", "T4", "Z4", "I3"];
  var RED_SET = ["L4", "Z4", "I3", "V3", "O1"];
  // Red has already made two moves from the top-right corner.
  var RED_OPENING = [[[7, 0], [6, 0], [7, 1]], [[5, 1], [5, 2], [5, 3], [4, 2]]];
  var REASON_RANK = { blocked: 0, corner: 1, startRule: 2, edge: 3 };

  var boardEl = document.getElementById("trial-board");
  var trayEl = document.getElementById("trial-tray");
  var msgEl = document.getElementById("trial-msg");
  var placeBtn = document.getElementById("trial-place");
  var endEl = document.getElementById("trial-end");
  var endMsgEl = document.getElementById("trial-end-msg");

  var board, hand, redHand, firstMove, selected, rot, flip, ghost, lastRed, busy, over;

  // ----- geometry & rules -----

  function shapeCells(name, r, f) {
    var cells = SHAPES[name].map(function (c) { return [f ? -c[0] : c[0], c[1]]; });
    for (var i = 0; i < r; i++) cells = cells.map(function (c) { return [-c[1], c[0]]; });
    var minX = Math.min.apply(null, cells.map(function (c) { return c[0]; }));
    var minY = Math.min.apply(null, cells.map(function (c) { return c[1]; }));
    return cells
      .map(function (c) { return [c[0] - minX, c[1] - minY]; })
      .sort(function (a, b) { return a[1] - b[1] || a[0] - b[0]; });
  }

  function orientations(name) {
    var seen = {}, list = [];
    for (var f = 0; f < 2; f++) for (var r = 0; r < 4; r++) {
      var cells = shapeCells(name, r, f === 1);
      var key = cells.join(";");
      if (!seen[key]) { seen[key] = true; list.push(cells); }
    }
    return list;
  }

  function inside(x, y) { return x >= 0 && y >= 0 && x < N && y < N; }
  function at(x, y) { return inside(x, y) ? board[y][x] : undefined; }

  /** Same rules as the app: free squares, first piece on your start square, then corners only. */
  function check(color, cells) {
    var i, c;
    for (i = 0; i < cells.length; i++) {
      c = cells[i];
      if (!inside(c[0], c[1]) || board[c[1]][c[0]]) return "blocked";
    }
    if (firstMove[color]) {
      var s = START[color];
      return cells.some(function (c) { return c[0] === s[0] && c[1] === s[1]; }) ? null : "startRule";
    }
    var corner = false;
    for (i = 0; i < cells.length; i++) {
      c = cells[i];
      if (at(c[0] + 1, c[1]) === color || at(c[0] - 1, c[1]) === color ||
          at(c[0], c[1] + 1) === color || at(c[0], c[1] - 1) === color) return "edge";
      if (at(c[0] + 1, c[1] + 1) === color || at(c[0] - 1, c[1] + 1) === color ||
          at(c[0] + 1, c[1] - 1) === color || at(c[0] - 1, c[1] - 1) === color) corner = true;
    }
    return corner ? null : "corner";
  }

  /** Fit the selected piece over the tapped square, snapping to whichever of its squares makes it legal. */
  function fitOver(tx, ty) {
    var shape = shapeCells(selected, rot, flip);
    var best = null;
    for (var i = 0; i < shape.length; i++) {
      var dx = tx - shape[i][0], dy = ty - shape[i][1];
      var cells = shape.map(function (c) { return [c[0] + dx, c[1] + dy]; });
      var why = check("blue", cells);
      if (!why) return { cells: cells, ok: true, x: tx, y: ty };
      if (!best || REASON_RANK[why] > REASON_RANK[best.why]) best = { cells: cells, ok: false, why: why, x: tx, y: ty };
    }
    return best;
  }

  /** Squares where blue could still grow from. */
  function openCorners(color) {
    if (firstMove[color]) return [START[color]];
    var list = [];
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      if (board[y][x]) continue;
      if (at(x + 1, y) === color || at(x - 1, y) === color || at(x, y + 1) === color || at(x, y - 1) === color) continue;
      if (at(x + 1, y + 1) === color || at(x - 1, y + 1) === color || at(x + 1, y - 1) === color || at(x - 1, y - 1) === color) {
        list.push([x, y]);
      }
    }
    return list;
  }

  function eachLegalMove(color, names, visit) {
    names.forEach(function (name) {
      orientations(name).forEach(function (shape) {
        for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
          var cells = shape.map(function (c) { return [c[0] + x, c[1] + y]; });
          if (!check(color, cells)) visit(name, cells);
        }
      });
    });
  }

  function hasMove(color, names) {
    var found = false;
    try {
      eachLegalMove(color, names, function () { found = true; throw found; });
    } catch (e) { if (e !== true) throw e; }
    return found;
  }

  function put(color, cells) {
    cells.forEach(function (c) { board[c[1]][c[0]] = color; });
  }

  /**
   * Red plays the move that takes away the most of blue's open corners —
   * but until blue has placed a few pieces it always leaves blue a way out, so the demo isn't over in two moves.
   */
  function redMove() {
    var before = openCorners("blue").length;
    var mercy = BLUE_SET.length - hand.length < 3;
    var best = null;
    eachLegalMove("red", redHand, function (name, cells) {
      put("red", cells);
      var taken = before - openCorners("blue").length;
      var trapsBlue = mercy && taken > 0 && !hasMove("blue", hand);
      put(null, cells);
      if (trapsBlue) return;
      var score = taken * 10 + cells.length + Math.random();
      if (!best || score > best.score) best = { name: name, cells: cells, taken: taken, score: score };
    });
    if (!best) return null;
    put("red", best.cells);
    redHand.splice(redHand.indexOf(best.name), 1);
    return best;
  }

  // ----- rendering -----

  function say(text) { msgEl.textContent = text; }

  function renderBoard() {
    var corners = {};
    if (!over) openCorners("blue").forEach(function (c) { corners[c[0] + "," + c[1]] = true; });
    var ghostCells = {};
    if (ghost) ghost.cells.forEach(function (c) { ghostCells[c[0] + "," + c[1]] = true; });
    var fresh = {};
    if (lastRed) lastRed.forEach(function (c) { fresh[c[0] + "," + c[1]] = true; });

    var buttons = boardEl.children;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var key = x + "," + y;
      var cell = buttons[y * N + x];
      var owner = board[y][x];
      var isStart = firstMove.blue && x === START.blue[0] && y === START.blue[1];
      cell.className = "trial-cell" +
        (owner ? " is-" + owner : "") +
        (isStart ? " is-start" : "") +
        (!owner && corners[key] && !isStart ? " is-corner" : "") +
        (ghostCells[key] ? (ghost.ok ? " ghost-ok" : " ghost-bad") : "") +
        (fresh[key] ? " just-placed" : "");
      var state = owner ? T.states[owner] : isStart ? T.states.start : corners[key] ? T.states.corner : "";
      cell.setAttribute("aria-label", T.cell(x, y, state));
    }
  }

  function renderTray() {
    trayEl.innerHTML = "";
    hand.forEach(function (name) {
      var shape = name === selected ? shapeCells(name, rot, flip) : shapeCells(name, 0, false);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "trial-piece";
      btn.setAttribute("aria-pressed", name === selected ? "true" : "false");
      btn.setAttribute("aria-label", T.piece(shape.length));
      var w = 1 + Math.max.apply(null, shape.map(function (c) { return c[0]; }));
      var h = 1 + Math.max.apply(null, shape.map(function (c) { return c[1]; }));
      var grid = document.createElement("span");
      grid.className = "mini-shape";
      grid.style.gridTemplateColumns = "repeat(" + w + ", 10px)";
      grid.style.gridTemplateRows = "repeat(" + h + ", 10px)";
      shape.forEach(function (c) {
        var sq = document.createElement("span");
        sq.style.gridColumn = String(c[0] + 1);
        sq.style.gridRow = String(c[1] + 1);
        grid.appendChild(sq);
      });
      btn.appendChild(grid);
      btn.addEventListener("click", function () { choose(name); });
      trayEl.appendChild(btn);
    });
  }

  function render() {
    renderBoard();
    renderTray();
    placeBtn.disabled = !(ghost && ghost.ok) || busy || over;
  }

  // ----- actions -----

  function choose(name) {
    if (busy || over) return;
    selected = name;
    rot = 0;
    flip = false;
    ghost = null;
    say(firstMove.blue ? T.pickCellFirst : T.pickCell);
    render();
  }

  function preview(x, y) {
    if (busy || over) return;
    if (!selected) { say(T.pickPiece); return; }
    if (ghost && ghost.ok && ghost.x === x && ghost.y === y) { place(); return; }
    ghost = fitOver(x, y);
    say(ghost.ok ? (firstMove.blue ? T.okFirst : T.ok) : T[ghost.why]);
    render();
  }

  function turn(rotate) {
    if (!selected || busy || over) return;
    if (rotate) rot = (rot + 1) % 4; else flip = !flip;
    if (ghost) {
      ghost = fitOver(ghost.x, ghost.y);
      say(ghost.ok ? (firstMove.blue ? T.okFirst : T.ok) : T[ghost.why]);
    }
    render();
  }

  function finish(text) {
    over = true;
    ghost = null;
    selected = null;
    say(text);
    endMsgEl.textContent = T.endCta;
    endEl.hidden = false;
    render();
  }

  function place() {
    if (!ghost || !ghost.ok || busy || over) return;
    put("blue", ghost.cells);
    firstMove.blue = false;
    hand.splice(hand.indexOf(selected), 1);
    selected = null;
    ghost = null;
    lastRed = null;
    busy = true;
    render();

    setTimeout(function () {
      var move = redMove();
      lastRed = move ? move.cells : null;
      busy = false;
      if (!hand.length) { finish(T.allPlaced); return; }
      if (!hasMove("blue", hand)) {
        var left = hand.reduce(function (sum, name) { return sum + SHAPES[name].length; }, 0);
        finish(T.stuck(left));
        return;
      }
      say(!move ? T.redStuck : move.taken > 0 ? T.redBlocked : T.redMoved);
      render();
    }, reduceMotion ? 50 : 650);
  }

  function reset() {
    board = [];
    for (var y = 0; y < N; y++) { board.push([]); for (var x = 0; x < N; x++) board[y].push(null); }
    RED_OPENING.forEach(function (cells) { put("red", cells); });
    hand = BLUE_SET.slice();
    redHand = RED_SET.slice();
    firstMove = { blue: true, red: false };
    selected = null;
    rot = 0;
    flip = false;
    ghost = null;
    lastRed = null;
    busy = false;
    over = false;
    endEl.hidden = true;
    say(T.start);
    render();
  }

  // ----- wiring -----

  for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
    var cell = document.createElement("button");
    cell.type = "button";
    cell.className = "trial-cell";
    cell.addEventListener("click", preview.bind(null, x, y));
    boardEl.appendChild(cell);
  }
  document.getElementById("trial-rotate").addEventListener("click", function () { turn(true); });
  document.getElementById("trial-flip").addEventListener("click", function () { turn(false); });
  document.getElementById("trial-reset").addEventListener("click", reset);
  document.getElementById("trial-restart").addEventListener("click", reset);
  placeBtn.addEventListener("click", place);

  root.classList.add("is-ready");
  reset();
})();
