export class Input {
  constructor() {
    this.keys = new Set();

    window.addEventListener('keydown', e => {
      this.keys.add(e.code);
      // prevent arrow keys and space from scrolling the page
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', e => {
      this.keys.delete(e.code);
    });
  }

  held(code) {
    return this.keys.has(code);
  }

  // one-frame press detection
  pressed(code) {
    if (this.keys.has('_pressed_' + code)) return false;
    if (this.keys.has(code)) {
      this.keys.add('_pressed_' + code);
      return true;
    }
    return false;
  }

  clearPressed() {
    for (const key of this.keys) {
      if (key.startsWith('_pressed_') && !this.keys.has(key.slice(9))) {
        this.keys.delete(key);
      }
    }
  }
}
