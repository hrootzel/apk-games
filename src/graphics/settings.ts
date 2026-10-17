export interface GraphicsSettings {
  beamIntensity: number;
  glow: number;
  persistenceMs: number;
  phosphorBleed: number;
  colorSeparation: number;
  jitter: number;
  scanlines: number;
  vignette: number;
  controlOpacity: number;
}

export const defaultGraphicsSettings: GraphicsSettings = {
  beamIntensity: 1.0,
  glow: 1.0,
  persistenceMs: 280,
  phosphorBleed: 0.55,
  colorSeparation: 0.4,
  jitter: 0.42,
  scanlines: 0.18,
  vignette: 0.32,
  controlOpacity: 0.28,
};
