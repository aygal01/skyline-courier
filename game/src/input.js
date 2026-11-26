// Skyline Courier — keyboard and mouse input. The stick is the mouse or the
// arrow keys; throttle lives on Shift / Ctrl, + / - and the mouse wheel.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    actions: [],          // queued one-shot actions: 'start', 'pause', 'mute', 'restart'
    mouseX: 0,
    mouseY: 0,
    mouseActive: false,
    clicked: false,
    clickX: 0,
    clickY: 0,
    throttle: 0,          // persistent 0..1, adjusted by keys and wheel
    brake: false,
  };

  const ACTION_KEYS = {
    Enter: 'start',
    Space: 'start',
    KeyP: 'pause',
    Escape: 'pause',
    KeyM: 'mute',
    KeyR: 'restart',
  };

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    input.keys.add(e.code);
    const action = ACTION_KEYS[e.code];
    if (action) input.actions.push(action);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => input.keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    input.mouseY = ((e.clientY - rect.top) / rect.height) * canvas.height;
    input.mouseActive = true;
  });
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.clickX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    input.clickY = ((e.clientY - rect.top) / rect.height) * canvas.height;
    input.clicked = true;
    input.actions.push('start');
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    input.throttle = clamp(input.throttle + (e.deltaY < 0 ? 0.06 : -0.06), 0, 1);
  }, { passive: false });

  input.has = (code) => input.keys.has(code);

  // Consume one queued action of the given name, if any.
  input.takeAction = function takeAction(name) {
    const i = input.actions.indexOf(name);
    if (i === -1) return false;
    input.actions.splice(i, 1);
    return true;
  };

  input.takeClick = function takeClick() {
    if (!input.clicked) return null;
    input.clicked = false;
    return { x: input.clickX, y: input.clickY };
  };

  // The flight controls for this frame: pitch/roll in [-1, 1], throttle 0..1.
  input.flight = function flight() {
    // Throttle keys adjust the persistent throttle.
    if (input.keys.has('ShiftLeft') || input.keys.has('ShiftRight') || input.keys.has('Equal')) {
      input.throttle = clamp(input.throttle + 0.35 * (1 / 60), 0, 1);
    }
    if (input.keys.has('ControlLeft') || input.keys.has('ControlRight') || input.keys.has('Minus')) {
      input.throttle = clamp(input.throttle - 0.35 * (1 / 60), 0, 1);
    }
    input.brake = input.keys.has('KeyB');

    let pitch = 0;
    let roll = 0;
    // Mouse steers like a stick: up is climb, left/right banks.
    if (input.mouseActive) {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      roll = clamp((input.mouseX - cx) / (canvas.width * 0.32), -1, 1);
      pitch = clamp((cy - input.mouseY) / (canvas.height * 0.3), -1, 1);
    }
    // Keys override the mouse on each axis.
    if (input.keys.has('ArrowUp') || input.keys.has('KeyW')) pitch = 1;
    if (input.keys.has('ArrowDown') || input.keys.has('KeyS')) pitch = -1;
    if (input.keys.has('ArrowLeft') || input.keys.has('KeyA')) roll = -1;
    if (input.keys.has('ArrowRight') || input.keys.has('KeyD')) roll = 1;
    return { pitch, roll, throttle: input.throttle, brake: input.brake };
  };

  return input;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
