/**
 * Returns a tinted copy of an image as an offscreen canvas.
 * The original shading/detail is preserved via grayscale + multiply.
 *
 * Usage:
 *   const redBody = tintSprite(assets.tankBody, '#c0392b');
 *   ctx.drawImage(redBody, x, y);
 */
export function tintSprite(img, color) {
  const c = document.createElement('canvas');
  c.width  = img.width  || img.naturalWidth;
  c.height = img.height || img.naturalHeight;
  const ctx = c.getContext('2d');

  // 1. Draw greyscale so the tint colour comes through cleanly
  ctx.filter = 'grayscale(1)';
  ctx.drawImage(img, 0, 0);
  ctx.filter = 'none';

  // 2. Multiply the tint colour — darkens/colours without blowing out highlights
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);

  // 3. Restore original alpha (keeps transparency intact)
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(img, 0, 0);

  return c;
}
