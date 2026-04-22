import { Shell } from './shell.js';
import {
  MOVE_SPEED, BODY_ROTATE_SPEED, BARREL_ROTATE_SPEED,
  FIRE_COOLDOWN, BARREL_MOUNT_Y, BARREL_PIVOT_FRAC, SHELL_SPEED,
  TRACK_STAMP_DIST, TRACK_FADE_TIME, TRACK_MAX,
  RECOIL_AMOUNT, RECOIL_RETURN,
} from './config.js';
import { COLORS } from './colors.js';
import { playSound } from './audio.js';

// Side offset of each tread from tank center (px)
const TRACK_SIDE = 11;
const TRACK_W    = 3;
const TRACK_H    = 10;

export class Tank {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.bodyAngle   = -Math.PI / 2;
    this.barrelOffset = 0;
    this.fireCooldown = 0;
    this.shells = [];

    this.bodyW  = 32;
    this.bodyH  = 40;
    this.barrelW = 18;
    this.barrelH = 33;
    this.collisionRadius = 18;

    this._recoil     = 0;

    this._tracks     = [];
    this._trackAccum = 0;
    this._prevX = x;
    this._prevY = y;
  }

  update(dt, input) {
    if (input.held('KeyA')) this.bodyAngle -= BODY_ROTATE_SPEED * dt;
    if (input.held('KeyD')) this.bodyAngle += BODY_ROTATE_SPEED * dt;

    if (input.held('KeyW')) {
      this.x += Math.cos(this.bodyAngle) * MOVE_SPEED * dt;
      this.y += Math.sin(this.bodyAngle) * MOVE_SPEED * dt;
    }
    if (input.held('KeyS')) {
      this.x -= Math.cos(this.bodyAngle) * MOVE_SPEED * dt;
      this.y -= Math.sin(this.bodyAngle) * MOVE_SPEED * dt;
    }

    // --- track stamps ---
    const moved = Math.hypot(this.x - this._prevX, this.y - this._prevY);
    this._trackAccum += moved;
    if (this._trackAccum >= TRACK_STAMP_DIST) {
      this._tracks.push({ x: this.x, y: this.y, angle: this.bodyAngle, life: 1 });
      if (this._tracks.length > TRACK_MAX) this._tracks.shift();
      this._trackAccum = 0;
    }
    this._prevX = this.x;
    this._prevY = this.y;

    // fade tracks
    const fadeRate = 1 / TRACK_FADE_TIME;
    for (const t of this._tracks) t.life -= fadeRate * dt;
    this._tracks = this._tracks.filter(t => t.life > 0);

    this._recoil = Math.max(0, this._recoil - RECOIL_RETURN * dt);

    if (input.held('ArrowLeft'))  this.barrelOffset -= BARREL_ROTATE_SPEED * dt;
    if (input.held('ArrowRight')) this.barrelOffset += BARREL_ROTATE_SPEED * dt;

    const wasReloading = this.fireCooldown > 0;
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (wasReloading && this.fireCooldown === 0) playSound('reload');

    if ((input.held('ArrowUp') || input.held('Space')) && this.fireCooldown === 0) {
      this._fire();
      this.fireCooldown = FIRE_COOLDOWN;
    }

    for (const shell of this.shells) shell.update(dt, 99999, 99999);
    this.shells = this.shells.filter(s => !s.dead);
  }

  _fire() {
    const worldBarrelAngle = this.bodyAngle + this.barrelOffset;
    const mountX = this.x - BARREL_MOUNT_Y * Math.cos(this.bodyAngle);
    const mountY = this.y - BARREL_MOUNT_Y * Math.sin(this.bodyAngle);
    const tipDist = this.barrelH * BARREL_PIVOT_FRAC;
    const sx = mountX + Math.cos(worldBarrelAngle) * tipDist;
    const sy = mountY + Math.sin(worldBarrelAngle) * tipDist;
    this.shells.push(new Shell(sx, sy, worldBarrelAngle, SHELL_SPEED));
    this._recoil = RECOIL_AMOUNT;
    playSound('shoot');
  }

  drawTracks(ctx) {
    for (const t of this._tracks) {
      ctx.save();
      ctx.globalAlpha = t.life * 0.55;
      ctx.translate(t.x, t.y);
      ctx.rotate(t.angle + Math.PI / 2);
      ctx.fillStyle = COLORS.brown[400];
      // left tread
      ctx.fillRect(-TRACK_SIDE - TRACK_W / 2, -TRACK_H / 2, TRACK_W, TRACK_H);
      // right tread
      ctx.fillRect( TRACK_SIDE - TRACK_W / 2, -TRACK_H / 2, TRACK_W, TRACK_H);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  draw(ctx, assets) {
    for (const shell of this.shells) shell.draw(ctx);

    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.save();
    ctx.rotate(this.bodyAngle + Math.PI / 2);
    ctx.drawImage(assets.tankBody, -this.bodyW / 2, -this.bodyH / 2, this.bodyW, this.bodyH);
    ctx.restore();

    ctx.save();
    ctx.rotate(this.bodyAngle + Math.PI / 2);
    ctx.translate(0, BARREL_MOUNT_Y);
    ctx.rotate(this.barrelOffset);
    ctx.translate(0, this._recoil);
    ctx.drawImage(assets.tankBarrel, -this.barrelW / 2, -this.barrelH * BARREL_PIVOT_FRAC, this.barrelW, this.barrelH);
    ctx.restore();

    ctx.restore();
  }
}
