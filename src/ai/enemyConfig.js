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
      retreatThreshold: 0.2,
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
      retreatThreshold: 0.08,
      reactionDelay:    0.15,
      commitDuration:   [1.0, 2.0],
      sightRange:       600,
      attackRange:      140,
    },
    physicalProfile: ENEMY_PHYS.torcher,
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
      retreatThreshold: 0.2,
      reactionDelay:    0.15,
      commitDuration:   [0.6, 1.2],
      sightRange:       550,
      attackRange:      250,
    },
    physicalProfile: ENEMY_PHYS.flanker,
  },
};
