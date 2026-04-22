import { Input } from './input.js';
import { Tank } from './tank.js';
import { Enemy } from './enemy.js';
import { ENEMY_CONFIGS } from './ai/enemyConfig.js';
import { WORLD_W, WORLD_H } from './config.js';
import { tintSprite } from './sprite.js';
import { COLORS } from './colors.js';
import { loadSounds } from './audio.js';

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

function resize() {
  const scaleX = window.innerWidth / WORLD_W;
  const scaleY = window.innerHeight / WORLD_H;
  const scale  = Math.min(scaleX, scaleY);
  canvas.width  = WORLD_W;
  canvas.height = WORLD_H;
  canvas.style.width  = `${WORLD_W * scale}px`;
  canvas.style.height = `${WORLD_H * scale}px`;
}
resize();
window.addEventListener('resize', resize);

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

// ─── Audio ────────────────────────────────────────────────────────────────────

const introAudio = new Audio('assets/intro.m4a');
introAudio.loop   = false;
introAudio.volume = 0.8;

// ─── Game state ───────────────────────────────────────────────────────────────

const input  = new Input();
const tank   = new Tank(WORLD_W / 2, WORLD_H / 2);
const assets = {};
let enemies  = [];
let gameStarted = false;

// ─── Collision ────────────────────────────────────────────────────────────────

function resolveCollisions(entities) {
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const a  = entities[i];
      const b  = entities[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist    = Math.hypot(dx, dy);
      const minDist = a.collisionRadius + b.collisionRadius;
      if (dist > 0 && dist < minDist) {
        const push = (minDist - dist) * 0.5;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
}

// ─── Title screen ─────────────────────────────────────────────────────────────

function drawTitleScreen() {
  // Background
  ctx.fillStyle = COLORS.green[500];
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Dark overlay panel
  const pw = 500, ph = 220;
  const px = (WORLD_W - pw) / 2;
  const py = (WORLD_H - ph) / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 12);
  ctx.fill();

  // Title
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.neutral.cream;
  ctx.font = `bold 64px monospace`;
  ctx.fillText('TANK GAME', WORLD_W / 2, py + 90);

  // Subtitle
  ctx.fillStyle = COLORS.sand[300];
  ctx.font = 'bold 18px monospace';
  ctx.fillText('press any key to start', WORLD_W / 2, py + 150);

  ctx.textAlign = 'left';
}

// ─── HUD ──────────────────────────────────────────────────────────────────────

function drawHUD(ctx) {
  ctx.save();
  ctx.fillStyle = COLORS.ui.panel + 'cc';
  ctx.fillRect(10, 10, 210, 70);
  ctx.fillStyle = COLORS.neutral.dark;
  ctx.font = 'bold 13px monospace';
  ctx.fillText('WASD — move / rotate body', 20, 30);
  ctx.fillText('← → — rotate barrel', 20, 48);
  ctx.fillText('↑ / SPACE — fire', 20, 66);
  ctx.restore();
}

// ─── Ground ───────────────────────────────────────────────────────────────────

function drawGround(ctx) {
  ctx.fillStyle = COLORS.green[500];
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
}

// ─── Game loop ────────────────────────────────────────────────────────────────

let lastTime = null;

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  if (!gameStarted) {
    drawTitleScreen();
    requestAnimationFrame(loop);
    return;
  }

  tank.update(dt, input);
  input.clearPressed();

  const hw = tank.bodyW / 2, hh = tank.bodyH / 2;
  tank.x = Math.max(hw, Math.min(WORLD_W - hw, tank.x));
  tank.y = Math.max(hh, Math.min(WORLD_H - hh, tank.y));

  for (const enemy of enemies) enemy.update(dt, tank, enemies);
  resolveCollisions([tank, ...enemies]);

  drawGround(ctx);
  tank.drawTracks(ctx);
  for (const enemy of enemies) enemy.drawTracks(ctx);
  tank.draw(ctx, assets);
  for (const enemy of enemies) enemy.draw(ctx, assets);
  drawHUD(ctx);

  requestAnimationFrame(loop);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const [body, barrel] = await Promise.all([
    loadImage('assets/tank_body.png'),
    loadImage('assets/tank_barrel.png'),
  ]);

  assets.tankBody   = tintSprite(body,   COLORS.tank.green);
  assets.tankBarrel = tintSprite(barrel, COLORS.tank.green);

  assets.enemies = {};
  for (const [role, cfg] of Object.entries(ENEMY_CONFIGS)) {
    assets.enemies[role] = {
      body:   tintSprite(body,   cfg.color),
      barrel: tintSprite(barrel, cfg.color),
    };
  }

  enemies = [
    new Enemy(200, 160, ENEMY_CONFIGS.chaser),
    new Enemy(950, 150, ENEMY_CONFIGS.sniper),
    new Enemy(150, 580, ENEMY_CONFIGS.flanker),
  ];

  // Any key starts the game and plays the intro track
  window.addEventListener('keydown', () => {
    if (gameStarted) return;
    gameStarted = true;
    loadSounds();
    introAudio.play().catch(() => {});
  }, { once: true });

  requestAnimationFrame(loop);
}

init();
