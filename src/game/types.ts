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

export type ButtonName = 'a' | 'b' | 'x' | 'y' | 'l' | 'r' | 'start' | 'select';

export interface InputSnapshot {
  joystick: Vec2;
  buttons: Record<ButtonName, boolean>;
}
