// Keyboard + mouse input. Keys are held in a set; the game polls direction and
// one-shot actions (consumed by takeActions) once per frame.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 16;

const KEY_ACTIONS = {
  Space: ACTION_CONFIRM,
  Enter: ACTION_CONFIRM,
  Escape: ACTION_PAUSE,
  KeyP: ACTION_PAUSE,
  KeyE: ACTION_INTERACT,
  KeyF: ACTION_PUNCH,
};

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false };

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    const action = KEY_ACTIONS[event.code];
    if (action !== undefined) actions |= action;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }

  function onMouseDown(event) {
    onMouseMove(event);
    mouse.down = true;
    actions |= ACTION_SHOOT | ACTION_CONFIRM;
  }

  function onMouseUp() {
    mouse.down = false;
  }

  function onBlur() {
    keys.clear();
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  /** The walk/drive direction this frame, as a unit-ish {x, y} vector. */
  function direction() {
    let x = 0;
    let y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.SQRT2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  function isDown(code) {
    return keys.has(code);
  }

  return { direction, takeActions, isDown, mouse };
}
