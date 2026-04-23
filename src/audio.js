import { VOL_SHOOT, VOL_RELOAD } from './config.js';

// Sound effect player.
// Uses cloneNode() so the same sound can overlap itself (e.g. rapid fire).

const _sounds = {};

export function loadSounds() {
  _sounds.shoot  = new Audio('assets/shell_1.m4a');
  _sounds.reload = new Audio('assets/reload_1.m4a');
  _sounds.shoot.volume  = VOL_SHOOT;
  _sounds.reload.volume = VOL_RELOAD;
}

export function playSound(name) {
  const src = _sounds[name];
  if (!src) return;
  const clone = src.cloneNode();
  clone.volume = src.volume;
  clone.play().catch(() => {});
}
