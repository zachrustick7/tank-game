import { COLORS } from '../colors.js';
import { ENEMY_PHYS, IMPACT } from '../config.js';

export const ENEMY_CONFIGS = {

  // Same speed, fire rate, and HP as the player — a fair fight
  infantry: {
    role:  'infantry',
    color: COLORS.neutral.mid,
    hp:    100,
    movement: {
      type:       'kite',
      speed:      50,
      idealRange: 220,
    },
    attack: {
      type:       'single',
      cooldown:   0.6,
      aimTime:    0.3,
      accuracy:   0.85,
      shellSpeed: 150,
    },
    behavior: {
      aggression:       0.7,
      retreatThreshold: 0,
      reactionDelay:    0.3,
      commitDuration:   [0.8, 1.5],
      sightRange:       600,
      attackRange:      250,
    },
    physicalProfile: ENEMY_PHYS.infantry,
  },

  // Faster than the player, closes distance and burns — must be prioritized
  torcher: {
    role:  'torcher',
    color: COLORS.tank.red,
    hp:    90,
    movement: {
      type:       'chase',
      speed:      68,
      idealRange: 80,
    },
    attack: {
      type:    'flame',
      range:   140,
      damage:  18,   // HP/sec while player is in range
      aimTime: 0,
    },
    behavior: {
      aggression:       1.0,
      retreatThreshold: 0,
      reactionDelay:    0.15,
      commitDuration:   [1.0, 2.0],
      sightRange:       600,
      attackRange:      140,
    },
    physicalProfile: ENEMY_PHYS.torcher,
  },

  // Strafes horizontally across the field, fires twin barrels at the player
  crab: {
    role:  'crab',
    color: COLORS.extended.yellowSoft,
    hp:    90,
    movement: {
      type:       'crab',
      speed:      70,
      idealRange: 320,
    },
    attack: {
      type:       'twin',
      cooldown:   1.8,
      aimTime:    0.4,
      accuracy:   0.82,
      shellSpeed: 240,
    },
    behavior: {
      aggression:       0.6,
      retreatThreshold: 0,
      reactionDelay:    0.3,
      commitDuration:   [1.0, 2.0],
      sightRange:       600,
      attackRange:      380,
    },
    physicalProfile: ENEMY_PHYS.crab,
  },

  // Slow, tanky, fires 8 shells simultaneously in all cardinal/diagonal directions
  sprayer: {
    role:  'sprayer',
    color: COLORS.tank.orange,
    hp:    80,
    movement: {
      type:       'kite',
      speed:      45,
      idealRange: 260,
    },
    attack: {
      type:       'spray',
      cooldown:   3.5,
      aimTime:    0.7,
      shellSpeed: 140,
    },
    behavior: {
      aggression:       0.6,
      retreatThreshold: 0,
      reactionDelay:    0.4,
      commitDuration:   [1.0, 2.0],
      sightRange:       550,
      attackRange:      350,
    },
    physicalProfile: ENEMY_PHYS.sprayer,
  },

  // Hangs at max range, paints a red impact zone on the player, lobs a shell through the air
  mortar: {
    role:  'mortar',
    color: COLORS.brown[200],
    hp:    95,
    movement: {
      type:       'kite',
      speed:      34,
      idealRange: 420,
    },
    attack: {
      type:        'mortar',
      aimTime:     1.8,   // how long the tracking marker follows the player before firing
      flightTime:  2.4,   // seconds the shell is in the air
      cooldown:    4.0,
      blastRadius: 80,
      damage:      55,    // max damage at center of blast
      impactForce: 220,
    },
    behavior: {
      aggression:       0.45,
      retreatThreshold: 0,
      reactionDelay:    0.6,
      commitDuration:   [2.0, 3.5],
      sightRange:       700,
      attackRange:      540,
    },
    physicalProfile: ENEMY_PHYS.mortar,
  },

  // Hangs back, fires a slow glowing shell that splits into 8 shrapnel after 1 second
  splitter: {
    role:  'splitter',
    color: COLORS.accent.teal,
    hp:    110,
    movement: {
      type:       'kite',
      speed:      38,
      idealRange: 340,
    },
    attack: {
      type:          'splitter',
      aimTime:       0.9,
      cooldown:      2.0,
      shellSpeed:    85,
      shrapnelSpeed: 85,
      accuracy:      0.88,
      impactProfile: IMPACT.splitter,
    },
    behavior: {
      aggression:       0.55,
      retreatThreshold: 0,
      reactionDelay:    0.4,
      commitDuration:   [1.5, 2.5],
      sightRange:       650,
      attackRange:      460,
    },
    physicalProfile: ENEMY_PHYS.splitter,
  },

  // Stops at long range, paints the player with a tracking laser, fires one devastating round
  sniper: {
    role:  'sniper',
    color: COLORS.tank.purple,
    hp:    80,
    movement: {
      type:       'kite',
      speed:      42,
      idealRange: 380,
    },
    attack: {
      type:          'sniper',
      aimTime:       3.0,   // seconds laser tracks player
      lockTime:      1.0,   // seconds laser is frozen before firing
      cooldown:      5.0,   // seconds between shots
      accuracy:      0.97,
      shellSpeed:    560,
      range:         700,   // laser visual length
      impactProfile: IMPACT.sniper,
    },
    behavior: {
      aggression:       0.5,
      retreatThreshold: 0,
      reactionDelay:    0.5,
      commitDuration:   [2.0, 3.0],
      sightRange:       700,
      attackRange:      500,
    },
    physicalProfile: ENEMY_PHYS.sniper,
  },

  // Orbits and fires 3-round bursts — small shells, hard to dodge in pairs
  flanker: {
    role:  'flanker',
    color: COLORS.tank.blue,
    hp:    70,
    movement: {
      type:       'orbit',
      speed:      100,
      idealRange: 200,
    },
    attack: {
      type:          'burst',
      burstCount:    3,
      burstDelay:    0.12,
      cooldown:      2.2,
      aimTime:       0.3,
      accuracy:      0.80,
      shellSpeed:    220,
      impactProfile: IMPACT.burst,
    },
    behavior: {
      aggression:       0.7,
      retreatThreshold: 0,
      reactionDelay:    0.15,
      commitDuration:   [0.6, 1.2],
      sightRange:       550,
      attackRange:      250,
    },
    physicalProfile: ENEMY_PHYS.flanker,
  },
};
