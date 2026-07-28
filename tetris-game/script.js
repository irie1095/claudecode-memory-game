const boardCanvas = document.getElementById("board");
const boardCtx = boardCanvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");
const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const messageEl = document.getElementById("message");
const restartBtn = document.getElementById("restart");

const COLS = 10;
const ROWS = 20;
const CELL = boardCanvas.width / COLS;
const SCORE_TABLE = { 1: 100, 2: 300, 3: 500, 4: 800 };

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
};

const COLORS = {
  I: "#38bdf8",
  J: "#6366f1",
  L: "#f97316",
  O: "#facc15",
  S: "#4ade80",
  T: "#c084fc",
  Z: "#f87171",
};

let board;
let current;
let next;
let bag = [];
let score;
let linesCleared;
let level;
let dropInterval;
let dropCounter;
let lastTime;
let isGameOver;
let animationId;

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function nextTypeFromBag() {
  if (bag.length === 0) {
    bag = shuffle(Object.keys(SHAPES));
  }
  return bag.pop();
}

function createPiece(type) {
  const matrix = SHAPES[type].map((row) => [...row]);
  return {
    type,
    matrix,
    color: COLORS[type],
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: 0,
  };
}

function randomPiece() {
  return createPiece(nextTypeFromBag());
}

function rotateMatrix(matrix) {
  const n = matrix.length;
  return matrix.map((row, i) => row.map((_, j) => matrix[n - j - 1][i]));
}

function collides(matrix, offsetX, offsetY) {
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      if (!matrix[y][x]) continue;
      const boardX = offsetX + x;
      const boardY = offsetY + y;
      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return true;
      if (boardY >= 0 && board[boardY][boardX]) return true;
    }
  }
  return false;
}

function computeDropInterval(lv) {
  return Math.max(120, 800 - (lv - 1) * 70);
}

function spawnPiece() {
  current = next || randomPiece();
  next = randomPiece();
  drawNext();
  if (collides(current.matrix, current.x, current.y)) {
    endGame();
  }
}

function move(dx) {
  if (isGameOver) return;
  if (!collides(current.matrix, current.x + dx, current.y)) {
    current.x += dx;
  }
}

function tryRotate() {
  if (isGameOver) return;
  const rotated = rotateMatrix(current.matrix);
  for (const kick of [0, -1, 1, -2, 2]) {
    if (!collides(rotated, current.x + kick, current.y)) {
      current.matrix = rotated;
      current.x += kick;
      return;
    }
  }
}

function lockPiece() {
  current.matrix.forEach((row, y) => {
    row.forEach((v, x) => {
      if (v && current.y + y >= 0) {
        board[current.y + y][current.x + x] = current.color;
      }
    });
  });
  clearLines();
  spawnPiece();
}

function clearLines() {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every((cell) => cell)) {
      board.splice(y, 1);
      board.unshift(new Array(COLS).fill(null));
      cleared++;
      y++;
    }
  }
  if (cleared > 0) {
    score += (SCORE_TABLE[cleared] || 0) * level;
    scoreEl.textContent = score;
    linesCleared += cleared;
    linesEl.textContent = linesCleared;
    const newLevel = Math.floor(linesCleared / 10) + 1;
    if (newLevel !== level) {
      level = newLevel;
      levelEl.textContent = level;
      dropInterval = computeDropInterval(level);
    }
  }
}

