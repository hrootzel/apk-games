import { describe, expect, it } from 'vitest';
import { classifyTouchBinding, joystickVector } from '../../src/input/layout';

const rect = { left: 100, top: 50, width: 1000, height: 600 };

describe('touch region mapping', () => {
  it('maps top strips to L and R', () => {
    expect(classifyTouchBinding(200, 70, rect)).toBe('l');
    expect(classifyTouchBinding(1000, 70, rect)).toBe('r');
  });

  it('maps bottom strips to Select and Start', () => {
    expect(classifyTouchBinding(200, 630, rect)).toBe('select');
    expect(classifyTouchBinding(1000, 630, rect)).toBe('start');
  });

  it('maps the four face quadrants to SNES-style Y/X/B/A', () => {
    expect(classifyTouchBinding(250, 180, rect, false)).toBe('y');
    expect(classifyTouchBinding(950, 180, rect, false)).toBe('x');
    expect(classifyTouchBinding(250, 520, rect, false)).toBe('b');
    expect(classifyTouchBinding(950, 520, rect, false)).toBe('a');
  });

  it('reserves the central region for the first joystick pointer', () => {
    expect(classifyTouchBinding(600, 350, rect, true)).toBe('joystick');
    expect(classifyTouchBinding(600, 350, rect, false)).toBe('a');
  });
});

describe('joystick vector', () => {
  it('is neutral at screen center', () => {
    expect(joystickVector(600, 350, rect)).toEqual({ x: 0, y: 0 });
  });

  it('preserves direction while clamping magnitude to one', () => {
    const v = joystickVector(1600, 950, rect);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1, 10);
    expect(v.x).toBeGreaterThan(0);
    expect(v.y).toBeGreaterThan(0);
  });

  it('returns proportional movement inside the joystick radius', () => {
    const v = joystickVector(600 + 46.5, 350, rect); // half of min(1000,600)*.155
    expect(v.x).toBeCloseTo(0.5, 10);
    expect(v.y).toBeCloseTo(0, 10);
  });
});
