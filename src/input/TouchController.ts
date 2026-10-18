import type { ButtonName, InputSnapshot, Vec2 } from '../game/types';
import { dragSteering, radialAnalog, type TouchAnalogControl, type TouchProfile } from './layout';
import type { InputSettings } from './settings';

const BUTTONS: ButtonName[] = ['a', 'b', 'x', 'y', 'l', 'r', 'start', 'select'];
type AnalogTarget = 'joystick' | 'aim';

interface PointerBinding {
  buttons: readonly ButtonName[];
  target?: AnalogTarget;
  horizontalOnly?: boolean;
  startX: number;
  startY: number;
  travel: number;
}

export class TouchController {
  private readonly pointerBindings = new Map<number, PointerBinding>();
  private readonly pressed = new Map<ButtonName, Set<number>>();
  private joystickPointer: number | null = null;
  private aimPointer: number | null = null;
  private joystick: Vec2 = { x: 0, y: 0 };
  private aim: Vec2 = { x: 0, y: 0 };
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

      for (const analog of profile.analog?.filter((entry) => entry.side === side) ?? []) {
        group.appendChild(this.createAnalogPad(analog));
      }

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

  configure(settings: InputSettings): void {
    const useDrag = Boolean(settings.dragSteering) && Boolean(this.profile.dragSteering);
    const combined = Boolean(settings.combinedFireThrust);
    if (this.overlay.classList.contains('use-drag') !== useDrag
      || this.overlay.classList.contains('use-combined') !== combined) this.debugResetInput();
    this.overlay.style.setProperty('--control-size', `${settings.controlSize}px`);
    this.overlay.style.setProperty('--control-inset', `${settings.controlInset}px`);
    this.overlay.style.setProperty('--control-opacity', String(settings.controlOpacity));
    this.overlay.classList.toggle('use-drag', useDrag);
    this.overlay.classList.toggle('use-combined', combined);
    this.overlay.classList.toggle('use-analog', Boolean(this.profile.analog?.length));
  }

  setVisible(visible: boolean): void {
    if (this.visible !== visible) this.debugResetInput();
    this.visible = visible;
    this.overlay.classList.toggle('hidden', !visible);
  }

  /** Test-only button injection used by the browser E2E bridge. */
  debugSetButton(button: ButtonName, pressed: boolean, pointerId = 9000): void {
    const pointers = this.pressed.get(button);
    if (!pointers) return;
    if (pressed) pointers.add(pointerId);
    else pointers.delete(pointerId);
    this.updateButtonVisual(button);
  }

  debugSetJoystick(x: number, y: number): void {
    this.joystick = this.clampVector(x, y);
  }

  debugSetAim(x: number, y: number): void {
    this.aim = this.clampVector(x, y);
  }

  debugResetInput(): void {
    this.pointerBindings.clear();
    this.joystickPointer = null;
    this.aimPointer = null;
    this.joystick = { x: 0, y: 0 };
    this.aim = { x: 0, y: 0 };
    this.keys.clear();
    for (const button of BUTTONS) {
      this.pressed.get(button)?.clear();
      this.updateButtonVisual(button);
    }
  }

