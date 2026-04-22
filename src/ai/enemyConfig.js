import { COLORS } from '../colors.js';

// ─────────────────────────────────────────────────────────────────────────────
//  ENEMY CONFIGS  — add / tune roles here, no code changes needed elsewhere
//
//  movement.type : 'chase' | 'kite' | 'orbit'
//  attack.type   : 'single' | 'burst'
// ─────────────────────────────────────────────────────────────────────────────

export const ENEMY_CONFIGS = {

  // Rushes straight at the player and fires often — easy to read, hard to dodge
  chaser: {
    role:  'chaser',
    color: COLORS.tank.red,
    hp:    80,
    movement: {
      type:       'kite',
      speed:      110,
      idealRange: 140,  // stops here instead of driving into you
    },
    attack: {
      type:     'single',
      cooldown: 1.2,
      aimTime:  0.35,
      accuracy: 0.88,   // 1 = perfect, 0 = wild spread
    },
    behavior: {
      aggression:        0.9,
      retreatThreshold:  0.2,   // fraction of maxHp at which it retreats
      reactionDelay:     0.25,  // seconds before reacting to state changes
      commitDuration:    [0.5, 1.0],
      sightRange:        600,
      attackRange:       200,
    },
  },

  // Keeps its distance and fires slow, precise shots after a long aim
  sniper: {
    role:  'sniper',
    color: COLORS.tank.blue,
    hp:    60,
    movement: {
      type:       'kite',
      speed:      65,
      idealRange: 380,
    },
    attack: {
      type:     'single',
      cooldown: 3.5,
      aimTime:  0.9,
      accuracy: 0.97,
    },
    behavior: {
      aggression:       0.35,
      retreatThreshold: 0.3,
      reactionDelay:    0.5,
      commitDuration:   [1.0, 2.0],
      sightRange:       700,
      attackRange:      500,
    },
  },

  // Orbits the player and fires short bursts, then repositions
  flanker: {
    role:  'flanker',
    color: COLORS.tank.purple,
    hp:    70,
    movement: {
      type:       'orbit',
      speed:      140,
      idealRange: 220,
    },
    attack: {
      type:       'burst',
      burstCount: 3,
      burstDelay: 0.14,   // seconds between shots in a burst
      cooldown:   2.5,
      aimTime:    0.4,
      accuracy:   0.82,
    },
    behavior: {
      aggression:       0.65,
      retreatThreshold: 0.25,
      reactionDelay:    0.2,
      commitDuration:   [0.8, 1.5],
      sightRange:       550,
      attackRange:      270,
    },
  },

  // Slow, tanky, relentless forward pressure
  bruiser: {
    role:  'bruiser',
    color: COLORS.tank.dark,
    hp:    150,
    movement: {
      type:       'chase',
      speed:      55,
      idealRange: 90,
    },
    attack: {
      type:     'single',
      cooldown: 0.9,
      aimTime:  0.2,
      accuracy: 0.78,
    },
    behavior: {
      aggression:       1.0,
      retreatThreshold: 0.1,
      reactionDelay:    0.4,
      commitDuration:   [1.0, 2.0],
      sightRange:       500,
      attackRange:      180,
    },
  },

  // Fires from range, flees when hurt, re-engages when safe
  coward: {
    role:  'coward',
    color: COLORS.tank.yellow,
    hp:    50,
    movement: {
      type:       'kite',
      speed:      100,
      idealRange: 330,
    },
    attack: {
      type:     'single',
      cooldown: 2.8,
      aimTime:  0.6,
      accuracy: 0.70,
    },
    behavior: {
      aggression:       0.25,
      retreatThreshold: 0.5,
      reactionDelay:    0.55,
      commitDuration:   [0.5, 1.0],
      sightRange:       600,
      attackRange:      300,
    },
  },
};
