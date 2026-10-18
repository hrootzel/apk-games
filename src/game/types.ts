export interface Vec2 {
  x: number;
  y: number;
}

export interface VectorPath {
  points: Vec2[];
  color: number;
  intensity?: number;
  width?: number;
  closed?: boolean;
}

/** Lightweight GPU-particle snapshot emitted by games without importing PixiJS. */
export interface ArcadeParticle {
  x: number;
  y: number;
  color: number;
  alpha: number;
  size: number;
  rotation?: number;
  stretch?: number;
}

export type ButtonName = 'a' | 'b' | 'x' | 'y' | 'l' | 'r' | 'start' | 'select';

export interface InputSnapshot {
  /** Primary movement/steering vector. */
  joystick: Vec2;
  /** Independent aim vector for twin-stick games. */
  aim: Vec2;
  buttons: Record<ButtonName, boolean>;
}
