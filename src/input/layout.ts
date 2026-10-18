import type { ButtonName } from '../game/types';

export interface TouchControl {
  id: ButtonName | 'fire-thrust';
  label: string;
  buttons: readonly ButtonName[];
  side: 'left' | 'right' | 'system';
  primary?: boolean;
}

export interface TouchAnalogControl {
  id: 'move-pad' | 'aim-pad';
  label: string;
  target: 'joystick' | 'aim';
  side: 'left' | 'right';
  /** Buttons held while this pad is touched; aim-pad uses A for autofire. */
  buttons?: readonly ButtonName[];
}

export interface TouchProfile {
  controls: readonly TouchControl[];
  analog?: readonly TouchAnalogControl[];
  dragSteering?: boolean;
}

const steering: TouchControl[] = [
  { id: 'l', label: '◀', buttons: ['l'], side: 'left', primary: true },
  { id: 'r', label: '▶', buttons: ['r'], side: 'left', primary: true },
];
const system: TouchControl[] = [
  { id: 'select', label: 'SELECT · SETTINGS', buttons: ['select'], side: 'system' },
  { id: 'start', label: 'START · PAUSE', buttons: ['start'], side: 'system' },
];

export const ASTEROIDS_TOUCH: TouchProfile = {
  controls: [
    ...steering,
    { id: 'y', label: 'BRAKE', buttons: ['y'], side: 'left' },
    { id: 'x', label: 'HYPERSPACE', buttons: ['x'], side: 'right' },
    { id: 'b', label: 'THRUST', buttons: ['b'], side: 'right', primary: true },
    { id: 'a', label: 'FIRE', buttons: ['a'], side: 'right', primary: true },
    { id: 'fire-thrust', label: 'FIRE + THRUST', buttons: ['a', 'b'], side: 'right' },
    ...system,
  ],
};

export const TEMPEST_TOUCH: TouchProfile = {
  dragSteering: true,
  controls: [
    ...steering,
    { id: 'y', label: 'PRECISION', buttons: ['y'], side: 'left' },
    { id: 'x', label: 'JUMP', buttons: ['x'], side: 'right' },
    { id: 'b', label: 'SUPERZAP', buttons: ['b'], side: 'right' },
    { id: 'a', label: 'FIRE', buttons: ['a'], side: 'right', primary: true },
    ...system,
  ],
};

export const PHOSPHOR_SWARM_TOUCH: TouchProfile = {
  analog: [
    { id: 'move-pad', label: 'MOVE', target: 'joystick', side: 'left' },
    { id: 'aim-pad', label: 'AIM · FIRE', target: 'aim', side: 'right', buttons: ['a'] },
  ],
  controls: [
    { id: 'l', label: 'WEAPON −', buttons: ['l'], side: 'left' },
    { id: 'r', label: 'WEAPON +', buttons: ['r'], side: 'left' },
    { id: 'y', label: 'REPULSE', buttons: ['y'], side: 'left' },
    { id: 'b', label: 'DASH', buttons: ['b'], side: 'right' },
    { id: 'x', label: 'PULSE BOMB', buttons: ['x'], side: 'right' },
    ...system,
  ],
};

/** Horizontal displacement controls steering speed; lifting immediately releases it. */
export function dragSteering(startX: number, currentX: number, travel: number): number {
  const displacement = (currentX - startX) / Math.max(1, travel);
  return Math.abs(displacement) < 0.06 ? 0 : Math.max(-1, Math.min(1, displacement));
}

/** Normalize a two-axis touch displacement into a circular -1..1 analog vector. */
export function radialAnalog(startX: number, startY: number, currentX: number, currentY: number, travel: number): { x: number; y: number } {
  const safeTravel = Math.max(1, travel);
  let x = (currentX - startX) / safeTravel;
  let y = (currentY - startY) / safeTravel;
  const length = Math.hypot(x, y);
  if (length < 0.06) return { x: 0, y: 0 };
  if (length > 1) {
    x /= length;
    y /= length;
  }
  return { x, y };
}