  snapshot(): InputSnapshot {
    const keyboardTurn = (this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('ArrowLeft') ? 1 : 0);
    const keyboardVertical = (this.keys.has('ArrowDown') ? 1 : 0) - (this.keys.has('ArrowUp') ? 1 : 0);
    const keyboardAimX = (this.keys.has('KeyL') ? 1 : 0) - (this.keys.has('KeyJ') ? 1 : 0);
    const keyboardAimY = (this.keys.has('KeyK') ? 1 : 0) - (this.keys.has('KeyI') ? 1 : 0);

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
      joystick: this.clampVector(this.joystick.x + keyboardTurn, this.joystick.y + keyboardVertical),
      aim: this.clampVector(this.aim.x + keyboardAimX, this.aim.y + keyboardAimY),
      buttons,
    };
  }

  private createAnalogPad(analog: TouchAnalogControl): HTMLElement {
    const pad = document.createElement('div');
    pad.className = `touch-analog touch-analog-${analog.target}`;
    pad.dataset.analog = analog.id;
    pad.dataset.control = analog.id;
    pad.setAttribute('role', 'button');
    pad.setAttribute('aria-label', analog.label);
    pad.innerHTML = `<span>${analog.label}</span><i></i>`;
    return pad;
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (this.pointerBindings.has(event.pointerId)) return;
    if (!this.visible || (event.target as HTMLElement | null)?.closest('[data-ui="true"]')) return;
    const element = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-control]');
    if (!element || !this.overlay.contains(element)) return;

    const analog = this.profile.analog?.find((entry) => entry.id === element.dataset.control);
    const legacyDrag = element.dataset.control === 'drag';
    const control = this.profile.controls.find((entry) => entry.id === element.dataset.control);
    if (!analog && !legacyDrag && !control) return;

    const target: AnalogTarget | undefined = analog?.target ?? (legacyDrag ? 'joystick' : undefined);
    if (target === 'joystick' && this.joystickPointer !== null) return;
    if (target === 'aim' && this.aimPointer !== null) return;

    event.preventDefault();
    try {
      this.root.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic PointerEvents cannot always be captured.
    }

    const rect = element.getBoundingClientRect();
    const binding: PointerBinding = {
      buttons: analog?.buttons ?? control?.buttons ?? [],
      target,
      horizontalOnly: legacyDrag,
      startX: event.clientX,
      startY: event.clientY,
      travel: Math.max(42, Math.min(rect.width || 84, rect.height || 84) * 0.45),
    };
    this.pointerBindings.set(event.pointerId, binding);
    if (target === 'joystick') this.joystickPointer = event.pointerId;
    if (target === 'aim') this.aimPointer = event.pointerId;
    for (const button of binding.buttons) {
      this.pressed.get(button)?.add(event.pointerId);
      this.updateButtonVisual(button);
    }
  };

  private onPointerMove = (event: PointerEvent): void => {
    const pointer = this.pointerBindings.get(event.pointerId);
    if (!pointer?.target) return;
    event.preventDefault();
    const vector = pointer.horizontalOnly
      ? { x: dragSteering(pointer.startX, event.clientX, pointer.travel), y: 0 }
      : radialAnalog(pointer.startX, pointer.startY, event.clientX, event.clientY, pointer.travel);
    if (pointer.target === 'joystick') this.joystick = vector;
    else this.aim = vector;
  };

  private onPointerUp = (event: PointerEvent): void => {
    const pointer = this.pointerBindings.get(event.pointerId);
    if (!pointer) return;
    for (const button of pointer.buttons) {
      this.pressed.get(button)?.delete(event.pointerId);
      this.updateButtonVisual(button);
    }
    if (pointer.target === 'joystick' && this.joystickPointer === event.pointerId) {
      this.joystickPointer = null;
      this.joystick = { x: 0, y: 0 };
    }
    if (pointer.target === 'aim' && this.aimPointer === event.pointerId) {
      this.aimPointer = null;
      this.aim = { x: 0, y: 0 };
    }
    this.pointerBindings.delete(event.pointerId);
    try {
      if (this.root.hasPointerCapture?.(event.pointerId)) this.root.releasePointerCapture?.(event.pointerId);
    } catch {
      // Browser synthetic input may not have a capture to release.
    }
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if ((event.target as HTMLElement | null)?.matches('input, textarea, select')) return;
    this.keys.add(event.code);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private updateButtonVisual(button: ButtonName): void {
    this.labelByButton.get(button)?.classList.toggle('active', (this.pressed.get(button)?.size ?? 0) > 0);
  }

  private clampVector(x: number, y: number): Vec2 {
    let safeX = Number.isFinite(x) ? x : 0;
    let safeY = Number.isFinite(y) ? y : 0;
    const length = Math.hypot(safeX, safeY);
    if (length > 1) {
      safeX /= length;
      safeY /= length;
    }
    return { x: Math.max(-1, Math.min(1, safeX)), y: Math.max(-1, Math.min(1, safeY)) };
  }
}
