// Collision layers and projectile hit resolution.
//
// To add a new faction or damage relationship: add a LAYER entry and a row in
// DAMAGE_TABLE — no changes needed in entity or game-loop code.

export const LAYER = {
  PLAYER:       'player',
  ENEMY:        'enemy',
  PLAYER_SHELL: 'player_shell',
  ENEMY_SHELL:  'enemy_shell',
};

// attacker layer → layers it can damage
const DAMAGE_TABLE = {
  [LAYER.PLAYER_SHELL]: [LAYER.ENEMY],
  [LAYER.ENEMY_SHELL]:  [LAYER.PLAYER],
};

// Resolve all projectile→entity overlaps in one pass.
// Expects projectiles with { x, y, radius, angle, layer, impactProfile, piercesLeft, dead }
// Expects targets with    { x, y, collisionRadius, layer, alive, takeDamage(), applyImpulse() }
export function resolveProjectileHits(projectiles, targets) {
  for (const proj of projectiles) {
    if (proj.dead) continue;
    for (const target of targets) {
      if (!target.alive) continue;
      if (!(DAMAGE_TABLE[proj.layer] ?? []).includes(target.layer)) continue;
      const dist = Math.hypot(proj.x - target.x, proj.y - target.y);
      if (dist < proj.radius + target.collisionRadius) {
        _applyHit(proj, target);
      }
    }
  }
}

function _applyHit(proj, target) {
  const ip = proj.impactProfile;
  target.takeDamage(ip.damage);
  target.applyImpulse(proj.angle, ip.impactForce);
  if (proj.piercesLeft > 0) {
    proj.piercesLeft--;
  } else {
    proj.dead = true;
  }
}
