import { describe, expect, it } from 'vitest';
import { ASTEROIDS_TOUCH, TEMPEST_TOUCH, dragSteering } from '../../src/input/layout';

describe('game touch profiles', () => {
  it('provides shared logical controls with game-specific action labels', () => {
    for (const profile of [ASTEROIDS_TOUCH, TEMPEST_TOUCH]) {
      expect(new Set(profile.controls.flatMap((control) => control.buttons)))
        .toEqual(new Set(['l', 'r', 'a', 'b', 'x', 'y', 'start', 'select']));
      expect(profile.controls.filter((control) => ['l', 'r'].includes(control.id))
        .every((control) => control.side === 'left')).toBe(true);
      expect(new Set(profile.controls.map((control) => control.id)).size).toBe(profile.controls.length);
    }
    expect(ASTEROIDS_TOUCH.controls.find((control) => control.id === 'b')?.label).toBe('THRUST');
    expect(TEMPEST_TOUCH.controls.find((control) => control.id === 'b')?.label).toBe('SUPERZAP');
  });

  it('offers combined fire and thrust only for Asteroids and drag only for Tempest', () => {
    expect(ASTEROIDS_TOUCH.controls.find((control) => control.id === 'fire-thrust')?.buttons).toEqual(['a', 'b']);
    expect(TEMPEST_TOUCH.controls.some((control) => control.id === 'fire-thrust')).toBe(false);
    expect(ASTEROIDS_TOUCH.dragSteering).toBeUndefined();
    expect(TEMPEST_TOUCH.dragSteering).toBe(true);
  });
});

describe('relative horizontal steering', () => {
  it('starts neutral at any touch origin and ignores tiny movements', () => {
    expect(dragSteering(450, 450, 100)).toBe(0);
    expect(dragSteering(450, 455, 100)).toBe(0);
  });
  it('scales both directions and clamps at full steering', () => {
    expect(dragSteering(450, 500, 100)).toBe(0.5);
    expect(dragSteering(450, 400, 100)).toBe(-0.5);
    expect(dragSteering(450, 800, 100)).toBe(1);
    expect(dragSteering(450, 100, 100)).toBe(-1);
    expect(dragSteering(0, 10, 0)).toBe(1);
  });
});
