import { Shell } from './shell.js';
import {
  BARREL_PIVOT_FRAC, BARREL_MOUNT_Y,
  RECOIL_AMOUNT, RECOIL_RETURN,
  TRACK_STAMP_DIST, TRACK_FADE_TIME, TRACK_MAX,
  SHELL_SPEED,
} from './config.js';
import { COLORS } from './colors.js';
import { playSound } from './audio.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATE = { IDLE: 'idle', CHASE: 'chase', ATTACK: 'attack', REPOSITION: 'reposition', RETREAT: 'retreat' };
const PHASE = { AIMING: 'aiming', FIRING: 'firing', COOLDOWN: 'cooldown' };

const BODY_TURN_SPEED   = 2.6;   // rad/sec
const SEPARATION_RADIUS = 58;    // px — enemies push each other apart inside this
const SEPARATION_FORCE  = 190;   // px/sec push strength

const BARREL_H = 33;
const TRACK_SIDE = 11, TRACK_W = 3, TRACK_H_PX = 10;

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

    // ── State machine ──
    this._state = STATE.IDLE;
    this._phase = PHASE.COOLDOWN; // attack sub-phase

    // Queued state transition with reaction delay
    this._pendingState  = null;
    this._reactionTimer = 0;

    // ── Attack ──
    this._aimTimer       = 0;
    this._cooldownTimer  = 0;
    this._burstRemaining = 0;
    this._burstTimer     = 0;
    this._lockedAim      = 0; // world angle committed at end of AIMING

    this.collisionRadius = 18;

    // ── Movement ──
    this._orbitDir  = Math.random() < 0.5 ? 1 : -1;
    this._speedMult = 0.9 + Math.random() * 0.2; // ±10% speed variation

    // ── Flanker reposition ──
    this._repositionTimer = 0;

    // ── Recoil ──
    this._recoil = 0;

    // ── Tracks ──
    this._tracks     = [];
    this._trackAccum = 0;
    this._prevX = x;
    this._prevY = y;
  }

  // ─── Public Update ────────────────────────────────────────────────────────

  update(dt, player, allEnemies) {
    const dx   = player.x - this.x;
    const dy   = player.y - this.y;
    const dist = Math.hypot(dx, dy);
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

    // 2. Evaluate transitions (highest priority first)
    const lowHp   = this.hp / this.maxHp < beh.retreatThreshold;
    const inSight  = dist < beh.sightRange;
    const inRange  = dist < beh.attackRange;
    const safeNow  = dist > beh.attackRange * 1.6;

    if (this._pendingState === null) {
      if (lowHp && this._state !== STATE.RETREAT) {
        this._queueState(STATE.RETREAT, beh.reactionDelay);
      } else if (!lowHp && this._state === STATE.RETREAT && safeNow) {
        this._queueState(STATE.CHASE, beh.reactionDelay);
      } else if (this._state === STATE.IDLE && inSight) {
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
        this.bodyAngle += 0.4 * dt; // idle scan
        break;

      case STATE.CHASE:
        this._applyMovement(dx, dy, dist, dt, 1.0);
        break;

      case STATE.ATTACK:
        this._updateAttack(dx, dy, dist, dt);
        break;

      case STATE.REPOSITION:
        this._applyMovement(dx, dy, dist, dt, 1.0);
        break;

      case STATE.RETREAT: {
        const away = Math.atan2(-dy, -dx); // face away from player
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

    // 5. Separation — push away from nearby enemies
    for (const other of allEnemies) {
      if (other === this) continue;
      const sdx  = this.x - other.x;
      const sdy  = this.y - other.y;
      const sdst = Math.hypot(sdx, sdy);
      if (sdst > 0 && sdst < SEPARATION_RADIUS) {
        const push = (1 - sdst / SEPARATION_RADIUS) * SEPARATION_FORCE * dt;
        this.x += (sdx / sdst) * push;
        this.y += (sdy / sdst) * push;
      }
    }

    // 6. Tracks
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

    // 7. Recoil decay & shells
    this._recoil = Math.max(0, this._recoil - RECOIL_RETURN * dt);
    for (const shell of this.shells) shell.update(dt, 99999, 99999);
    this.shells = this.shells.filter(s => !s.dead);
  }

  // ─── State helpers ────────────────────────────────────────────────────────

  _queueState(newState, delay) {
    const jitter = delay * (0.7 + Math.random() * 0.6); // ±30% jitter on delay
    this._pendingState  = newState;
    this._reactionTimer = jitter;
  }

  _onEnterState(state, dist, cfg) {
    if (state === STATE.ATTACK) {
      this._phase   = PHASE.AIMING;
      this._aimTimer = cfg.attack.aimTime;
    }
    if (state === STATE.REPOSITION) {
      const [min, max] = cfg.behavior.commitDuration;
      this._repositionTimer = min + Math.random() * (max - min);
      this._orbitDir *= -1; // flip orbit direction on each reposition
    }
  }

  // ─── Movement ─────────────────────────────────────────────────────────────
  //
  // Tanks can only drive forward/backward along their body axis.
  // All movement works the same way:
  //   1. Decide which world direction we want to travel (_desiredAngle)
  //   2. Rotate the body toward that angle
  //   3. Drive forward along the current bodyAngle
  // This eliminates strafing/drifting — the enemy always moves where it's facing.

  _applyMovement(dx, dy, dist, dt, speedScale) {
    const speed        = this.config.movement.speed * this._speedMult * speedScale;
    const desiredAngle = this._desiredAngle(dx, dy, dist);

    this._turnBodyTo(desiredAngle, dt);

    // Drive forward along the body axis — no strafing ever
    this.x += Math.cos(this.bodyAngle) * speed * dt;
    this.y += Math.sin(this.bodyAngle) * speed * dt;
  }

  // Returns the world angle the enemy wants to face (and drive toward)
  _desiredAngle(dx, dy, dist) {
    const ideal    = this.config.movement.idealRange;
    const toPlayer = Math.atan2(dy, dx);

    switch (this.config.movement.type) {
      case 'chase':
        return toPlayer;

      case 'kite':
        if (dist > ideal + 25) return toPlayer;           // close in
        if (dist < ideal - 25) return toPlayer + Math.PI; // back off (turn away, drive forward)
        // at ideal range: face perpendicular and drive along that
        return toPlayer + (Math.PI / 2) * this._orbitDir;

      case 'orbit': {
        // Perpendicular direction around the player
        const perpAngle = toPlayer + (Math.PI / 2) * this._orbitDir;

        // Blend in a radial pull to maintain ideal range
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

  // ─── Attack ───────────────────────────────────────────────────────────────

  _updateAttack(dx, dy, dist, dt) {
    const cfg = this.config;

    switch (this._phase) {

      case PHASE.AIMING: {
        // Keep some movement during aim (kite/orbit types slow-drift)
        if (cfg.movement.type !== 'chase') {
          this._applyMovement(dx, dy, dist, dt, 0.35);
        }
        this._aimTimer -= dt;
        if (this._aimTimer <= 0) {
          // Lock in aim angle with accuracy-based spread
          const spread = (1 - cfg.attack.accuracy) * (Math.PI / 5);
          this._lockedAim  = Math.atan2(dy, dx) + (Math.random() - 0.5) * 2 * spread;
          this._phase          = PHASE.FIRING;
          this._burstRemaining = cfg.attack.burstCount ?? 1;
          this._burstTimer     = 0;
        }
        break;
      }

      case PHASE.FIRING: {
        // Lock barrel to committed angle
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

          // Flankers reposition after each burst instead of staying in ATTACK
          if (cfg.role === 'flanker') {
            this._queueState(STATE.REPOSITION, 0);
          }
        }
        break;
      }

      case PHASE.COOLDOWN: {
        // Keep moving during cooldown
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
    const mountX = this.x - BARREL_MOUNT_Y * Math.cos(this.bodyAngle);
    const mountY = this.y - BARREL_MOUNT_Y * Math.sin(this.bodyAngle);
    const tipDist = BARREL_H * BARREL_PIVOT_FRAC;
    const sx = mountX + Math.cos(angle) * tipDist;
    const sy = mountY + Math.sin(angle) * tipDist;
    this.shells.push(new Shell(sx, sy, angle, SHELL_SPEED));
    this._recoil = RECOIL_AMOUNT;
    playSound('shoot');
  }

  // ─── Draw ─────────────────────────────────────────────────────────────────

  drawTracks(ctx) {
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
    for (const shell of this.shells) shell.draw(ctx);

    const sprites = assets.enemies[this.config.role];

    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.save();
    ctx.rotate(this.bodyAngle + Math.PI / 2);
    ctx.drawImage(sprites.body, -16, -20, 32, 40);
    ctx.restore();

    ctx.save();
    ctx.rotate(this.bodyAngle + Math.PI / 2);
    ctx.translate(0, BARREL_MOUNT_Y);
    ctx.rotate(this.barrelOffset);
    ctx.translate(0, this._recoil);
    ctx.drawImage(sprites.barrel, -9, -BARREL_H * BARREL_PIVOT_FRAC, 18, BARREL_H);
    ctx.restore();

    ctx.restore();
  }
}
