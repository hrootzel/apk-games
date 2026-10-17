import type { ButtonName, InputSnapshot, Vec2 } from '../game/types';
import { dragSteering, type TouchProfile } from './layout';

const BUTTONS: ButtonName[] = ['a', 'b', 'x', 'y', 'l', 'r', 'start', 'select'];

interface PointerBinding {
  buttons: readonly ButtonName[];
  drag: boolean;
  startX: number;
}

export class TouchController {
  private readonly pointerBindings = new Map<number, PointerBinding>();
  private readonly pressed = new Map<ButtonName, Set<number>>();
  private joystickPointer: number | null = null;
  private joystick: Vec2 = { x: 0, y: 0 };
  private readonly keys = new Set<string>();

  private readonly overlay: HTMLDivElement;
  private visible = false;
  private profile: TouchProfile = { controls: [] };
  private readonly labelByButton = new Map<ButtonName, HTMLElement>();

  constructor(private readonly root: HTMLElement) {
    for (const button of BUTTONS) this.pressed.set(button, new Set());

    this.overlay = document.createElement('div');
    this.overlay.className = 'touch-overlay';
    this.root.appendChild(this.overlay);

    root.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    root.addEventListener('pointermove', this.onPointerMove, { passive: false });
    root.addEventListener('pointerup', this.onPointerUp, { passive: false });
    root.addEventListener('pointercancel', this.onPointerUp, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => this.debugResetInput());
    window.addEventListener('resize', () => this.debugResetInput());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.debugResetInput();
    });
    root.addEventListener('lostpointercapture', this.onPointerUp);
  }

  setProfile(profile: TouchProfile): void {
    this.debugResetInput();
    this.profile = profile;
    this.labelByButton.clear();
    this.overlay.replaceChildren();
    for (const side of ['left', 'right', 'system'] as const) {
      const group = document.createElement('div');
      group.className = `control-group controls-${side}`;
      for (const control of profile.controls.filter((entry) => entry.side === side)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `touch-button${control.primary ? ' primary' : ''}`;
        button.dataset.control = control.id;
        button.textContent = control.label;
        button.setAttribute('aria-label', control.id === 'l' ? 'Steer left' : control.id === 'r' ? 'Steer right' : control.label);
        group.appendChild(button);
        if (control.id !== 'fire-thrust') this.labelByButton.set(control.id, button);
      }
      this.overlay.appendChild(group);
    }
    if (profile.dragSteering) {
      const strip = document.createElement('div');
      strip.className = 'steering-strip';
      strip.dataset.control = 'drag';
      strip.textContent = 'DRAG ◀ STEER ▶';
      this.overlay.querySelector('.controls-left')?.prepend(strip);
    }
  }

  configure(size: number, inset: number, drag: boolean, combined: boolean): void {
    const useDrag = drag && Boolean(this.profile.dragSteering);
    if (this.overlay.classList.contains('use-drag') !== useDrag
      || this.overlay.classList.contains('use-combined') !== combined) this.debugResetInput();
    this.overlay.style.setProperty('--control-size', `${size}px`);
    this.overlay.style.setProperty('--control-inset', `${inset}px`);
    this.overlay.classList.toggle('use-drag', useDrag);
    this.overlay.classList.toggle('use-combined', combined);
  }

  setOverlayOpacity(opacity: number): void {
    this.overlay.style.setProperty('--control-opacity', String(opacity));
  }

  setVisible(visible: boolean): void {
    if (this.visible !== visible) this.debugResetInput();
    this.visible = visible;
    this.overlay.classList.toggle('hidden', !visible);
  }

  /**
   * Test-only input injection used by the browser E2E bridge. Production input
   * still comes exclusively from Pointer Events and keyboard events; these
   * methods are only exposed by main.ts when the app is loaded with ?e2e=1.
   */
  debugSetButton(button: ButtonName, pressed: boolean, pointerId = 9000): void {
    const pointers = this.pressed.get(button);
    if (!pointers) return;
    if (pressed) pointers.add(pointerId);
    else pointers.delete(pointerId);
    this.updateButtonVisual(button);
  }

  debugSetJoystick(x: number, y: number): void {
    const clampedX = Math.max(-1, Math.min(1, Number.isFinite(x) ? x : 0));
    const clampedY = Math.max(-1, Math.min(1, Number.isFinite(y) ? y : 0));
    const length = Math.hypot(clampedX, clampedY);
    const scale = length > 1 ? 1 / length : 1;
    this.joystick = { x: clampedX * scale, y: clampedY * scale };
  }

  debugResetInput(): void {
    this.pointerBindings.clear();
    this.joystickPointer = null;
    this.joystick = { x: 0, y: 0 };
    this.keys.clear();
    for (const button of BUTTONS) {
      this.pressed.get(button)?.clear();
      this.updateButtonVisual(button);
    }
  }

  snapshot(): InputSnapshot {
    const keyboardTurn = (this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('ArrowLeft') ? 1 : 0);
    const keyboardVertical = (this.keys.has('ArrowDown') ? 1 : 0) - (this.keys.has('ArrowUp') ? 1 : 0);

    const buttons = Object.fromEntries(
      BUTTONS.map((button) => [button, (this.pressed.get(button)?.size ?? 0) > 0]),
    ) as Record<ButtonName, boolean>;

    buttons.a ||= this.keys.has('Space');
    buttons.b ||= this.keys.has('ArrowUp');
    buttons.l ||= this.keys.has('KeyQ');
    buttons.r ||= this.keys.has('KeyE');
    buttons.start ||= this.keys.has('KeyP');
    buttons.select ||= this.keys.has('KeyO');
    buttons.x ||= this.keys.has('KeyX');
    buttons.y ||= this.keys.has('KeyY');

    return {
      joystick: {
        x: Math.max(-1, Math.min(1, this.joystick.x + keyboardTurn)),
        y: Math.max(-1, Math.min(1, this.joystick.y + keyboardVertical)),
      },
      buttons,
    };
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (this.pointerBindings.has(event.pointerId)) return;
    if (!this.visible || (event.target as HTMLElement | null)?.closest('[data-ui="true"]')) return;
    const element = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-control]');
    if (!element || !this.overlay.contains(element)) return;
    const drag = element.dataset.control === 'drag';
    if (drag && this.joystickPointer !== null) return;
    const control = this.profile.controls.find((entry) => entry.id === element.dataset.control);
    if (!drag && !control) return;
    event.preventDefault();
    try {
      this.root.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic PointerEvents cannot always be captured.
    }
    this.pointerBindings.set(event.pointerId, {
      buttons: control?.buttons ?? [], drag, startX: event.clientX,
    });
    if (drag) this.joystickPointer = event.pointerId;
    for (const button of control?.buttons ?? []) {
      this.pressed.get(button)?.add(event.pointerId);
      this.updateButtonVisual(button);
    }
  };

  private onPointerMove = (event: PointerEvent): void => {
    const pointer = this.pointerBindings.get(event.pointerId);
    if (!pointer?.drag) return;
    event.preventDefault();
    const travel = this.overlay.querySelector('.steering-strip')!.getBoundingClientRect().width * 0.35;
    this.joystick = { x: dragSteering(pointer.startX, event.clientX, travel), y: 0 };
  };

  private onPointerUp = (event: PointerEvent): void => {
    const pointer = this.pointerBindings.get(event.pointerId);
    if (!pointer) return;
    if (event.cancelable) event.preventDefault();
    if (pointer.drag) {
      this.joystickPointer = null;
      this.joystick = { x: 0, y: 0 };
    }
    for (const button of pointer.buttons) {
      this.pressed.get(button)?.delete(event.pointerId);
      this.updateButtonVisual(button);
    }
    this.pointerBindings.delete(event.pointerId);
  };

  private updateButtonVisual(button: ButtonName): void {
    this.labelByButton.get(button)?.classList.toggle('active', (this.pressed.get(button)?.size ?? 0) > 0);
    this.overlay.querySelector('[data-control="fire-thrust"]')?.classList.toggle('active',
      (this.pressed.get('a')?.size ?? 0) > 0 && (this.pressed.get('b')?.size ?? 0) > 0);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    this.keys.add(event.code);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };
}