function softDrop() {
  if (isGameOver) return;
  if (!collides(current.matrix, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    scoreEl.textContent = score;
  } else {
    lockPiece();
  }
  dropCounter = 0;
}

function hardDrop() {
  if (isGameOver) return;
  while (!collides(current.matrix, current.x, current.y + 1)) {
    current.y++;
    score += 2;
  }
  scoreEl.textContent = score;
  lockPiece();
  dropCounter = 0;
}

function getGhostY() {
  let gy = current.y;
  while (!collides(current.matrix, current.x, gy + 1)) gy++;
  return gy;
}

function endGame() {
  isGameOver = true;
  messageEl.textContent = `ゲームオーバー！ スコア: ${score}`;
  cancelAnimationFrame(animationId);
}

function drawCell(ctx, px, py, color, size, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
  ctx.globalAlpha = 1;
}

function drawBoard() {
  boardCtx.fillStyle = "#0f172a";
  boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

  boardCtx.strokeStyle = "rgba(148, 163, 184, 0.08)";
  for (let x = 1; x < COLS; x++) {
    boardCtx.beginPath();
    boardCtx.moveTo(x * CELL, 0);
    boardCtx.lineTo(x * CELL, boardCanvas.height);
    boardCtx.stroke();
  }
  for (let y = 1; y < ROWS; y++) {
    boardCtx.beginPath();
    boardCtx.moveTo(0, y * CELL);
    boardCtx.lineTo(boardCanvas.width, y * CELL);
    boardCtx.stroke();
  }

  board.forEach((row, y) => {
    row.forEach((color, x) => {
      if (color) drawCell(boardCtx, x * CELL, y * CELL, color, CELL);
    });
  });

  const ghostY = getGhostY();
  current.matrix.forEach((row, y) => {
    row.forEach((v, x) => {
      if (v) drawCell(boardCtx, (current.x + x) * CELL, (ghostY + y) * CELL, current.color, CELL, 0.2);
    });
  });

  current.matrix.forEach((row, y) => {
    row.forEach((v, x) => {
      if (v && current.y + y >= 0) {
        drawCell(boardCtx, (current.x + x) * CELL, (current.y + y) * CELL, current.color, CELL);
      }
    });
  });
}

function drawNext() {
  nextCtx.fillStyle = "#0f172a";
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  const size = 20;
  const offsetX = (nextCanvas.width - next.matrix[0].length * size) / 2;
  const offsetY = (nextCanvas.height - next.matrix.length * size) / 2;

  next.matrix.forEach((row, y) => {
    row.forEach((v, x) => {
      if (v) drawCell(nextCtx, offsetX + x * size, offsetY + y * size, next.color, size);
    });
  });
}

function draw() {
  drawBoard();
}

function gameLoop(time = 0) {
  if (isGameOver) return;
  if (lastTime === null) lastTime = time;
  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;
  if (dropCounter > dropInterval) {
    if (!collides(current.matrix, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
    dropCounter = 0;
  }
  draw();
  animationId = requestAnimationFrame(gameLoop);
}

function initGame() {
  board = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
  score = 0;
  linesCleared = 0;
  level = 1;
  dropInterval = computeDropInterval(level);
  dropCounter = 0;
  lastTime = null;
  isGameOver = false;
  bag = [];
  next = null;

  scoreEl.textContent = score;
  linesEl.textContent = linesCleared;
  levelEl.textContent = level;
  messageEl.textContent = "";

  spawnPiece();

  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Space"].includes(e.code)) {
    e.preventDefault();
  }
  switch (e.code) {
    case "ArrowLeft":
      move(-1);
      break;
    case "ArrowRight":
      move(1);
      break;
    case "ArrowDown":
      softDrop();
      break;
    case "ArrowUp":
      tryRotate();
      break;
    case "Space":
      hardDrop();
      break;
  }
});

function bindRepeat(el, action, interval = 100, initialDelay = 220) {
  let repeatTimer = null;
  let delayTimer = null;

  const start = (e) => {
    e.preventDefault();
    action();
    delayTimer = setTimeout(() => {
      repeatTimer = setInterval(action, interval);
    }, initialDelay);
  };

  const stop = (e) => {
    e.preventDefault();
    clearTimeout(delayTimer);
    clearInterval(repeatTimer);
  };

  el.addEventListener("pointerdown", start);
  el.addEventListener("pointerup", stop);
  el.addEventListener("pointerleave", stop);
  el.addEventListener("pointercancel", stop);
}

bindRepeat(document.getElementById("btn-left"), () => move(-1));
bindRepeat(document.getElementById("btn-right"), () => move(1));
bindRepeat(document.getElementById("btn-down"), () => softDrop());

document.getElementById("btn-rotate").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  tryRotate();
});
document.getElementById("btn-drop").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  hardDrop();
});

restartBtn.addEventListener("click", initGame);

initGame();
