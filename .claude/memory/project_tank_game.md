---
name: Tank Game project
description: Web-based canvas tank game being built incrementally with Zach
type: project
---

This is a vibe-coded HTML5 canvas tank game at ~/Desktop/games/tank-game.

**Current state (2026-04-22):** Basic player tank working — WASD body movement/rotation, arrow keys rotate barrel independently (world-space), Up/Space fires shells with trail effect. Placeholder drawn graphics throughout; Figma asset slots are marked in code comments and assets/README.md.

**Why:** Game design loop is being decided as we go. Zach will supply Figma art to replace placeholder graphics.

**How to apply:** Each session, check src/ for current state before suggesting changes. Asset swap points are in `src/tank.js` draw() method and `src/game.js` assets object. Dev server: `python3 -m http.server 3333` from project root.

**Stack:** Vanilla HTML5 Canvas + ES modules, no build step, no dependencies. Keep it that way unless user asks otherwise.

**File map:**
- src/game.js — main loop, world, HUD, asset loading
- src/tank.js — Tank class (movement, barrel, firing)
- src/shell.js — Shell class (projectile + trail)
- src/input.js — keyboard input (held + one-frame press)
- assets/ — Figma export drop zone
