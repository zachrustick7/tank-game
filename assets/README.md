# Asset Slots

Drop your Figma exports here and wire them up in `src/game.js` → `assets` object.

| File | Used for | Size hint |
|------|----------|-----------|
| `tank-body.png` | Tank hull + tracks | ~52×60 px |
| `tank-barrel.png` | Barrel (pointing up) | ~10×36 px |
| `shell.png` | Projectile | ~10×10 px |
| `ground-tile.png` | Repeating ground | ~64×64 px |

To load an image, uncomment the `loadImage` helper in `src/game.js` and assign:
```js
assets.tankBody = await loadImage('assets/tank-body.png');
```
Then replace the placeholder drawing blocks in `src/tank.js` with `ctx.drawImage(...)`.
