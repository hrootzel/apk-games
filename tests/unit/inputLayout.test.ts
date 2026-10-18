import { describe, expect, it } from 'vitest';
import { ASTEROIDS_TOUCH, PHOSPHOR_SWARM_TOUCH, TEMPEST_TOUCH, dragSteering, radialAnalog } from '../../src/input/layout';

describe('game touch profiles', () => {
  it('provides game-specific action labels while retaining system controls', () => {
    for (const profile of [ASTEROIDS_TOUCH, TEMPEST_TOUCH, PHOSPHOR_SWARM_TOUCH]) {
      const buttons = new Set(profile.controls.flatMap((control) => control.buttons));
      expect(buttons.has('start')).toBe(true);
      expect(buttons.has('select')).toBe(true);
      expect(new Set(profile.controls.map((control) => control.id)).size).toBe(profile.controls.length);
    }
    expect(ASTEROIDS_TOUCH.controls.find((control) => control.id === 'b')?.label).toBe('THRUST');
    expect(TEMPEST_TOUCH.controls.find((control) => control.id === 'b')?.label).toBe('SUPERZAP');
    expect(PHOSPHOR_SWARM_TOUCH.controls.find((control) => control.id === 'b')?.label).toBe('DASH');
  });

  it('assigns specialized analog layouts only where needed', () => {
    expect(ASTEROIDS_TOUCH.controls.find((control) => control.id === 'fire-thrust')?.buttons).toEqual(['a', 'b']);
    expect(TEMPEST_TOUCH.dragSteering).toBe(true);
    expect(PHOSPHOR_SWARM_TOUCH.analog?.map((entry) => entry.target)).toEqual(['joystick', 'aim']);
    expect(PHOSPHOR_SWARM_TOUCH.analog?.find((entry) => entry.target === 'aim')?.buttons).toEqual(['a']);
  });
});

describe('relative analog steering', () => {
  it('scales horizontal drag and clamps it', () => {
    expect(dragSteering(450, 455, 100)).toBe(0);
    expect(dragSteering(450, 500, 100)).toBe(0.5);
    expect(dragSteering(450, 100, 100)).toBe(-1);
  });

  it('normalizes radial motion into a circular range', () => {
    expect(radialAnalog(100, 100, 102, 103, 100)).toEqual({ x: 0, y: 0 });
    expect(radialAnalog(100, 100, 150, 100, 100)).toEqual({ x: 0.5, y: 0 });
    const diagonal = radialAnalog(0, 0, 100, 100, 50);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1, 6);
  });
});
