/**
 * Frame-rate-independent persistence. Color separation mimics differing decay
 * rates across phosphor channels; it does not assume a fixed RGB phosphor.
 */
export function phosphorDecay(
  deltaMs: number,
  persistenceMs: number,
  colorSeparation: number,
): [number, number, number] {
  if (persistenceMs <= 0) return [0, 0, 0];

  // persistenceMs is the approximately 95%-faded time, not the half-life.
  const baseTau = Math.max(0.1, persistenceMs / 3);
  const spread = Math.max(0, Math.min(1, colorSeparation));
  const dt = Math.max(0, deltaMs);
  const red = Math.exp(-dt / (baseTau * (1 - 0.13 * spread)));
  const green = Math.exp(-dt / (baseTau * (1 + 0.4 * spread)));
  const blue = Math.exp(-dt / (baseTau * (1 - 0.38 * spread)));
  return [red, green, blue];
}

/** Converts a 60-Hz diffusion mix into a real-time equivalent, so a 30-Hz
 * device does not lose half the phosphor spreading of a 60-Hz device. */
export function phosphorDiffusion(
  deltaMs: number,
  bleedControl: number,
): number {
  const base = Math.max(0, Math.min(0.24, bleedControl * 0.12));
  return 1 - Math.pow(1 - base, Math.max(0, deltaMs) / (1000 / 60));
}
