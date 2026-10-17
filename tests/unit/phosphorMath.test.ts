import { describe, expect, it } from 'vitest';
import { phosphorDecay, phosphorDiffusion } from '../../src/graphics/phosphorMath';

describe('phosphorDecay', () => {
  it('clears all colors immediately at zero persistence', () => {
    expect(phosphorDecay(16, 0, 0.5)).toEqual([0, 0, 0]);
  });

  it('produces identical channel decay with zero separation', () => {
    const [r, g, b] = phosphorDecay(16, 280, 0);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it('is frame-rate independent across segmented frames', () => {
    const part = phosphorDecay(8, 280, 0.6);
    const whole = phosphorDecay(16, 280, 0.6);
    for (let channel = 0; channel < 3; channel += 1) {
      expect(part[channel]! ** 2).toBeCloseTo(whole[channel]!, 12);
    }
  });

  it('keeps green longer than red and blue with separation enabled', () => {
    const [r, g, b] = phosphorDecay(40, 280, 1);
    expect(g).toBeGreaterThan(r);
    expect(r).toBeGreaterThan(b);
  });

  it('clamps color separation and frame time inputs to safe ranges', () => {
    expect(phosphorDecay(-50, 280, 4)).toEqual([1, 1, 1]);
    for (const value of phosphorDecay(1000, 30, 10)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('phosphorDiffusion', () => {
  it('is frame-rate independent', () => {
    const half = phosphorDiffusion(1000 / 120, 1);
    const full = phosphorDiffusion(1000 / 60, 1);
    expect((1 - half) ** 2).toBeCloseTo(1 - full, 12);
  });

  it('is zero for zero control and bounded for extreme inputs', () => {
    expect(phosphorDiffusion(16, 0)).toBe(0);
    expect(phosphorDiffusion(-16, 1)).toBe(0);
    expect(phosphorDiffusion(16, 100)).toBeGreaterThan(0);
    expect(phosphorDiffusion(16, 100)).toBeLessThan(1);
  });
});
