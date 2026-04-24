import { Shell } from './shell.js';
import {
  BARREL_PIVOT_FRAC, BARREL_MOUNT_Y,
  RECOIL_AMOUNT, RECOIL_RETURN,
  TRACK_STAMP_DIST, TRACK_FADE_TIME, TRACK_MAX,
  SHELL_SPEED,
} from './config.js';
import { COLORS } from './colors.js';
import { playSound } from './audio.js';
import { LAYER } from './physics/collision.js';
import { IMPACT } from './config.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATE = { IDLE: 'idle', CHASE: 'chase', ATTACK: 'attack', REPOSITION: 'reposition', RETREAT: 'retreat', PATROL: 'patrol' };
const PHASE = { AIMING: 'aiming', FIRING: 'firing', COOLDOWN: 'cooldown' };

const BODY_TURN_SPEED   = 2.6;
const SEPARATION_RADIUS = 58;
const SEPARATION_FORCE  = 190;

const BARREL_H = 33;
const TRACK_SIDE = 11, TRACK_W = 3, TRACK_H_PX = 10;

// HP bar display
const HP_BAR_W  = 34;
const HP_BAR_H  = 4;
const HP_BAR_Y  = -28; // above tank centre

// ─── Enemy ────────────────────────────────────────────────────────────────────

export class Enemy {
  constructor(x, y, config) {
    this.x      = x;
    this.y      = y;
    this.config = config;

    this.bodyAngle    = Math.random() * Math.PI * 2;
    this.barrelOffset = 0;
    this.shells       = [];
    this.hp           = config.hp;
    this.maxHp        = config.hp;

    // Identity / collision
    this.alive = true;
    this.layer = LAYER.ENEMY;
    this.collisionRadius = 18;

    // ── Death animation ──
    this._dying      = false;
    this._done       = false;
    this._deathTimer = 0;

    // ── State machine ──
    this._state = config.behavior.patrol ? STATE.PATROL : STATE.IDLE;
    this._phase = PHASE.COOLDOWN;

    this._pendingState  = null;
    this._reactionTimer = 0;

    // ── Attack ──
    this._aimTimer       = 0;
    this._cooldownTimer  = 0;
    this._burstRemaining = 0;
    this._burstTimer     = 0;
    this._lockedAim      = 0;

    // ── Movement ──
    this._orbitDir  = Math.random() < 0.5 ? 1 : -1;
    this._speedMult = 0.9 + Math.random() * 0.2;

    // ── Flanker reposition ──
    this._repositionTimer = 0;

    // ── Patrol ──
    this._waypointIndex = 0;
    this._waypoints     = config.behavior.patrol
      ? this._buildSquareWaypoints(x, y, config.behavior.patrol.size)
      : [];

    // ── Recoil ──
    this._recoil = 0;

    // ── Flame ──
    this._flaming       = false;
    this._time          = 0;
    this._sparks        = [];
    this._sparkTimer    = 0;
    this._flameContactX = 0;
    this._flameContactY = 0;
    this._playerX       = 0;
    this._playerY       = 0;

    // ── Impulse / external motion ──
    this._physProfile = config.physicalProfile;
    this._impulseVx   = 0;
    this._impulseVy   = 0;

    // ── Tracks ──
    this._tracks     = [];
    this._trackAccum = 0;
    this._prevX = x;
    this._prevY = y;
  }

