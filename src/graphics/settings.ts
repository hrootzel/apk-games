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
  controlSize: number;
  controlInset: number;
  dragSteering: number;
  combinedFireThrust: number;
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
  controlOpacity: 0.55,
  controlSize: 76,
  controlInset: 16,
  dragSteering: 0,
  combinedFireThrust: 1,
};
