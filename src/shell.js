import { SHELL_RADIUS, SHELL_TRAIL } from './config.js';
import { COLORS } from './colors.js';
import { LAYER } from './physics/collision.js';
import { IMPACT } from './config.js';

export class Shell {
  constructor(x, y, angle, speed,
              layer         = LAYER.PLAYER_SHELL,
              impactProfile = IMPACT.standard) {
    this.x     = x;
    this.y     = y;
    this.angle = angle;
    this.speed = speed;
    this.dead  = false;
    this.radius = SHELL_RADIUS;
    this.trail  = [];

    this.layer         = layer;
    this.impactProfile = impactProfile;
    this.piercesLeft   = impactProfile.pierceCount ?? 0;
  }

  update(dt, worldW, worldH) {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > SHELL_TRAIL) this.trail.shift();

    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;

    if (this.x < 0 || this.x > worldW || this.y < 0 || this.y > worldH) {
      this.dead = true;
    }
  }

  draw(ctx) {
    for (let i = 0; i < this.trail.length; i++) {
      const alpha = (i + 1) / this.trail.length * 0.4;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.effects.explosionMid;
      ctx.beginPath();
      ctx.arc(this.trail[i].x, this.trail[i].y, this.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = COLORS.effects.explosionOuter;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.effects.explosionCore;
    ctx.beginPath();
    ctx.arc(this.x - 1, this.y - 1, this.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Slow shell that splits into 8 shrapnel after 1 second
export class SplitterShell extends Shell {
  constructor(x, y, angle, speed, layer, impactProfile) {
    super(x, y, angle, speed, layer, impactProfile);
    this.splitTimer = 2.0;
    this.didSplit   = false;
    this.radius     = SHELL_RADIUS * 2.2;
  }

  update(dt, _worldW, _worldH) {
    if (this.dead) return;
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > SHELL_TRAIL) this.trail.shift();
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    this.splitTimer -= dt;
    if (this.splitTimer <= 0) {
      this.dead     = true;
      this.didSplit = true;
    }
  }

  draw(ctx) {
    const elapsed = Math.max(0, 2.0 - this.splitTimer);

    for (let i = 0; i < this.trail.length; i++) {
      const alpha = (i + 1) / this.trail.length * 0.5;
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = COLORS.effects.explosionMid;
      ctx.beginPath();
      ctx.arc(this.trail[i].x, this.trail[i].y, this.radius * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Warning glow — chirps faster as it nears the split
    const pulse = Math.sin(elapsed * (8 + elapsed * 22)) * 0.5 + 0.5;
    ctx.globalAlpha = 0.18 + pulse * 0.32;
    ctx.fillStyle   = '#FF4400';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * (1.9 + elapsed * 1.4), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = COLORS.effects.explosionOuter;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.effects.explosionCore;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Airborne shell — travels from src to target over flightTime, no collision during flight
export class MortarShell {
  constructor(sx, sy, tx, ty, flightTime, blastRadius, damage, impactForce) {
    this.x           = sx;
    this.y           = sy;
    this.startX      = sx;
    this.startY      = sy;
    this.targetX     = tx;
    this.targetY     = ty;
    this.flightTime  = flightTime;
    this.blastRadius = blastRadius;
    this.damage      = damage;
    this.impactForce = impactForce;
    this.elapsed     = 0;
    this.dead        = false;
    this.landed      = false;
  }

  update(dt) {
    if (this.dead) return;
    this.elapsed += dt;
    const t  = Math.min(this.elapsed / this.flightTime, 1);
    this.x   = this.startX + (this.targetX - this.startX) * t;
    this.y   = this.startY + (this.targetY - this.startY) * t;
    if (this.elapsed >= this.flightTime) {
      this.x      = this.targetX;
      this.y      = this.targetY;
      this.dead   = true;
      this.landed = true;
    }
  }

  draw(ctx) {
    const t     = Math.min(this.elapsed / this.flightTime, 1);
    const sizeT = 1 - Math.abs(t * 2 - 1); // 0 → 1 → 0, peaks at midpoint
    const r     = 4 + sizeT * 14;

    ctx.save();

    // Drop shadow — offset grows with simulated height
    ctx.globalAlpha = 0.18 + sizeT * 0.18;
    ctx.fillStyle   = '#1A1A1A';
    ctx.beginPath();
    ctx.arc(this.x + sizeT * 5, this.y + sizeT * 5, r * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Glow halo at peak altitude
    if (sizeT > 0.15) {
      ctx.globalAlpha = sizeT * 0.28;
      ctx.fillStyle   = '#FF8800';
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    // Shell body — dark cannonball, slightly warmer at peak
    const red   = Math.round(55 + sizeT * 75);
    const green = Math.round(42 + sizeT * 28);
    ctx.fillStyle = `rgb(${red},${green},42)`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Hot core
    ctx.globalAlpha = 0.55 + sizeT * 0.45;
    ctx.fillStyle   = COLORS.effects.explosionCore;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r * 0.34, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
