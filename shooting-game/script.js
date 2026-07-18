const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const messageEl = document.getElementById("message");
const restartBtn = document.getElementById("restart");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const PLAYER_SPEED = 5;
const BULLET_SPEED = 7;
const BULLET_COOLDOWN = 250;
const STAR_COUNT = 80;

let player;
let bullets;
let enemies;
let explosions;
let stars;
let keys;
let score;
let lives;
let frameCount;
let enemySpawnInterval;
let lastShotTime;
let isGameOver;
let animationId;

function initStars() {
  stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random() * WIDTH,
      y: Math.random() * HEIGHT,
      size: Math.random() * 1.8 + 0.4,
      speed: Math.random() * 1.5 + 0.3,
    });
  }
}

function resetGame() {
  player = { x: WIDTH / 2 - 15, y: HEIGHT - 40, width: 30, height: 20 };
  bullets = [];
  enemies = [];
  explosions = [];
  keys = {};
  score = 0;
  lives = 3;
  frameCount = 0;
  enemySpawnInterval = 70;
  lastShotTime = 0;
  isGameOver = false;

  if (!stars) initStars();

  scoreEl.textContent = score;
  livesEl.textContent = lives;
  messageEl.textContent = "";

  cancelAnimationFrame(animationId);
  gameLoop();
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function spawnEnemy() {
  const size = 26;
  enemies.push({
    x: Math.random() * (WIDTH - size),
    y: -size,
    width: size,
    height: size,
    speed: 1.5 + Math.random() * 1.5,
  });
}

function spawnExplosion(x, y, color) {
  for (let i = 0; i < 14; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    explosions.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 24,
      maxLife: 24,
      color,
    });
  }
}

function update() {
  stars.forEach((s) => {
    s.y += s.speed;
    if (s.y > HEIGHT) {
      s.y = 0;
      s.x = Math.random() * WIDTH;
    }
  });

  if (keys["ArrowLeft"]) player.x -= PLAYER_SPEED;
  if (keys["ArrowRight"]) player.x += PLAYER_SPEED;
  player.x = Math.max(0, Math.min(WIDTH - player.width, player.x));

  if (keys["Space"] && performance.now() - lastShotTime > BULLET_COOLDOWN) {
    bullets.push({ x: player.x + player.width / 2 - 2, y: player.y, width: 4, height: 12 });
    lastShotTime = performance.now();
  }

  bullets.forEach((b) => (b.y -= BULLET_SPEED));
  bullets = bullets.filter((b) => b.y + b.height > 0);

  enemies.forEach((e) => (e.y += e.speed));

  frameCount++;
  if (frameCount % enemySpawnInterval === 0) {
    spawnEnemy();
    if (enemySpawnInterval > 25) enemySpawnInterval -= 1;
  }

  bullets.forEach((b) => {
    enemies.forEach((e) => {
      if (!b.hit && !e.hit && rectsOverlap(b, e)) {
        b.hit = true;
        e.hit = true;
        score += 10;
        scoreEl.textContent = score;
        spawnExplosion(e.x + e.width / 2, e.y + e.height / 2, "#fbbf24");
      }
    });
  });
  bullets = bullets.filter((b) => !b.hit);

  enemies.forEach((e) => {
    if (!e.hit && rectsOverlap(e, player)) {
      e.hit = true;
      spawnExplosion(e.x + e.width / 2, e.y + e.height / 2, "#f87171");
      loseLife();
    } else if (!e.hit && e.y > HEIGHT) {
      e.hit = true;
      loseLife();
    }
  });
  enemies = enemies.filter((e) => !e.hit);

  explosions.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
  });
  explosions = explosions.filter((p) => p.life > 0);
}

function loseLife() {
  lives--;
  livesEl.textContent = lives;
  if (lives <= 0) {
    endGame();
  }
}

function endGame() {
  isGameOver = true;
  messageEl.textContent = `ゲームオーバー！ スコア: ${score}`;
  cancelAnimationFrame(animationId);
}

