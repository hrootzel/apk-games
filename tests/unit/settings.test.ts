import { describe, expect, it } from 'vitest';
import { defaultGraphicsSettings } from '../../src/graphics/settings';
import { defaultInputSettings } from '../../src/input/settings';

describe('default settings', () => {
  it('keeps graphics calibration within UI ranges', () => {
    expect(defaultGraphicsSettings.beamIntensity).toBeGreaterThanOrEqual(0.25);
    expect(defaultGraphicsSettings.beamIntensity).toBeLessThanOrEqual(2);
    expect(defaultGraphicsSettings.glow).toBeGreaterThanOrEqual(0);
    expect(defaultGraphicsSettings.glow).toBeLessThanOrEqual(2);
    expect(defaultGraphicsSettings.persistenceMs).toBeGreaterThanOrEqual(0);
    expect(defaultGraphicsSettings.persistenceMs).toBeLessThanOrEqual(900);
    expect(defaultGraphicsSettings.phosphorBleed).toBeGreaterThanOrEqual(0);
    expect(defaultGraphicsSettings.phosphorBleed).toBeLessThanOrEqual(2);
    expect(defaultGraphicsSettings.colorSeparation).toBeGreaterThanOrEqual(0);
    expect(defaultGraphicsSettings.colorSeparation).toBeLessThanOrEqual(1);
  });

  it('keeps touch/input defaults within UI ranges', () => {
    expect(defaultInputSettings.controlOpacity).toBeGreaterThanOrEqual(0.05);
    expect(defaultInputSettings.controlOpacity).toBeLessThanOrEqual(0.7);
    expect(defaultInputSettings.controlSize).toBeGreaterThanOrEqual(56);
    expect(defaultInputSettings.controlSize).toBeLessThanOrEqual(100);
    expect(defaultInputSettings.controlInset).toBeGreaterThanOrEqual(8);
    expect(defaultInputSettings.controlInset).toBeLessThanOrEqual(48);
    expect(defaultInputSettings.dragSteering).toBe(0);
    expect(defaultInputSettings.combinedFireThrust).toBe(1);
  });
});
