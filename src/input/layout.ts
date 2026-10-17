import type { ButtonName, Vec2 } from '../game/types';

export type TouchBinding = ButtonName | 'joystick';

export interface TouchLayoutRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function classifyTouchBinding(
  clientX: number,
  clientY: number,
  rect: TouchLayoutRect,
  joystickAvailable = true,
): TouchBinding {
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const cx = width / 2;
  const cy = height / 2;
  const topStrip = height * 0.105;
  const bottomStrip = height * 0.105;
  const joystickRadius = Math.min(width, height) * 0.19;

  if (y <= topStrip) return x < cx ? 'l' : 'r';
  if (y >= height - bottomStrip) return x < cx ? 'select' : 'start';

  if (joystickAvailable && Math.hypot(x - cx, y - cy) <= joystickRadius) return 'joystick';
  if (y < cy) return x < cx ? 'y' : 'x';
  return x < cx ? 'b' : 'a';
}

export function joystickVector(clientX: number, clientY: number, rect: TouchLayoutRect): Vec2 {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.155);
  const dx = clientX - cx;
  const dy = clientY - cy;
  const length = Math.hypot(dx, dy);
  const scale = length > radius ? radius / length : 1;
  return {
    x: (dx * scale) / radius,
    y: (dy * scale) / radius,
  };
}
