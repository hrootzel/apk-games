import type { ButtonName, InputSnapshot, Vec2 } from '../game/types';
import { classifyTouchBinding, joystickVector, type TouchBinding } from './layout';

const BUTTONS: ButtonName[] = ['a', 'b', 'x', 'y', 'l', 'r', 'start', 'select'];

interface PointerBinding {
  binding: TouchBinding;
  startX: number;
  startY: number;
}

export class TouchController {
  private readonly pointerBindings = new Map<number, PointerBinding>();
  private readonly pressed = new Map<ButtonName, Set<number>>();
  private joystickPointer: number | null = null;
  private joystick: Vec2 = { x: 0, y: 0 };
  private readonly keys = new Set<string>();

  private readonly overlay: HTMLDivElement;
  private readonly joystickKnob: HTMLDivElement;
  private readonly labelByButton = new Map<ButtonName, HTMLElement>();

  constructor(private readonly root: HTMLElement) {
    for (const button of BUTTONS) this.pressed.set(button, new Set());

    this.overlay = document.createElement('div');
    this.overlay.className = 'touch-overlay';
    this.overlay.innerHTML = `
      <div class="zone strip top left" data-control="l">L</div>
      <div class="zone strip top right" data-control="r">R</div>
      <div class="zone face upper left" data-control="y">Y</div>
      <div class="zone face upper right" data-control="x">X</div>
      <div class="zone face lower left" data-control="b">B</div>
      <div class="zone face lower right" data-control="a">A</div>
      <div class="zone strip bottom left" data-control="select">SELECT</div>
      <div class="zone strip bottom right" data-control="start">START</div>
      <div class="joystick-shell"><div class="joystick-ring"></div><div class="joystick-knob"></div></div>
    `;
    this.root.appendChild(this.overlay);

    const knob = this.overlay.querySelector<HTMLDivElement>('.joystick-knob');
    if (!knob) throw new Error('Joystick knob was not created');
    this.joystickKnob = knob;

    for (const button of BUTTONS) {
      const label = this.overlay.querySelector<HTMLElement>(`[data-control="${button}"]`);
      if (label) this.labelByButton.set(button, label);
    }

    root.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    root.addEventListener('pointermove', this.onPointerMove, { passive: false });
    root.addEventListener('pointerup', this.onPointerUp, { passive: false });
    root.addEventListener('pointercancel', this.onPointerUp, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  setOverlayOpacity(opacity: number): void {
    this.overlay.style.setProperty('--control-opacity', String(opacity));
  }

  setVisible(visible: boolean): void {
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

    const rect = this.root.getBoundingClientRect();
    const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.155);
    const px = this.joystick.x * radius;
    const py = this.joystick.y * radius;
    this.joystickKnob.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`;
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
    this.joystickKnob.style.transform = 'translate(-50%, -50%)';
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
    if ((event.target as HTMLElement | null)?.closest('[data-ui="true"]')) return;
    event.preventDefault();
    try {
      this.root.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic pointer events (used by browser tests) may not be capturable.
    }

    const binding = classifyTouchBinding(
      event.clientX,
      event.clientY,
      this.root.getBoundingClientRect(),
      this.joystickPointer === null,
    );
    this.pointerBindings.set(event.pointerId, {
      binding,
      startX: event.clientX,
      startY: event.clientY,
    });

    if (binding === 'joystick') {
      this.joystickPointer = event.pointerId;
      this.updateJoystick(event.clientX, event.clientY);
    } else {
      this.pressed.get(binding)?.add(event.pointerId);
      this.updateButtonVisual(binding);
    }
  };

  private onPointerMove = (event: PointerEvent): void => {
    const pointer = this.pointerBindings.get(event.pointerId);
    if (!pointer || pointer.binding !== 'joystick') return;
    event.preventDefault();
    this.updateJoystick(event.clientX, event.clientY);
  };

  private onPointerUp = (event: PointerEvent): void => {
    const pointer = this.pointerBindings.get(event.pointerId);
    if (!pointer) return;
    event.preventDefault();

    if (pointer.binding === 'joystick') {
      if (this.joystickPointer === event.pointerId) {
        this.joystickPointer = null;
        this.joystick = { x: 0, y: 0 };
        this.joystickKnob.style.transform = 'translate(-50%, -50%)';
      }
    } else {
      this.pressed.get(pointer.binding)?.delete(event.pointerId);
      this.updateButtonVisual(pointer.binding);
    }

    this.pointerBindings.delete(event.pointerId);
  };

  private updateJoystick(clientX: number, clientY: number): void {
    const rect = this.root.getBoundingClientRect();
    this.joystick = joystickVector(clientX, clientY, rect);
    const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.155);
    const px = this.joystick.x * radius;
    const py = this.joystick.y * radius;
    this.joystickKnob.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`;
  }

  private updateButtonVisual(button: ButtonName): void {
    this.labelByButton.get(button)?.classList.toggle('active', (this.pressed.get(button)?.size ?? 0) > 0);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    this.keys.add(event.code);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };
}
