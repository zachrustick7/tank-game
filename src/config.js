// ============================================================
//  GAME CONFIG — tweak everything from here
// ============================================================

// --- World ---
export const WORLD_W = 1200;
export const WORLD_H = 800;

// --- Tank movement ---
export const MOVE_SPEED        = 50;  // px/sec, forward & backward
export const BODY_ROTATE_SPEED = 2.2;  // radians/sec (A / D keys)
export const BARREL_ROTATE_SPEED = 2.0; // radians/sec (← / → keys)

// --- Firing ---
export const FIRE_COOLDOWN = 0.4;   // seconds between shots
export const SHELL_SPEED   = 300;   // px/sec
export const SHELL_RADIUS  = 5;     // visual radius of the shell
export const SHELL_TRAIL   = 8;     // number of trail segments

// --- Recoil ---
export const RECOIL_AMOUNT = 8;   // px the barrel kicks back on fire
export const RECOIL_RETURN = 55;  // px/sec it springs back

// --- Barrel visual tuning ---
export const BARREL_MOUNT_Y    = 0;    // px along body forward axis (negative = toward front)
export const BARREL_PIVOT_FRAC = 0.75; // fraction of barrel height that extends past pivot

// --- Tracks ---
export const TRACK_STAMP_DIST = 10;   // px traveled between each track stamp
export const TRACK_FADE_TIME  = 4.0;  // seconds until a stamp fully fades
export const TRACK_MAX        = 300;  // max stamps kept (oldest dropped first)