  // ─── Public interface ─────────────────────────────────────────────────────

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.alive  = false;
      this._dying = true;
    }
  }

  // angle    : world angle the force came from (shell travel direction)
  // rawForce : px/s at mass=1, resistance=0
  applyImpulse(angle, rawForce) {
    const p     = this._physProfile;
    const speed = (rawForce / p.mass) * (1 - p.knockbackResistance);

    this._impulseVx += Math.cos(angle) * speed;
    this._impulseVy += Math.sin(angle) * speed;

    const total = Math.hypot(this._impulseVx, this._impulseVy);
    if (total > p.maxImpactSpeed) {
      const s = p.maxImpactSpeed / total;
      this._impulseVx *= s;
      this._impulseVy *= s;
    }
  }

  // ─── Public Update ────────────────────────────────────────────────────────

  update(dt, player, allEnemies) {
    if (this._dying) { this._updateDeath(dt); return; }
    if (!this.alive)  return;

    this._time   += dt;
    // Torcher shows the flame whenever actively engaged (not idle)
    this._flaming = this.config.attack?.type === 'flame' && this._state !== STATE.IDLE;

    const dx   = player.x - this.x;
    const dy   = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    // Flame damage fires in any engaged state — not gated by ATTACK phase
    if (this._flaming) {
      this._playerX = player.x;
      this._playerY = player.y;
      if (dist < this.config.attack.range) {
        player.takeDamage(this.config.attack.damage * dt);
        this._flameContactX = player.x;
        this._flameContactY = player.y;
        this._sparkTimer -= dt;
        if (this._sparkTimer <= 0) {
          this._spawnSparks();
          this._sparkTimer = 0.04;
        }
      }
    }
    const cfg  = this.config;
    const beh  = cfg.behavior;

    // 1. Apply pending state after reaction delay
    if (this._pendingState !== null) {
      this._reactionTimer -= dt;
      if (this._reactionTimer <= 0) {
        this._state        = this._pendingState;
        this._pendingState = null;
        this._onEnterState(this._state, dist, cfg);
      }
    }

    // 2. Evaluate transitions
    const lowHp  = this.hp / this.maxHp < beh.retreatThreshold;
    const inSight = dist < beh.sightRange;
    const inRange = dist < beh.attackRange;
    const safeNow = dist > beh.attackRange * 1.6;

    if (this._pendingState === null) {
      if (lowHp && this._state !== STATE.RETREAT) {
        this._queueState(STATE.RETREAT, beh.reactionDelay);
      } else if (!lowHp && this._state === STATE.RETREAT && safeNow) {
        this._queueState(STATE.CHASE, beh.reactionDelay);
      } else if ((this._state === STATE.IDLE || this._state === STATE.PATROL) && inSight) {
        this._queueState(STATE.CHASE, beh.reactionDelay);
      } else if (this._state === STATE.CHASE && inRange) {
        this._queueState(STATE.ATTACK, beh.reactionDelay);
      } else if (this._state === STATE.ATTACK && !inRange) {
        this._queueState(STATE.CHASE, beh.reactionDelay * 0.5);
      } else if (this._state === STATE.REPOSITION) {
        this._repositionTimer -= dt;
        if (this._repositionTimer <= 0) {
          this._queueState(inRange ? STATE.ATTACK : STATE.CHASE, 0);
        }
      }
    }

    // 3. Execute current state
    switch (this._state) {
      case STATE.IDLE:
        if (this.config.behavior.idleRotate !== false) this.bodyAngle += 0.4 * dt;
        break;

      case STATE.CHASE:
        this._applyMovement(dx, dy, dist, dt, 1.0);
        break;

      case STATE.ATTACK:
        this._updateAttack(dx, dy, dist, dt, player);
        break;

      case STATE.REPOSITION:
        this._applyMovement(dx, dy, dist, dt, 1.0);
        break;

      case STATE.PATROL:
        this._updatePatrol(dt);
        break;

      case STATE.RETREAT: {
        const away = Math.atan2(-dy, -dx);
        const spd  = cfg.movement.speed * this._speedMult * 1.25;
        this._turnBodyTo(away, dt);
        this.x += Math.cos(this.bodyAngle) * spd * dt;
        this.y += Math.sin(this.bodyAngle) * spd * dt;
        break;
      }
    }

    // 4. Aim barrel at player (unless locked during FIRING)
    if (!(this._state === STATE.ATTACK && this._phase === PHASE.FIRING)) {
      this.barrelOffset = Math.atan2(dy, dx) - this.bodyAngle;
    }

    // 5. Separation
    for (const other of allEnemies) {
      if (other === this || !other.alive) continue;
      const sdx  = this.x - other.x;
      const sdy  = this.y - other.y;
      const sdst = Math.hypot(sdx, sdy);
      if (sdst > 0 && sdst < SEPARATION_RADIUS) {
        const push = (1 - sdst / SEPARATION_RADIUS) * SEPARATION_FORCE * dt;
        this.x += (sdx / sdst) * push;
        this.y += (sdy / sdst) * push;
      }
    }

    // 6. Apply impulse then decay
    this.x += this._impulseVx * dt;
    this.y += this._impulseVy * dt;
    this._decayImpulse(dt);

    // 7. Tracks
    const moved = Math.hypot(this.x - this._prevX, this.y - this._prevY);
    this._trackAccum += moved;
    if (this._trackAccum >= TRACK_STAMP_DIST) {
      this._tracks.push({ x: this.x, y: this.y, angle: this.bodyAngle, life: 1 });
      if (this._tracks.length > TRACK_MAX) this._tracks.shift();
      this._trackAccum = 0;
    }
    this._prevX = this.x;
    this._prevY = this.y;
    const fadeRate = 1 / TRACK_FADE_TIME;
    for (const t of this._tracks) t.life -= fadeRate * dt;
    this._tracks = this._tracks.filter(t => t.life > 0);

    // 8. Recoil & shells
    this._recoil = Math.max(0, this._recoil - RECOIL_RETURN * dt);
    for (const shell of this.shells) shell.update(dt, 99999, 99999);
    this.shells = this.shells.filter(s => !s.dead);

    // 9. Sparks
    for (const s of this._sparks) {
      s.x  += s.vx * dt;
      s.y  += s.vy * dt;
      s.vy += 320 * dt;  // gravity
      s.life -= dt;
    }
    this._sparks = this._sparks.filter(s => s.life > 0);
  }

  // ─── State helpers ────────────────────────────────────────────────────────

  _queueState(newState, delay) {
    const jitter = delay * (0.7 + Math.random() * 0.6);
    this._pendingState  = newState;
    this._reactionTimer = jitter;
  }

  _onEnterState(state, dist, cfg) {
    if (state === STATE.ATTACK) {
      this._phase    = PHASE.AIMING;
      this._aimTimer = cfg.attack.aimTime;
    }
    if (state === STATE.REPOSITION) {
      const [min, max] = cfg.behavior.commitDuration;
      this._repositionTimer = min + Math.random() * (max - min);
      this._orbitDir *= -1;
    }
  }

  // ─── Movement ─────────────────────────────────────────────────────────────

  _applyMovement(dx, dy, dist, dt, speedScale) {
    const speed        = this.config.movement.speed * this._speedMult * speedScale;
    const desiredAngle = this._desiredAngle(dx, dy, dist);
    this._turnBodyTo(desiredAngle, dt);
    this.x += Math.cos(this.bodyAngle) * speed * dt;
    this.y += Math.sin(this.bodyAngle) * speed * dt;
  }

  _desiredAngle(dx, dy, dist) {
    const ideal    = this.config.movement.idealRange;
    const toPlayer = Math.atan2(dy, dx);

    switch (this.config.movement.type) {
      case 'chase':
        return toPlayer;

      case 'kite':
        if (dist > ideal + 25) return toPlayer;
        if (dist < ideal - 25) return toPlayer + Math.PI;
        return toPlayer + (Math.PI / 2) * this._orbitDir;

      case 'orbit': {
        const perpAngle   = toPlayer + (Math.PI / 2) * this._orbitDir;
        const radialBlend = Math.min(Math.abs(dist - ideal) / (ideal * 0.8), 0.65);
        const radialAngle = dist > ideal ? toPlayer : toPlayer + Math.PI;
        const vx = Math.cos(perpAngle) + Math.cos(radialAngle) * radialBlend;
        const vy = Math.sin(perpAngle) + Math.sin(radialAngle) * radialBlend;
        return Math.atan2(vy, vx);
      }
    }
  }

  _turnBodyTo(targetAngle, dt) {
    let diff = targetAngle - this.bodyAngle;
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.bodyAngle += Math.sign(diff) * Math.min(BODY_TURN_SPEED * dt, Math.abs(diff));
  }

  // ─── Patrol ───────────────────────────────────────────────────────────────

  _buildSquareWaypoints(cx, cy, size) {
    const h = size / 2;
    return [
      { x: cx + h, y: cy - h },
      { x: cx + h, y: cy + h },
      { x: cx - h, y: cy + h },
      { x: cx - h, y: cy - h },
    ];
  }

  _updatePatrol(dt) {
    const wp   = this._waypoints[this._waypointIndex];
    const dx   = wp.x - this.x;
    const dy   = wp.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 12) {
      this._waypointIndex = (this._waypointIndex + 1) % this._waypoints.length;
      return;
    }

    // Drive directly toward waypoint along tank body axis (no strafing)
    this._turnBodyTo(Math.atan2(dy, dx), dt);
    const speed = this.config.movement.speed * this._speedMult;
    this.x += Math.cos(this.bodyAngle) * speed * dt;
    this.y += Math.sin(this.bodyAngle) * speed * dt;
  }

  // ─── Attack ───────────────────────────────────────────────────────────────

  _updateAttack(dx, dy, dist, dt, player) {
    const cfg = this.config;

    // Flame attack — continuous damage, no phase cycling
    if (cfg.attack.type === 'flame') {
      this._applyMovement(dx, dy, dist, dt, 1.0);
      return;
    }

    if (cfg.attack.type === 'spray') {
      if (this._phase === PHASE.AIMING) {
        this._applyMovement(dx, dy, dist, dt, 0.2);
        this._aimTimer -= dt;
        if (this._aimTimer <= 0) {
          this._fireSpray();
          this._cooldownTimer = cfg.attack.cooldown;
          this._phase         = PHASE.COOLDOWN;
        }
      } else if (this._phase === PHASE.COOLDOWN) {
        this._applyMovement(dx, dy, dist, dt, 0.6);
        this._cooldownTimer -= dt;
        if (this._cooldownTimer <= 0) {
          this._phase    = PHASE.AIMING;
          this._aimTimer = cfg.attack.aimTime;
          playSound('reload');
        }
      }
      return;
    }

    switch (this._phase) {
      case PHASE.AIMING: {
        if (cfg.movement.type !== 'chase') {
          this._applyMovement(dx, dy, dist, dt, 0.35);
        }
        this._aimTimer -= dt;
        if (this._aimTimer <= 0) {
          const spread = (1 - cfg.attack.accuracy) * (Math.PI / 5);
          this._lockedAim      = Math.atan2(dy, dx) + (Math.random() - 0.5) * 2 * spread;
          this._phase          = PHASE.FIRING;
          this._burstRemaining = cfg.attack.burstCount ?? 1;
          this._burstTimer     = 0;
        }
        break;
      }

      case PHASE.FIRING: {
        this.barrelOffset = this._lockedAim - this.bodyAngle;
        if (this._burstTimer <= 0 && this._burstRemaining > 0) {
          this._fire(this._lockedAim);
          this._burstRemaining--;
          this._burstTimer = cfg.attack.burstDelay ?? 0;
        }
        this._burstTimer -= dt;
        if (this._burstRemaining <= 0 && this._burstTimer <= 0) {
          this._cooldownTimer = cfg.attack.cooldown;
          this._phase         = PHASE.COOLDOWN;
          if (cfg.role === 'flanker') this._queueState(STATE.REPOSITION, 0);
        }
        break;
      }

      case PHASE.COOLDOWN: {
        this._applyMovement(dx, dy, dist, dt, 0.6);
        this._cooldownTimer -= dt;
        if (this._cooldownTimer <= 0) {
          this._phase    = PHASE.AIMING;
          this._aimTimer = cfg.attack.aimTime;
          playSound('reload');
        }
        break;
      }
    }
  }

  _fire(angle) {
    const mountX  = this.x - BARREL_MOUNT_Y * Math.cos(this.bodyAngle);
    const mountY  = this.y - BARREL_MOUNT_Y * Math.sin(this.bodyAngle);
    const tipDist = BARREL_H * BARREL_PIVOT_FRAC;
    const sx = mountX + Math.cos(angle) * tipDist;
    const sy = mountY + Math.sin(angle) * tipDist;
    const ip    = this.config.attack.impactProfile ?? IMPACT.standard;
    const speed = this.config.attack.shellSpeed    ?? SHELL_SPEED;
    this.shells.push(new Shell(sx, sy, angle, speed, LAYER.ENEMY_SHELL, ip));
    this._recoil = RECOIL_AMOUNT;
    playSound('shoot');
  }

  _fireSpray() {
    const speed = this.config.attack.shellSpeed ?? SHELL_SPEED;
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const sx = this.x + Math.cos(angle) * 22;
      const sy = this.y + Math.sin(angle) * 22;
      this.shells.push(new Shell(sx, sy, angle, speed, LAYER.ENEMY_SHELL, IMPACT.spray));
    }
    playSound('shoot');
  }

  _spawnSparks() {
    const palette = [
      COLORS.effects.explosionCore,
      COLORS.effects.explosionMid,
      COLORS.effects.explosionOuter,
      '#FFFFFF',
    ];
    for (let i = 0; i < 4; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = 90 + Math.random() * 200;
      const life  = 0.15 + Math.random() * 0.25;
      this._sparks.push({
        x:       this._flameContactX + (Math.random() - 0.5) * 14,
        y:       this._flameContactY + (Math.random() - 0.5) * 14,
        vx:      Math.cos(angle) * spd,
        vy:      Math.sin(angle) * spd - 60,
        life,
        maxLife: life,
        color:   palette[Math.floor(Math.random() * palette.length)],
        r:       1.2 + Math.random() * 1.8,
      });
    }
  }

  // ─── Death update ─────────────────────────────────────────────────────────

  _updateDeath(dt) {
    // Skid from killing-shot impulse — no locomotion, just momentum decay
    this.x += this._impulseVx * dt;
    this.y += this._impulseVy * dt;
    this._decayImpulse(dt);

    // Keep existing track stamps fading
    const fadeRate = 1 / TRACK_FADE_TIME;
    for (const t of this._tracks) t.life -= fadeRate * dt;
    this._tracks = this._tracks.filter(t => t.life > 0);

    this._deathTimer += dt;
    if (this._deathTimer >= 3.2) this._done = true;
  }

  // Linear deceleration — same model as tank for consistency
  _decayImpulse(dt) {
    const speed = Math.hypot(this._impulseVx, this._impulseVy);
    if (speed < 1) { this._impulseVx = 0; this._impulseVy = 0; return; }
    const decel    = this._physProfile.friction * dt;
    const newSpeed = Math.max(0, speed - decel);
    const scale    = newSpeed / speed;
    this._impulseVx *= scale;
    this._impulseVy *= scale;
  }

  // ─── Draw ─────────────────────────────────────────────────────────────────

  drawTracks(ctx) {
    if (this._done) return;
    for (const t of this._tracks) {
      ctx.save();
      ctx.globalAlpha = t.life * 0.55;
      ctx.translate(t.x, t.y);
      ctx.rotate(t.angle + Math.PI / 2);
      ctx.fillStyle = COLORS.brown[400];
      ctx.fillRect(-TRACK_SIDE - TRACK_W / 2, -TRACK_H_PX / 2, TRACK_W, TRACK_H_PX);
      ctx.fillRect( TRACK_SIDE - TRACK_W / 2, -TRACK_H_PX / 2, TRACK_W, TRACK_H_PX);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  draw(ctx, assets) {
    if (this._done) return;
    if (this._dying) { this._drawDeath(ctx, assets); return; }

    for (const shell of this.shells) shell.draw(ctx);

    const sprites = assets.enemies[this.config.role];

    ctx.save();
    ctx.translate(this.x, this.y);

    // Body
    ctx.save();
    ctx.rotate(this.bodyAngle + Math.PI / 2);
    ctx.drawImage(sprites.body, -16, -20, 32, 40);
    ctx.restore();

    // Barrel
    ctx.save();
    if (this.config.role === 'sprayer') {
      // Octa barrel: symmetric, just rotates with body
      ctx.rotate(this.bodyAngle + Math.PI / 2);
      ctx.drawImage(sprites.barrel, -20, -20, 40, 40);
    } else {
      ctx.rotate(this.bodyAngle + Math.PI / 2);
      ctx.translate(0, BARREL_MOUNT_Y);
      ctx.rotate(this.barrelOffset);
      ctx.translate(0, this._recoil);
      ctx.drawImage(sprites.barrel, -9, -BARREL_H * BARREL_PIVOT_FRAC, 18, BARREL_H);
    }
    ctx.restore();

    // HP bar (always visible so player can read damage dealt)
    this._drawHpBar(ctx);

    ctx.restore();

    if (this._flaming) this._drawFlame(ctx);
    if (this._sparks.length) this._drawSparks(ctx);
  }

  _drawFlame(ctx) {
    const barrelAngle = this.bodyAngle + this.barrelOffset;
    const tipDist = BARREL_H * BARREL_PIVOT_FRAC;
    const tipX = this.x + Math.cos(barrelAngle) * tipDist;
    const tipY = this.y + Math.sin(barrelAngle) * tipDist;
    const maxRange = this.config.attack.range * 1.1;
    const perp = barrelAngle + Math.PI / 2;
    const t    = this._time;

    // Project player onto beam axis — beam stops at their tank edge, not center
    const toPx   = this._playerX - tipX;
    const toPy   = this._playerY - tipY;
    const proj   = toPx * Math.cos(barrelAngle) + toPy * Math.sin(barrelAngle);
    const TANK_R = 15; // approx player half-width
    const beamLen = Math.min(maxRange, Math.max(8, proj - TANK_R));

    const buildPath = (waveAmp) => {
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      for (let i = 1; i <= 16; i++) {
        const f    = i / 16;
        const bx   = tipX + Math.cos(barrelAngle) * beamLen * f;
        const by   = tipY + Math.sin(barrelAngle) * beamLen * f;
        const wave = Math.sin(t * 20 + f * Math.PI * 5) * waveAmp * f;
        ctx.lineTo(bx + Math.cos(perp) * wave, by + Math.sin(perp) * wave);
      }
    };

    const pulse = 3.5 + Math.sin(t * 24) * 1.5 + Math.sin(t * 15) * 0.8;

    ctx.save();
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';

    buildPath(5);
    ctx.strokeStyle = 'rgba(255, 60, 0, 0.22)';
    ctx.lineWidth   = pulse * 4.5;
    ctx.stroke();

    buildPath(4);
    ctx.strokeStyle = 'rgba(255, 140, 20, 0.50)';
    ctx.lineWidth   = pulse * 2;
    ctx.stroke();

    buildPath(2.5);
    ctx.strokeStyle = 'rgba(255, 245, 130, 0.92)';
    ctx.lineWidth   = pulse * 0.55;
    ctx.stroke();

    ctx.restore();
  }

  _drawSparks(ctx) {
    for (const s of this._sparks) {
      const alpha = s.life / s.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  _drawDeath(ctx, assets) {
    const t       = this._deathTimer;
    const sprites = assets.enemies[this.config.role];

    // Charred wreck — frozen at death angle, no barrel
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.bodyAngle + Math.PI / 2);
    ctx.drawImage(sprites.charred, -16, -20, 32, 40);
    ctx.restore();

    // ── Phase 1: Explosion flash (0 → 0.22s) ──────────────────────────────
    if (t < 0.22) {
      const p = t / 0.22;
      ctx.save();
      // Inner bright core
      ctx.globalAlpha = (1 - p) * 0.9;
      ctx.fillStyle   = COLORS.effects.explosionCore;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 12 + p * 38, 0, Math.PI * 2);
      ctx.fill();
      // Outer ring
      ctx.globalAlpha = (1 - p) * 0.5;
      ctx.fillStyle   = COLORS.effects.explosionOuter;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 22 + p * 55, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Phase 2: Flames (0.18 → 1.6s) ────────────────────────────────────
    if (t >= 0.18 && t < 1.6) {
      const p     = (t - 0.18) / 1.42;
      const alpha = (1 - p * 0.75);
      ctx.save();
      ctx.translate(this.x, this.y);
      for (let i = 0; i < 5; i++) {
        const flicker = Math.sin(t * 13 + i * 2.4);
        const ox = Math.sin(t * 7 + i * 1.9) * 7;
        const oy = -6 - Math.abs(Math.sin(t * 10 + i * 1.3)) * 11;
        const r  = 3 + Math.abs(Math.sin(t * 11 + i * 3.1)) * 6;
        ctx.globalAlpha = alpha * (0.55 + Math.abs(flicker) * 0.45);
        ctx.fillStyle   = i % 2 === 0 ? COLORS.effects.explosionCore : COLORS.effects.explosionMid;
        ctx.beginPath();
        ctx.arc(ox, oy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // ── Phase 3: Smoke (1.1 → 3.2s) ──────────────────────────────────────
    if (t >= 1.1) {
      const fadeIn  = Math.min((t - 1.1) / 0.35, 1);
      const fadeOut = Math.max(0, 1 - (t - 2.4) / 0.8);
      const alpha   = fadeIn * fadeOut * 0.5;
      if (alpha > 0.01) {
        ctx.save();
        ctx.translate(this.x, this.y);
        for (let i = 0; i < 5; i++) {
          const cycle = ((t * 0.75 + i * 0.21) % 1);
          const ox    = Math.sin(i * 2.3 + t * 1.2) * 8;
          const oy    = -(cycle * 32) - 5;
          ctx.globalAlpha = alpha * (1 - cycle);
          ctx.fillStyle   = COLORS.effects.smoke;
          ctx.beginPath();
          ctx.arc(ox, oy, 5 + cycle * 11, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }
  }

  _drawHpBar(ctx) {
    const frac = this.hp / this.maxHp;
    const x    = -HP_BAR_W / 2;
    const y    = HP_BAR_Y;

    // Background
    ctx.fillStyle = COLORS.ui.health.background;
    ctx.fillRect(x, y, HP_BAR_W, HP_BAR_H);

    // Fill color shifts from green → yellow → red
    const color = frac > 0.5 ? COLORS.ui.health.full
                : frac > 0.25 ? COLORS.ui.health.mid
                : COLORS.ui.health.low;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, HP_BAR_W * frac, HP_BAR_H);
  }
}
