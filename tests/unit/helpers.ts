import type { InputSnapshot } from '../../src/game/types';

export function input(
  buttons: Partial<InputSnapshot['buttons']> = {},
  joystick: InputSnapshot['joystick'] = { x: 0, y: 0 },
  aim: InputSnapshot['aim'] = { x: 0, y: 0 },
): InputSnapshot {
  return {
    joystick,
    aim,
    buttons: {
      a: false,
      b: false,
      x: false,
      y: false,
      l: false,
      r: false,
      start: false,
      select: false,
      ...buttons,
    },
  };
}

export function seededRandom(seed = 0x12345678): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}
