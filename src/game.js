import { Input } from './input.js';
import { net, connect, on as netOn, sendState, sendInput, sendMsg } from './network.js';
import { Tank } from './tank.js';
import { Enemy } from './enemy.js';
import { ENEMY_CONFIGS } from './ai/enemyConfig.js';
import { WORLD_W, WORLD_H, VOL_INTRO, PLAYER_HP, SHELL_RADIUS, TRACK_STAMP_DIST, TRACK_FADE_TIME, TRACK_MAX } from './config.js';
import { tintSprite } from './sprite.js';
import { COLORS } from './colors.js';
import { loadSounds, setSoundMuted } from './audio.js';
import { resolveProjectileHits } from './physics/collision.js';

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

function resize() {
  const scaleX = window.innerWidth  / WORLD_W;
  const scaleY = window.innerHeight / WORLD_H;
  const scale  = Math.min(scaleX, scaleY);
  const dpr    = window.devicePixelRatio || 1;

  // Size canvas at physical pixels so 1 canvas px = 1 screen px (no stretching)
  canvas.width  = Math.round(WORLD_W * scale * dpr);
  canvas.height = Math.round(WORLD_H * scale * dpr);
  canvas.style.width  = `${Math.round(WORLD_W * scale)}px`;
  canvas.style.height = `${Math.round(WORLD_H * scale)}px`;

  // Map game-space coordinates (0..WORLD_W) to physical canvas pixels
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
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

// WebSocket relay URL — update the production value when the server is deployed
const WS_URL = window.location.hostname === 'localhost'
  ? 'ws://localhost:8080'
  : 'wss://tank-game-production-06b0.up.railway.app';

// ─── Levels ───────────────────────────────────────────────────────────────────

const ISLAND_HALF = 250;
const ISLAND_R    = 20;
const SHORE_PAD   = 30;

const COR_W  = Math.round(ISLAND_HALF * 2 * 1.5); // 750  — 1.5× island width
const COR_H  = ISLAND_HALF * 2 * 2.5;             // 1250 — 2.5× island height
const COR_X  = (WORLD_W - COR_W) / 2;             // 225  — left edge of corridor

function drawCorridorBg(ctx) {
  const cx = WORLD_W / 2;
  const sp = COR_W / 2 + SHORE_PAD;
  ctx.fillStyle = COLORS.extended.blueDark;
  ctx.fillRect(-120, -200, WORLD_W + 240, COR_H + 400); // extra width covers camera pad gaps
  ctx.fillStyle = COLORS.sand[300];
  ctx.beginPath();
  ctx.roundRect(cx - sp, -SHORE_PAD, sp * 2, COR_H + SHORE_PAD * 2, ISLAND_R + SHORE_PAD);
  ctx.fill();
  ctx.fillStyle = COLORS.green[500];
  ctx.beginPath();
  ctx.roundRect(COR_X, 0, COR_W, COR_H, ISLAND_R);
  ctx.fill();
}

const CORRIDOR_BOUNDS = {
  minX: COR_X,
  maxX: COR_X + COR_W,
  minY: 0,
  maxY: COR_H,
};

const LEVELS = [
  {
    id:          'training',
    name:        'Training Ground',
    description: ['Single target. Practice your aim.', 'No enemies will fire back.'],
    width:  WORLD_W,
    height: WORLD_H,
    playerSpawn: { x: WORLD_W / 2, y: WORLD_H / 2 },
    bounds: {
      minX: WORLD_W / 2 - ISLAND_HALF,
      maxX: WORLD_W / 2 + ISLAND_HALF,
      minY: WORLD_H / 2 - ISLAND_HALF,
      maxY: WORLD_H / 2 + ISLAND_HALF,
    },
    drawBackground(ctx) {
      const cx = WORLD_W / 2, cy = WORLD_H / 2;
      const s  = ISLAND_HALF, sp = s + SHORE_PAD;
      ctx.fillStyle = COLORS.extended.blueDark;
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
      ctx.fillStyle = COLORS.sand[300];
      ctx.beginPath();
      ctx.roundRect(cx - sp, cy - sp, sp * 2, sp * 2, ISLAND_R + SHORE_PAD);
      ctx.fill();
      ctx.fillStyle = COLORS.green[500];
      ctx.beginPath();
      ctx.roundRect(cx - s, cy - s, s * 2, s * 2, ISLAND_R);
      ctx.fill();
    },
    spawn: () => [
      new Enemy(WORLD_W / 2 + 160, WORLD_H / 2 - 60, ENEMY_CONFIGS.infantry),
    ],
  },

  {
    id:          'level1',
    name:        'Level 1',
    description: ['10 enemies.', 'Push through to the end.'],
    width:       WORLD_W,
    height:      COR_H,
    cameraPad:   80,
    playerSpawn: { x: WORLD_W / 2, y: COR_H - 120 },
    bounds:      CORRIDOR_BOUNDS,
    drawBackground: drawCorridorBg,
    spawn: () => {
      const cx = WORLD_W / 2;
      return [
        // ── Wave 1 — 1 tank ───────────────────────────────────────────────
        new Enemy(cx,              COR_H - 680,  ENEMY_CONFIGS.infantry),

        // ── Wave 2 — 2 tanks ──────────────────────────────────────────────
        new Enemy(cx - 140,        COR_H - 860,  ENEMY_CONFIGS.infantry),
        new Enemy(cx + 140,        COR_H - 860,  ENEMY_CONFIGS.torcher),

        // ── Wave 3 — 4 tanks ──────────────────────────────────────────────
        new Enemy(cx - 250,        COR_H - 1040, ENEMY_CONFIGS.flanker),
        new Enemy(cx - 80,         COR_H - 1040, ENEMY_CONFIGS.crab),
        new Enemy(cx + 80,         COR_H - 1040, ENEMY_CONFIGS.torcher),
        new Enemy(cx + 250,        COR_H - 1040, ENEMY_CONFIGS.flanker),

        // ── Wave 4 — 3 tanks ──────────────────────────────────────────────
        new Enemy(cx - 200,        COR_H - 1160, ENEMY_CONFIGS.crab),
        new Enemy(cx,              COR_H - 1210, ENEMY_CONFIGS.torcher),
        new Enemy(cx + 200,        COR_H - 1160, ENEMY_CONFIGS.flanker),
      ];
    },
  },

  {
    id:          'level2',
    name:        'Level 2',
    description: ['Sprayers everywhere.', 'No safe angle.'],
    width:       WORLD_W,
    height:      COR_H,
    cameraPad:   80,
    playerSpawn: { x: WORLD_W / 2, y: COR_H - 120 },
    bounds:      CORRIDOR_BOUNDS,
    drawBackground: drawCorridorBg,
    spawn: () => {
      const cx = WORLD_W / 2;
      return [
        // ── Wave 1 — 1 tank ───────────────────────────────────────────────
        new Enemy(cx,              COR_H - 680,  ENEMY_CONFIGS.sprayer),

        // ── Wave 2 — 2 tanks ──────────────────────────────────────────────
        new Enemy(cx - 140,        COR_H - 860,  ENEMY_CONFIGS.sprayer),
        new Enemy(cx + 140,        COR_H - 860,  ENEMY_CONFIGS.torcher),

        // ── Wave 3 — 4 tanks ──────────────────────────────────────────────
        new Enemy(cx - 260,        COR_H - 1040, ENEMY_CONFIGS.sprayer),
        new Enemy(cx - 80,         COR_H - 1040, ENEMY_CONFIGS.flanker),
        new Enemy(cx + 80,         COR_H - 1040, ENEMY_CONFIGS.flanker),
        new Enemy(cx + 260,        COR_H - 1040, ENEMY_CONFIGS.sprayer),

        // ── Wave 4 — 3 tanks ──────────────────────────────────────────────
        new Enemy(cx - 200,        COR_H - 1160, ENEMY_CONFIGS.sprayer),
        new Enemy(cx,              COR_H - 1210, ENEMY_CONFIGS.sprayer),
        new Enemy(cx + 200,        COR_H - 1160, ENEMY_CONFIGS.infantry),
      ];
    },
  },

  {
    id:          'level3',
    name:        'Level 3',
    description: ['Crab walkers everywhere.', 'Watch your flanks.'],
    width:       WORLD_W,
    height:      COR_H,
    cameraPad:   80,
    playerSpawn: { x: WORLD_W / 2, y: COR_H - 120 },
    bounds:      CORRIDOR_BOUNDS,
    drawBackground: drawCorridorBg,
    spawn: () => {
      const cx = WORLD_W / 2;
      return [
        // ── Wave 1 — 1 crab ───────────────────────────────────────────────
        new Enemy(cx,              COR_H - 680,  ENEMY_CONFIGS.crab),

        // ── Wave 2 — 2 crabs ──────────────────────────────────────────────
        new Enemy(cx - 140,        COR_H - 860,  ENEMY_CONFIGS.crab),
        new Enemy(cx + 140,        COR_H - 860,  ENEMY_CONFIGS.crab),

        // ── Wave 3 — 4 tanks ──────────────────────────────────────────────
        new Enemy(cx - 260,        COR_H - 1040, ENEMY_CONFIGS.crab),
        new Enemy(cx - 80,         COR_H - 1040, ENEMY_CONFIGS.torcher),
        new Enemy(cx + 80,         COR_H - 1040, ENEMY_CONFIGS.flanker),
        new Enemy(cx + 260,        COR_H - 1040, ENEMY_CONFIGS.crab),

        // ── Wave 4 — 3 tanks ──────────────────────────────────────────────
        new Enemy(cx - 200,        COR_H - 1160, ENEMY_CONFIGS.crab),
        new Enemy(cx,              COR_H - 1210, ENEMY_CONFIGS.crab),
        new Enemy(cx + 200,        COR_H - 1160, ENEMY_CONFIGS.sprayer),
      ];
    },
  },

  {
    id:          'level4',
    name:        'Level 4',
    description: ['Snipers in the dark.', 'Stay unpredictable.'],
    width:       WORLD_W,
    height:      COR_H,
    cameraPad:   80,
    playerSpawn: { x: WORLD_W / 2, y: COR_H - 120 },
    bounds:      CORRIDOR_BOUNDS,
    drawBackground: drawCorridorBg,
    spawn: () => {
      const cx = WORLD_W / 2;
      return [
        // ── Wave 1 — 1 sniper ─────────────────────────────────────────────
        new Enemy(cx,              COR_H - 680,  ENEMY_CONFIGS.sniper),

        // ── Wave 2 — 1 sniper + 2 flankers ───────────────────────────────
        new Enemy(cx - 180,        COR_H - 860,  ENEMY_CONFIGS.flanker),
        new Enemy(cx,              COR_H - 900,  ENEMY_CONFIGS.sniper),
        new Enemy(cx + 180,        COR_H - 860,  ENEMY_CONFIGS.flanker),

        // ── Wave 3 — 2 snipers + 1 torcher + 1 crab ─────────────────────
        new Enemy(cx - 250,        COR_H - 1040, ENEMY_CONFIGS.sniper),
        new Enemy(cx - 80,         COR_H - 1040, ENEMY_CONFIGS.torcher),
        new Enemy(cx + 80,         COR_H - 1040, ENEMY_CONFIGS.crab),
        new Enemy(cx + 250,        COR_H - 1040, ENEMY_CONFIGS.sniper),

        // ── Wave 4 — 2 snipers + 1 flanker ───────────────────────────────
        new Enemy(cx - 180,        COR_H - 1160, ENEMY_CONFIGS.sniper),
        new Enemy(cx,              COR_H - 1210, ENEMY_CONFIGS.flanker),
        new Enemy(cx + 180,        COR_H - 1160, ENEMY_CONFIGS.sniper),
      ];
    },
  },

  {
    id:          'level5',
    name:        'Level 5',
    description: ['Watch the glow. Find the gaps.', 'Move before it splits.'],
    width:       WORLD_W,
    height:      COR_H,
    cameraPad:   80,
    playerSpawn: { x: WORLD_W / 2, y: COR_H - 120 },
    bounds:      CORRIDOR_BOUNDS,
    drawBackground: drawCorridorBg,
    spawn: () => {
      const cx = WORLD_W / 2;
      return [
        // ── Wave 1 — 1 splitter ───────────────────────────────────────────
        new Enemy(cx,              COR_H - 680,  ENEMY_CONFIGS.splitter),

        // ── Wave 2 — 2 splitters + 1 infantry ────────────────────────────
        new Enemy(cx - 160,        COR_H - 860,  ENEMY_CONFIGS.splitter),
        new Enemy(cx + 160,        COR_H - 860,  ENEMY_CONFIGS.splitter),
        new Enemy(cx,              COR_H - 820,  ENEMY_CONFIGS.infantry),

        // ── Wave 3 — 2 splitters + 1 crab + 1 flanker ────────────────────
        new Enemy(cx - 260,        COR_H - 1040, ENEMY_CONFIGS.splitter),
        new Enemy(cx - 80,         COR_H - 1040, ENEMY_CONFIGS.flanker),
        new Enemy(cx + 80,         COR_H - 1040, ENEMY_CONFIGS.crab),
        new Enemy(cx + 260,        COR_H - 1040, ENEMY_CONFIGS.splitter),

        // ── Wave 4 — 2 splitters + 1 sniper ──────────────────────────────
        new Enemy(cx - 200,        COR_H - 1160, ENEMY_CONFIGS.splitter),
        new Enemy(cx,              COR_H - 1210, ENEMY_CONFIGS.sniper),
        new Enemy(cx + 200,        COR_H - 1160, ENEMY_CONFIGS.splitter),
      ];
    },
  },

  {
    id:          'level6',
    name:        'Level 6',
    description: ['Never stop moving.', 'The ground is the danger.'],
    width:       WORLD_W,
    height:      COR_H,
    cameraPad:   80,
    playerSpawn: { x: WORLD_W / 2, y: COR_H - 120 },
    bounds:      CORRIDOR_BOUNDS,
    drawBackground: drawCorridorBg,
    spawn: () => {
      const cx = WORLD_W / 2;
      return [
        // ── Wave 1 — 1 mortar ─────────────────────────────────────────────
        new Enemy(cx,              COR_H - 680,  ENEMY_CONFIGS.mortar),

        // ── Wave 2 — 2 mortars + 1 infantry ──────────────────────────────
        new Enemy(cx - 160,        COR_H - 860,  ENEMY_CONFIGS.mortar),
        new Enemy(cx + 160,        COR_H - 860,  ENEMY_CONFIGS.mortar),
        new Enemy(cx,              COR_H - 820,  ENEMY_CONFIGS.infantry),

        // ── Wave 3 — 2 mortars + 1 sniper + 1 torcher ────────────────────
        new Enemy(cx - 260,        COR_H - 1040, ENEMY_CONFIGS.mortar),
        new Enemy(cx - 80,         COR_H - 1040, ENEMY_CONFIGS.sniper),
        new Enemy(cx + 80,         COR_H - 1040, ENEMY_CONFIGS.torcher),
        new Enemy(cx + 260,        COR_H - 1040, ENEMY_CONFIGS.mortar),

        // ── Wave 4 — 2 mortars + 1 splitter ──────────────────────────────
        new Enemy(cx - 200,        COR_H - 1160, ENEMY_CONFIGS.mortar),
        new Enemy(cx,              COR_H - 1210, ENEMY_CONFIGS.splitter),
        new Enemy(cx + 200,        COR_H - 1160, ENEMY_CONFIGS.mortar),
      ];
    },
  },
];

// ─── Audio ────────────────────────────────────────────────────────────────────

const introAudio = new Audio('assets/intro.m4a');
introAudio.loop   = false;
introAudio.volume = VOL_INTRO;
introAudio.muted  = true; // sound off by default

// ─── Game state ───────────────────────────────────────────────────────────────

// Screens: 'title' → 'level_select' → 'playing' → 'dead'
let screen        = 'title';
let selectedLevel = 0;
let activeLevel   = null;
let soundMuted    = true;

const input  = new Input();
let tank     = new Tank(WORLD_W / 2, WORLD_H / 2);
const assets = {};
let enemies  = [];
let camera   = { x: 0, y: 0 };

// ─── Screen transition helper ─────────────────────────────────────────────────

let _returnTimeout = null;

function scheduleReturn(delay) {
  clearTimeout(_returnTimeout);
  _returnTimeout = setTimeout(() => { screen = 'level_select'; }, delay);
}

// ─── Body collision resolution ────────────────────────────────────────────────

function resolveBodyCollisions(entities) {
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

// ─── Projectile collision pass ────────────────────────────────────────────────

function processProjectileHits() {
  // Player shells → enemies
  resolveProjectileHits(tank.shells, enemies);

  // Enemy shells → player  (flat array across all enemies)
  const enemyShells = enemies.flatMap(e => e.shells);
  resolveProjectileHits(enemyShells, [tank]);
}

// ─── Camera ───────────────────────────────────────────────────────────────────

function updateCamera() {
  const lw  = activeLevel?.width     ?? WORLD_W;
  const lh  = activeLevel?.height    ?? WORLD_H;
  const pad = activeLevel?.cameraPad ?? 0;
  camera.x = Math.max(-pad, Math.min(tank.x - WORLD_W / 2, lw - WORLD_W + pad));
  camera.y = Math.max(-pad, Math.min(tank.y - WORLD_H / 2, lh - WORLD_H + pad));
}

// ─── Start a level ────────────────────────────────────────────────────────────

function startLevel(index) {
  const lvl   = LEVELS[index];
  activeLevel = lvl;
  const spawn = lvl.playerSpawn ?? { x: WORLD_W / 2, y: WORLD_H / 2 };
  tank        = new Tank(spawn.x, spawn.y);
  camera      = { x: 0, y: 0 };
  enemies     = lvl.spawn();
  screen      = 'playing';
}

// ─── Draw: title ──────────────────────────────────────────────────────────────

function drawTitle() {
  ctx.fillStyle = COLORS.green[500];
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  const pw = 500, ph = 260;
  const px = (WORLD_W - pw) / 2;
  const py = (WORLD_H - ph) / 2;

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 12);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.neutral.cream;
  ctx.font = 'bold 64px monospace';
  ctx.fillText('TANK GAME', WORLD_W / 2, py + 90);

  ctx.fillStyle = COLORS.accent.gold;
  ctx.font = 'bold 20px monospace';
  ctx.fillText('S — SINGLEPLAYER', WORLD_W / 2, py + 150);

  ctx.fillStyle = COLORS.neutral.mid;
  ctx.font = 'bold 20px monospace';
  ctx.fillText('M — MULTIPLAYER', WORLD_W / 2, py + 184);

  ctx.textAlign = 'left';
  drawSoundToggle();
}

// ─── Draw: level select ───────────────────────────────────────────────────────

function drawLevelSelect() {
  ctx.fillStyle = COLORS.green[500];
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.neutral.cream;
  ctx.font = 'bold 20px monospace';
  ctx.fillText('SELECT LEVEL', WORLD_W / 2, 38);

  const cardW = 380, cardH = 88;
  const cardX = (WORLD_W - cardW) / 2;
  const cardY = 52;
  const gap   = 102;

  LEVELS.forEach((lvl, i) => {
    const cy         = cardY + i * gap;
    const isSelected = i === selectedLevel;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.roundRect(cardX + 4, cy + 4, cardW, cardH, 10);
    ctx.fill();

    ctx.fillStyle = isSelected ? COLORS.green[400] : COLORS.green[500];
    ctx.beginPath();
    ctx.roundRect(cardX, cy, cardW, cardH, 10);
    ctx.fill();

    if (isSelected) {
      ctx.strokeStyle = COLORS.accent.gold;
      ctx.lineWidth   = 3;
      ctx.beginPath();
      ctx.roundRect(cardX, cy, cardW, cardH, 10);
      ctx.stroke();
    }

    ctx.fillStyle = COLORS.neutral.cream;
    ctx.font      = 'bold 18px monospace';
    ctx.fillText(lvl.name, WORLD_W / 2, cy + 24);

    ctx.fillStyle = COLORS.sand[300];
    ctx.font      = '13px monospace';
    lvl.description.forEach((line, li) => {
      ctx.fillText(line, WORLD_W / 2, cy + 46 + li * 16);
    });
  });

  const isGunner = net.role === 'gunner' && net.ready;
  ctx.fillStyle = isGunner ? COLORS.neutral.mid : COLORS.accent.gold;
  ctx.font      = 'bold 16px monospace';
  ctx.fillText(
    isGunner ? 'Waiting for driver to choose level…' : 'press ENTER to play',
    WORLD_W / 2, cardY + LEVELS.length * gap + 20
  );

  ctx.textAlign = 'left';
  drawSoundToggle();
}

// ─── Draw: HUD ────────────────────────────────────────────────────────────────

function drawHUD() {
  ctx.save();

  // Controls panel
  ctx.fillStyle = COLORS.ui.panel + 'cc';
  ctx.fillRect(10, 10, 210, 70);
  ctx.fillStyle = COLORS.neutral.dark;
  ctx.font = 'bold 13px monospace';
  ctx.fillText('WASD — move / rotate body', 20, 30);
  ctx.fillText('← → — rotate barrel', 20, 48);
  ctx.fillText('↑ / SPACE — fire', 20, 66);

  // Player HP bar
  const barX = 10, barY = 88, barW = 210, barH = 12;
  ctx.fillStyle = COLORS.ui.health.background;
  ctx.fillRect(barX, barY, barW, barH);

  const frac  = tank.hp / PLAYER_HP;
  const hpColor = frac > 0.5 ? COLORS.ui.health.full
                : frac > 0.25 ? COLORS.ui.health.mid
                : COLORS.ui.health.low;
  ctx.fillStyle = hpColor;
  ctx.fillRect(barX, barY, barW * frac, barH);

  ctx.fillStyle = COLORS.neutral.dark;
  ctx.font = 'bold 10px monospace';
  ctx.fillText(`HP  ${tank.hp} / ${PLAYER_HP}`, barX + 4, barY + 9);

  ctx.restore();
}

// ─── Draw: win overlay ────────────────────────────────────────────────────────

function drawWinScreen() {
  if (activeLevel?.drawBackground) activeLevel.drawBackground(ctx);
  else drawGround();

  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.accent.gold;
  ctx.font = 'bold 58px monospace';
  ctx.fillText('LEVEL COMPLETE', WORLD_W / 2, WORLD_H / 2 - 20);

  ctx.fillStyle = COLORS.sand[300];
  ctx.font = 'bold 18px monospace';
  ctx.fillText('Returning to level select…', WORLD_W / 2, WORLD_H / 2 + 44);

  ctx.textAlign = 'left';
  drawSoundToggle();
}

// ─── Draw: death overlay ──────────────────────────────────────────────────────

function drawDeadScreen() {
  if (activeLevel?.drawBackground) activeLevel.drawBackground(ctx);
  else drawGround();

  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.effects.damage;
  ctx.font = 'bold 58px monospace';
  ctx.fillText('YOU WERE DESTROYED', WORLD_W / 2, WORLD_H / 2 - 20);

  ctx.fillStyle = COLORS.sand[300];
  ctx.font = 'bold 18px monospace';
  ctx.fillText('Returning to level select…', WORLD_W / 2, WORLD_H / 2 + 44);

  ctx.textAlign = 'left';
  drawSoundToggle();
}

// ─── Draw: ground ─────────────────────────────────────────────────────────────

function drawGround() {
  ctx.fillStyle = COLORS.green[500];
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
}

// ─── Draw: music toggle ───────────────────────────────────────────────────────

const SOUND_BTN = { x: WORLD_W - 52, y: 12, size: 36 };

function drawSoundToggle() {
  const { x, y, size } = SOUND_BTN;
  const cx = x + size / 2, cy = y + size / 2;
  ctx.save();

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = soundMuted ? COLORS.neutral.mid : COLORS.neutral.cream;
  ctx.font = `${Math.round(size * 0.55)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('♫', cx, cy + 1);

  if (soundMuted) {
    ctx.strokeStyle = COLORS.effects.damage;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 6);
    ctx.lineTo(x + size - 6, y + size - 6);
    ctx.stroke();
  }

  ctx.restore();
}

// ─── Input handlers ───────────────────────────────────────────────────────────

const lobbyEl   = document.getElementById('lobby');
const codeInput = document.getElementById('lobby-code');
const joinBtn   = document.getElementById('lobby-join');
const statusEl  = document.getElementById('lobby-status');

function showLobby() {
  screen = 'lobby';
  lobbyEl.classList.add('active');
  codeInput.value = '';
  statusEl.textContent = '';
  statusEl.className = '';
  joinBtn.disabled = false;
  codeInput.focus();
}

function hideLobby() {
  lobbyEl.classList.remove('active');
}

// ─── Role select UI ───────────────────────────────────────────────────────────

const roleSelectEl  = document.getElementById('role-select');
const roleDriverBtn = document.getElementById('role-driver-btn');
const roleGunnerBtn = document.getElementById('role-gunner-btn');
const rolePeerDisp  = document.getElementById('role-peer-display');
const roleConfirmBtn = document.getElementById('role-confirm-btn');
const roleStatusMsg  = document.getElementById('role-status-msg');

let myRolePref    = null;
let peerRolePref  = null;
let myConfirmed   = false;
let peerConfirmed = false;

function showRoleSelect() {
  screen = 'role_select';
  myRolePref = null;
  peerRolePref = null;
  myConfirmed = false;
  peerConfirmed = false;
  roleDriverBtn.classList.remove('selected');
  roleGunnerBtn.classList.remove('selected');
  roleDriverBtn.disabled = false;
  roleGunnerBtn.disabled = false;
  rolePeerDisp.textContent = 'Waiting for other player…';
  roleConfirmBtn.disabled = true;
  roleStatusMsg.textContent = '';
  roleSelectEl.classList.add('active');
}

function hideRoleSelect() {
  roleSelectEl.classList.remove('active');
}

function resolveRoles(myChoice, peerChoice, myServerRole) {
  if (myChoice !== peerChoice) return myChoice;
  // Both chose the same role — server join order is the tiebreaker
  // (first joiner = driver, second = gunner)
  return myServerRole;
}

function tryFinalizeRoles() {
  if (!myConfirmed || !peerConfirmed || !myRolePref || !peerRolePref) return;
  const finalRole = resolveRoles(myRolePref, peerRolePref, net.role);
  net.role = finalRole;
  roleStatusMsg.textContent = `Your role: ${finalRole.toUpperCase()}`;
  setTimeout(() => {
    hideRoleSelect();
    loadSounds();
    setSoundMuted(soundMuted);
    screen = 'level_select';
  }, 900);
}

function handleTitleKey(e) {
  if (e?.code === 'KeyM') {
    showLobby();
    return;
  }
  if (e?.code === 'KeyS' || e?.code === 'Enter' || e?.code === 'Space') {
    screen = 'level_select';
    loadSounds();
    setSoundMuted(soundMuted);
    introAudio.play().catch(() => {});
  }
}

function handleLevelSelectKey(e) {
  if (e.code === 'ArrowUp')   selectedLevel = Math.max(0, selectedLevel - 1);
  if (e.code === 'ArrowDown') selectedLevel = Math.min(LEVELS.length - 1, selectedLevel + 1);
  if (e.code === 'Enter' || e.code === 'Space') {
    if (net.role === 'gunner' && net.ready) return; // gunner waits for driver
    if (net.role === 'driver' && net.ready) {
      sendMsg({ type: 'level_choice', level: selectedLevel });
    }
    startLevel(selectedLevel);
  }
}

// ─── Multiplayer helpers ──────────────────────────────────────────────────────

const PROXY_TRAIL = 8;
const PROXY_STEP  = 7;

function _drawTrail(ctx, x, y, angle, r, alpha) {
  for (let i = 0; i < PROXY_TRAIL; i++) {
    const a  = (i + 1) / PROXY_TRAIL * alpha;
    const tx = x - Math.cos(angle) * PROXY_STEP * (PROXY_TRAIL - i);
    const ty = y - Math.sin(angle) * PROXY_STEP * (PROXY_TRAIL - i);
    ctx.globalAlpha = a;
    ctx.fillStyle = COLORS.effects.explosionMid;
    ctx.beginPath();
    ctx.arc(tx, ty, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function makeShellProxy(x, y, angle, type = 'shell', splitTimer) {
  return {
    x, y, dead: false,
    draw(ctx) {
      ctx.save();
      if (type === 'splitter') {
        const r       = SHELL_RADIUS * 2.2;
        const elapsed = Math.max(0, 2.0 - (splitTimer ?? 0));
        _drawTrail(ctx, x, y, angle, r * 0.7, 0.5);
        const pulse = Math.sin(elapsed * (8 + elapsed * 22)) * 0.5 + 0.5;
        ctx.globalAlpha = 0.18 + pulse * 0.32;
        ctx.fillStyle = '#FF4400';
        ctx.beginPath();
        ctx.arc(x, y, r * (1.9 + elapsed * 1.4), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = COLORS.effects.explosionOuter;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = COLORS.effects.explosionCore;
        ctx.beginPath(); ctx.arc(x, y, r * 0.42, 0, Math.PI * 2); ctx.fill();
      } else if (type === 'shrapnel') {
        _drawTrail(ctx, x, y, angle, 1.5, 0.4);
        ctx.fillStyle = COLORS.effects.explosionOuter;
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      } else {
        _drawTrail(ctx, x, y, angle, 2.5, 0.4);
        ctx.fillStyle = COLORS.effects.explosionOuter;
        ctx.beginPath(); ctx.arc(x, y, SHELL_RADIUS, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = COLORS.effects.explosionCore;
        ctx.beginPath(); ctx.arc(x - 1, y - 1, SHELL_RADIUS * 0.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    },
  };
}

function makeMortarProxy(ms) {
  const t     = Math.min(ms.elapsed / ms.flightTime, 1);
  const sizeT = 1 - Math.abs(t * 2 - 1);
  const r     = 4 + sizeT * 14;
  return {
    x: ms.x, y: ms.y, targetX: ms.targetX, targetY: ms.targetY,
    dead: false, landed: false,
    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = 0.18 + sizeT * 0.18;
      ctx.fillStyle = '#1A1A1A';
      ctx.beginPath();
      ctx.arc(ms.x + sizeT * 5, ms.y + sizeT * 5, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      if (sizeT > 0.15) {
        ctx.globalAlpha = sizeT * 0.28;
        ctx.fillStyle = '#FF8800';
        ctx.beginPath();
        ctx.arc(ms.x, ms.y, r * 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      const red   = Math.round(55 + sizeT * 75);
      const green = Math.round(42 + sizeT * 28);
      ctx.fillStyle = `rgb(${red},${green},42)`;
      ctx.beginPath(); ctx.arc(ms.x, ms.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.55 + sizeT * 0.45;
      ctx.fillStyle = COLORS.effects.explosionCore;
      ctx.beginPath(); ctx.arc(ms.x, ms.y, r * 0.34, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    },
  };
}

function stampTracks(entity, newX, newY, newAngle, dt) {
  const moved = Math.hypot(newX - entity._prevX, newY - entity._prevY);
  entity._trackAccum += moved;
  if (entity._trackAccum >= TRACK_STAMP_DIST) {
    entity._tracks.push({ x: newX, y: newY, angle: newAngle, life: 1 });
    if (entity._tracks.length > TRACK_MAX) entity._tracks.shift();
    entity._trackAccum = 0;
  }
  entity._prevX = newX;
  entity._prevY = newY;
  const fadeRate = 1 / TRACK_FADE_TIME;
  for (const t of entity._tracks) t.life -= fadeRate * dt;
  entity._tracks = entity._tracks.filter(t => t.life > 0);
}

function makeDriverInput(local) {
  return {
    held(code) {
      if (code === 'ArrowLeft')                   return net.gunnerInput.left;
      if (code === 'ArrowRight')                  return net.gunnerInput.right;
      if (code === 'ArrowUp' || code === 'Space') return net.gunnerInput.fire;
      return local.held(code);
    },
    clearPressed() { local.clearPressed(); },
  };
}

function serializeShell(s) {
  return {
    x: s.x, y: s.y, angle: s.angle,
    type:        s.splitTimer !== undefined ? 'splitter' : s.radius <= 3 ? 'shrapnel' : 'shell',
    splitTimer:  s.splitTimer,
  };
}

function serializeState() {
  return {
    tank: {
      x:            tank.x,
      y:            tank.y,
      bodyAngle:    tank.bodyAngle,
      barrelOffset: tank.barrelOffset,
      hp:           tank.hp,
      hitFlash:     tank._hitFlash,
      recoil:       tank._recoil,
      shells:       tank.shells.map(serializeShell),
    },
    enemies: enemies.map(e => ({
      x:            e.x,
      y:            e.y,
      bodyAngle:    e.bodyAngle,
      barrelOffset: e.barrelOffset,
      hp:           e.hp,
      recoil:       e._recoil,
      dying:        e._dying,
      done:         e._done,
      deathTimer:   e._deathTimer,
      role:         e.config.role,
      state:        e._state,
      phase:        e._phase,
      lockedAim:    e._lockedAim,
      time:         e._time,
      flaming:      e._flaming,
      playerX:      e._playerX,
      playerY:      e._playerY,
      shells:       e.shells.map(serializeShell),
      mortarShells: e._mortarShells.map(ms => ({
        x: ms.x, y: ms.y,
        startX: ms.startX, startY: ms.startY,
        targetX: ms.targetX, targetY: ms.targetY,
        flightTime: ms.flightTime, elapsed: ms.elapsed,
      })),
      mortarTargetX: e._mortarTargetX,
      mortarTargetY: e._mortarTargetY,
      blastFlashes:  e._blastFlashes,
    })),
    camera: { x: camera.x, y: camera.y },
  };
}

function applySnapshot(snap, dt) {
  stampTracks(tank, snap.tank.x, snap.tank.y, snap.tank.bodyAngle, dt);
  tank.x            = snap.tank.x;
  tank.y            = snap.tank.y;
  tank.bodyAngle    = snap.tank.bodyAngle;
  tank.barrelOffset = snap.tank.barrelOffset;
  tank.hp           = snap.tank.hp;
  tank._hitFlash    = snap.tank.hitFlash;
  tank._recoil      = snap.tank.recoil;
  tank.shells       = snap.tank.shells.map(s => makeShellProxy(s.x, s.y, s.angle, s.type, s.splitTimer));

  while (enemies.length < snap.enemies.length) {
    const role = snap.enemies[enemies.length].role;
    enemies.push(new Enemy(0, 0, ENEMY_CONFIGS[role] ?? ENEMY_CONFIGS.infantry));
  }
  if (enemies.length > snap.enemies.length) {
    enemies = enemies.slice(0, snap.enemies.length);
  }

  snap.enemies.forEach((es, i) => {
    const e          = enemies[i];
    stampTracks(e, es.x, es.y, es.bodyAngle, dt);
    e.x              = es.x;
    e.y              = es.y;
    e.bodyAngle      = es.bodyAngle;
    e.barrelOffset   = es.barrelOffset;
    e.hp             = es.hp;
    e._recoil        = es.recoil;
    e._dying         = es.dying;
    e._done          = es.done;
    e._deathTimer    = es.deathTimer;
    e._state         = es.state;
    e._phase         = es.phase;
    e._lockedAim     = es.lockedAim;
    e._time          = es.time;
    e._flaming       = es.flaming;
    e._playerX       = es.playerX;
    e._playerY       = es.playerY;
    e.shells         = es.shells.map(s => makeShellProxy(s.x, s.y, s.angle, s.type, s.splitTimer));
    e._mortarShells  = (es.mortarShells ?? []).map(makeMortarProxy);
    e._mortarTargetX = es.mortarTargetX;
    e._mortarTargetY = es.mortarTargetY;
    e._blastFlashes  = es.blastFlashes ?? [];
  });

  camera.x = snap.camera.x;
  camera.y = snap.camera.y;
}

// ─── Game loop ────────────────────────────────────────────────────────────────

let lastTime = null;

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  if (screen === 'title') {
    drawTitle();
    requestAnimationFrame(loop);
    return;
  }

  if (screen === 'level_select') {
    drawLevelSelect();
    requestAnimationFrame(loop);
    return;
  }

  if (screen === 'lobby' || screen === 'role_select') {
    drawTitle();  // rendered behind the HTML overlay
    requestAnimationFrame(loop);
    return;
  }

  if (screen === 'dead') {
    drawDeadScreen();
    requestAnimationFrame(loop);
    return;
  }

  if (screen === 'win') {
    drawWinScreen();
    requestAnimationFrame(loop);
    return;
  }

  // ── Update ──────────────────────────────────────────────────────────────

  if (net.role === 'gunner' && net.ready) {
    // Gunner: relay local barrel/fire input to driver, render from snapshot
    sendInput({
      left:  input.held('ArrowLeft'),
      right: input.held('ArrowRight'),
      fire:  input.held('ArrowUp') || input.held('Space'),
    });
    input.clearPressed();
    if (net.snapshot) applySnapshot(net.snapshot, dt);

  } else {
    // Driver or solo: run full physics simulation
    const effectiveInput = (net.role === 'driver' && net.ready)
      ? makeDriverInput(input)
      : input;

    tank.update(dt, effectiveInput);
    input.clearPressed();

    // Clamp player to level bounds
    const b  = activeLevel?.bounds ?? { minX: 0, maxX: WORLD_W, minY: 0, maxY: WORLD_H };
    const hw = tank.bodyW / 2, hh = tank.bodyH / 2;
    tank.x = Math.max(b.minX + hw, Math.min(b.maxX - hw, tank.x));
    tank.y = Math.max(b.minY + hh, Math.min(b.maxY - hh, tank.y));

    for (const enemy of enemies) enemy.update(dt, tank, enemies);

    // Clamp all enemies to level bounds (locomotion + impulse both land here)
    for (const enemy of enemies) {
      const er = enemy.collisionRadius;
      enemy.x = Math.max(b.minX + er, Math.min(b.maxX - er, enemy.x));
      enemy.y = Math.max(b.minY + er, Math.min(b.maxY - er, enemy.y));
    }

    // Projectile hit resolution — applies damage + impulse, marks shells dead
    processProjectileHits();

    // Remove enemies whose death animation has fully completed
    enemies = enemies.filter(e => !e._done);

    // Win: all enemies cleared
    if (enemies.length === 0) {
      screen = 'win';
      if (net.role === 'driver' && net.ready) sendMsg({ type: 'game_over', result: 'win' });
      scheduleReturn(3000);
      requestAnimationFrame(loop);
      return;
    }

    // Lose: player destroyed
    if (!tank.alive) {
      screen = 'dead';
      if (net.role === 'driver' && net.ready) sendMsg({ type: 'game_over', result: 'lose' });
      scheduleReturn(3000);
      requestAnimationFrame(loop);
      return;
    }

    // Body overlap resolution
    resolveBodyCollisions([tank, ...enemies]);

    // Driver: broadcast authoritative state to gunner
    if (net.role === 'driver' && net.ready) {
      sendState(serializeState());
    }
  }

  // ── Draw ────────────────────────────────────────────────────────────────

  updateCamera();

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(-camera.x, -camera.y);

  if (activeLevel?.drawBackground) activeLevel.drawBackground(ctx);
  else drawGround();

  tank.drawTracks(ctx);
  for (const enemy of enemies) enemy.drawTracks(ctx);
  tank.draw(ctx, assets);
  for (const enemy of enemies) enemy.draw(ctx, assets);

  ctx.restore();

  drawHUD();
  drawSoundToggle();

  // Hit flash overlay — drawn last so it sits on top of everything
  if (tank._hitFlash > 0) {
    ctx.fillStyle = `rgba(220,50,50,${(tank._hitFlash / 0.25) * 0.30})`;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }

  requestAnimationFrame(loop);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const [body, barrel, octaBarrel, twinBarrel, sniperBarrel, splitterBarrel, mortarBarrel] = await Promise.all([
    loadImage('assets/tank_body.png'),
    loadImage('assets/tank_barrel.png'),
    loadImage('assets/tank_octa_barrel.png'),
    loadImage('assets/tank_twin_barrel.png'),
    loadImage('assets/tank_heavy_sniper_barrel.png'),
    loadImage('assets/tank_splitter_barrel.png'),
    loadImage('assets/tank_mortar_barrel.png'),
  ]);

  assets.tankBody   = tintSprite(body,   COLORS.tank.green);
  assets.tankBarrel = tintSprite(barrel, COLORS.tank.green);

  assets.enemies = {};
  for (const [role, cfg] of Object.entries(ENEMY_CONFIGS)) {
    const barrelSrc = role === 'sprayer'  ? octaBarrel
                    : role === 'crab'     ? twinBarrel
                    : role === 'sniper'   ? sniperBarrel
                    : role === 'splitter' ? splitterBarrel
                    : role === 'mortar'   ? mortarBarrel
                    : barrel;
    assets.enemies[role] = {
      body:    tintSprite(body,      cfg.color),
      barrel:  tintSprite(barrelSrc, cfg.color),
      charred: tintSprite(body,      COLORS.neutral.charcoal),
    };
  }

  window.addEventListener('keydown', e => {
    if (screen === 'title')        { handleTitleKey(e); return; }
    if (screen === 'level_select') { handleLevelSelectKey(e); return; }
    if (screen === 'lobby'       && e.code === 'Escape') { hideLobby(); screen = 'title'; return; }
    if (screen === 'role_select' && e.code === 'Escape') { hideRoleSelect(); screen = 'title'; return; }
    if (screen === 'dead' || screen === 'win') { clearTimeout(_returnTimeout); screen = 'level_select'; return; }
  });

  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const cx   = (e.clientX - rect.left) * (WORLD_W / rect.width);
    const cy   = (e.clientY - rect.top)  * (WORLD_H / rect.height);
    const btn  = SOUND_BTN;
    if (cx >= btn.x && cx <= btn.x + btn.size && cy >= btn.y && cy <= btn.y + btn.size) {
      soundMuted = !soundMuted;
      setSoundMuted(soundMuted);
      introAudio.muted = soundMuted;
    }
  });

  // ── Lobby UI wiring ───────────────────────────────────────────────────────

  function joinRoom() {
    const code = codeInput.value.trim().toUpperCase();
    if (code.length < 1) return;
    joinBtn.disabled = true;
    statusEl.className = '';
    statusEl.textContent = 'Connecting…';
    connect(code, WS_URL);
  }

  netOn('role', role => {
    statusEl.className = `role-${role}`;
    statusEl.textContent = role === 'driver'
      ? 'You drive. Waiting for gunner…'
      : 'You aim & fire. Waiting for driver…';
  });

  netOn('ready', () => {
    statusEl.textContent = 'Both players connected!';
    setTimeout(() => {
      hideLobby();
      showRoleSelect();
    }, 600);
  });

  netOn('peer_disconnected', () => {
    if (screen === 'role_select') { hideRoleSelect(); screen = 'title'; return; }
    statusEl.className = 'error';
    statusEl.textContent = 'Other player disconnected.';
    joinBtn.disabled = false;
  });

  // ── Role select button wiring ─────────────────────────────────────────────

  function selectRole(role) {
    myRolePref = role;
    roleDriverBtn.classList.toggle('selected', role === 'driver');
    roleGunnerBtn.classList.toggle('selected', role === 'gunner');
    roleConfirmBtn.disabled = false;
    sendMsg({ type: 'role_pref', role });
  }

  roleDriverBtn.addEventListener('click', () => selectRole('driver'));
  roleGunnerBtn.addEventListener('click', () => selectRole('gunner'));

  roleConfirmBtn.addEventListener('click', () => {
    if (!myRolePref) return;
    myConfirmed = true;
    roleConfirmBtn.disabled = true;
    roleDriverBtn.disabled = true;
    roleGunnerBtn.disabled = true;
    roleStatusMsg.textContent = peerConfirmed
      ? 'Finalizing roles…'
      : 'Waiting for other player to confirm…';
    sendMsg({ type: 'role_confirm' });
    tryFinalizeRoles();
  });

  netOn('role_pref', peerRole => {
    peerRolePref = peerRole;
    rolePeerDisp.textContent = `Other player: ${peerRole === 'driver' ? 'DRIVER' : 'GUNNER'}`;
    tryFinalizeRoles();
  });

  netOn('role_confirm', () => {
    peerConfirmed = true;
    if (myConfirmed) {
      roleStatusMsg.textContent = 'Finalizing roles…';
    } else {
      roleStatusMsg.textContent = 'Other player confirmed. Make your choice!';
    }
    tryFinalizeRoles();
  });

  netOn('level_choice', level => {
    startLevel(level);
  });

  netOn('game_over', result => {
    screen = result === 'win' ? 'win' : 'dead';
    scheduleReturn(3000);
  });

  joinBtn.addEventListener('click', joinRoom);

  codeInput.addEventListener('keydown', e => {
    if (e.code === 'Enter') joinRoom();
  });

  requestAnimationFrame(loop);
}

init();
