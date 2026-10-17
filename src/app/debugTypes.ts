import type { ButtonName, InputSnapshot } from '../game/types';
import type { GraphicsSettings } from '../graphics/settings';
import type { MenuController } from './MenuController';

export interface ArcadeDebugSnapshot {
  frameCount: number;
  mode: 'menu' | 'game';
  activeGameId: string | null;
  input: InputSnapshot;
  consumedInput: InputSnapshot | null;
  game: unknown;
  menu: ReturnType<MenuController['getState']>;
  settingsVisible: boolean;
  settings: GraphicsSettings;
  hud: string;
  renderer: string;
  screen: {
    width: number;
    height: number;
    resolution: number;
  };
}

export interface VectorArcadeE2EBridge {
  snapshot: () => ArcadeDebugSnapshot;
  input: {
    press: (button: ButtonName, pointerId?: number) => void;
    release: (button: ButtonName, pointerId?: number) => void;
    joystick: (x: number, y: number) => void;
    reset: () => void;
  };
}

export type VectorArcadeDebugWindow = Window & {
  __VECTOR_ARCADE_DEBUG__?: VectorArcadeE2EBridge;
  __VECTOR_ASTEROIDS_DEBUG__?: VectorArcadeE2EBridge;
};