function drawStars() {
  stars.forEach((s) => {
    ctx.fillStyle = `rgba(226, 232, 255, ${0.4 + s.speed / 3})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawPlayer(p) {
  const cx = p.x + p.width / 2;

  // エンジンの噴射炎（揺らぎ演出）
  const flameLength = 8 + Math.random() * 5;
  const flameGradient = ctx.createLinearGradient(cx, p.y + p.height, cx, p.y + p.height + flameLength);
  flameGradient.addColorStop(0, "rgba(250, 204, 21, 0.9)");
  flameGradient.addColorStop(1, "rgba(250, 204, 21, 0)");
  ctx.fillStyle = flameGradient;
  ctx.beginPath();
  ctx.moveTo(p.x + p.width * 0.38, p.y + p.height);
  ctx.lineTo(cx, p.y + p.height + flameLength);
  ctx.lineTo(p.x + p.width * 0.62, p.y + p.height);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.shadowColor = "#38bdf8";
  ctx.shadowBlur = 12;

  // 胴体（ノーズコーン＋本体）
  const bodyGradient = ctx.createLinearGradient(p.x, p.y, p.x + p.width, p.y + p.height);
  bodyGradient.addColorStop(0, "#bae6fd");
  bodyGradient.addColorStop(1, "#0284c7");
  ctx.fillStyle = bodyGradient;
  ctx.beginPath();
  ctx.moveTo(cx, p.y);
  ctx.lineTo(p.x + p.width * 0.75, p.y + p.height * 0.55);
  ctx.lineTo(p.x + p.width * 0.75, p.y + p.height);
  ctx.lineTo(p.x + p.width * 0.25, p.y + p.height);
  ctx.lineTo(p.x + p.width * 0.25, p.y + p.height * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 左右のフィン
  ctx.fillStyle = "#0ea5e9";
  ctx.beginPath();
  ctx.moveTo(p.x + p.width * 0.25, p.y + p.height * 0.6);
  ctx.lineTo(p.x, p.y + p.height);
  ctx.lineTo(p.x + p.width * 0.25, p.y + p.height);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(p.x + p.width * 0.75, p.y + p.height * 0.6);
  ctx.lineTo(p.x + p.width, p.y + p.height);
  ctx.lineTo(p.x + p.width * 0.75, p.y + p.height);
  ctx.closePath();
  ctx.fill();

  // コックピットの窓
  ctx.fillStyle = "#fef3c7";
  ctx.beginPath();
  ctx.arc(cx, p.y + p.height * 0.45, p.width * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

function drawEnemy(e) {
  const cx = e.x + e.width / 2;
  const cy = e.y + e.height / 2;

  ctx.save();
  ctx.shadowColor = "#f87171";
  ctx.shadowBlur = 10;

  // 円盤本体
  const bodyGradient = ctx.createRadialGradient(cx, cy + e.height * 0.1, 2, cx, cy + e.height * 0.1, e.width * 0.5);
  bodyGradient.addColorStop(0, "#fecaca");
  bodyGradient.addColorStop(1, "#dc2626");
  ctx.fillStyle = bodyGradient;
  ctx.beginPath();
  ctx.ellipse(cx, cy + e.height * 0.1, e.width * 0.5, e.height * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 上部ドーム
  const domeGradient = ctx.createLinearGradient(cx, cy - e.height * 0.35, cx, cy);
  domeGradient.addColorStop(0, "#fef2f2");
  domeGradient.addColorStop(1, "#fca5a5");
  ctx.fillStyle = domeGradient;
  ctx.beginPath();
  ctx.arc(cx, cy - e.height * 0.05, e.width * 0.28, Math.PI, 0, true);
  ctx.fill();

  // 点滅ライト
  ctx.fillStyle = "#fde047";
  [-0.3, 0, 0.3].forEach((offset) => {
    ctx.beginPath();
    ctx.arc(cx + e.width * offset, cy + e.height * 0.18, 1.4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawBullet(b) {
  ctx.save();
  ctx.shadowColor = "#facc15";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#fde047";
  ctx.beginPath();
  ctx.ellipse(b.x + b.width / 2, b.y + b.height / 2, b.width / 2, b.height / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawExplosions() {
  explosions.forEach((p) => {
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function draw() {
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, "#020617");
  bg.addColorStop(1, "#0f172a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  drawStars();
  drawPlayer(player);
  bullets.forEach(drawBullet);
  enemies.forEach(drawEnemy);
  drawExplosions();
}

function gameLoop() {
  if (isGameOver) return;
  update();
  draw();
  animationId = requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft" || e.code === "ArrowRight" || e.code === "Space") {
    e.preventDefault();
    keys[e.code] = true;
  }
});
window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

restartBtn.addEventListener("click", resetGame);

resetGame();
