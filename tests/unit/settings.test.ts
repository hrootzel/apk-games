import { describe, expect, it } from 'vitest';
import { defaultGraphicsSettings } from '../../src/graphics/settings';

describe('default graphics settings', () => {
  it('start within the calibration UI ranges', () => {
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
    expect(defaultGraphicsSettings.controlOpacity).toBeGreaterThanOrEqual(0.05);
    expect(defaultGraphicsSettings.controlOpacity).toBeLessThanOrEqual(0.7);
  });
});
