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
