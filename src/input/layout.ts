import type { ButtonName } from '../game/types';

export interface TouchControl {
  id: ButtonName | 'fire-thrust';
  label: string;
  buttons: readonly ButtonName[];
  side: 'left' | 'right' | 'system';
  primary?: boolean;
}

export interface TouchProfile {
  controls: readonly TouchControl[];
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

/** Horizontal displacement controls steering speed; lifting immediately releases it. */
export function dragSteering(startX: number, currentX: number, travel: number): number {
  const displacement = (currentX - startX) / Math.max(1, travel);
  return Math.abs(displacement) < 0.06 ? 0 : Math.max(-1, Math.min(1, displacement));
}
