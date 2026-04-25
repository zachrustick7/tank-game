// ============================================================
//  GAME CONFIG — tweak everything from here
// ============================================================

// --- World ---
export const WORLD_W = 1200;
export const WORLD_H = 800;

// --- Player ---
export const PLAYER_HP = 100;

// --- Tank movement ---
export const MOVE_SPEED        = 50;  // px/sec, forward & backward
export const BODY_ROTATE_SPEED = 2.2;  // radians/sec (A / D keys)
export const BARREL_ROTATE_SPEED = 2.0; // radians/sec (← / → keys)

// --- Firing ---
export const FIRE_COOLDOWN = 0.6;   // seconds between shots
export const SHELL_SPEED   = 300;   // px/sec
export const SHELL_RADIUS  = 5;     // visual radius of the shell
export const SHELL_TRAIL   = 8;     // number of trail segments

// --- Recoil ---
export const RECOIL_AMOUNT = 8;   // px the barrel kicks back on fire
export const RECOIL_RETURN = 55;  // px/sec it springs back

// --- Barrel visual tuning ---
export const BARREL_MOUNT_Y    = 0;    // px along body forward axis (negative = toward front)
export const BARREL_PIVOT_FRAC = 0.75; // fraction of barrel height that extends past pivot

// --- Audio ---
export const VOL_SHOOT  = 1.0;  // shell fire sound volume (0–1)
export const VOL_RELOAD = 0.07;  // reload ready sound volume (0–1)
export const VOL_INTRO  = 0.8;    // intro music volume (0–1)

// --- Tracks ---
export const TRACK_STAMP_DIST = 10;   // px traveled between each track stamp
export const TRACK_FADE_TIME  = 4.0;  // seconds until a stamp fully fades
export const TRACK_MAX        = 300;  // max stamps kept (oldest dropped first)

// --- Physical profiles ---
// mass                : divides incoming force (higher = harder to shove)
// knockbackResistance : 0–1 flat multiplier reduction applied after mass
// traction            : reserved for future directional grip tuning
// friction            : px/s² linear deceleration of impulse (higher = stops faster)
// maxImpactSpeed      : hard cap on total impulse velocity (px/s)

export const PLAYER_PHYS = {
  mass:                1.5,
  knockbackResistance: 0.10,
  traction:            0.50,
  friction:            320,
  maxImpactSpeed:      200,
};

export const ENEMY_PHYS = {
  infantry: { mass: 1.5, knockbackResistance: 0.10, traction: 0.50, friction: 320, maxImpactSpeed: 200 },
  torcher:  { mass: 1.2, knockbackResistance: 0.05, traction: 0.35, friction: 350, maxImpactSpeed: 200 },
  flanker:  { mass: 0.9, knockbackResistance: 0.00, traction: 0.20, friction: 400, maxImpactSpeed: 240 },
  sprayer:  { mass: 1.8, knockbackResistance: 0.20, traction: 0.45, friction: 300, maxImpactSpeed: 180 },
  crab:     { mass: 1.3, knockbackResistance: 0.10, traction: 0.40, friction: 360, maxImpactSpeed: 190 },
  sniper:   { mass: 2.0, knockbackResistance: 0.20, traction: 0.50, friction: 280, maxImpactSpeed: 150 },
  splitter: { mass: 2.2, knockbackResistance: 0.25, traction: 0.45, friction: 270, maxImpactSpeed: 140 },
  mortar:   { mass: 2.5, knockbackResistance: 0.30, traction: 0.40, friction: 250, maxImpactSpeed: 120 },
};

// --- Ammo / impact profiles ---
// damage      : HP removed on hit
// impactForce : px/s imparted at mass=1, resistance=0
// poiseDamage : future stagger system
// pierceCount : additional targets hit before shell dies (0 = dies on first impact)

export const IMPACT = {
  standard: { damage: 25, impactForce: 220, poiseDamage: 20, pierceCount: 0 },
  burst:    { damage: 12, impactForce: 120, poiseDamage: 8,  pierceCount: 0 },
  spray:    { damage: 12, impactForce: 100, poiseDamage: 5,  pierceCount: 0 },
  sniper:   { damage: 60, impactForce: 350, poiseDamage: 60, pierceCount: 0 },
  splitter: { damage: 30, impactForce: 160, poiseDamage: 25, pierceCount: 0 },
  shrapnel: { damage: 18, impactForce: 90,  poiseDamage: 12, pierceCount: 0 },
};
