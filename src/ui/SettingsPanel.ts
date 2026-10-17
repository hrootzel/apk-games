import type { GraphicsSettings } from '../graphics/settings';

export class SettingsPanel {
  readonly element: HTMLDivElement;
  private visible = false;

  constructor(
    private readonly settings: GraphicsSettings,
    private readonly onChange: () => void,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'settings-panel hidden';
    this.element.dataset.ui = 'true';
    this.element.innerHTML = `
      <div class="settings-header">
        <span>VECTOR DISPLAY CALIBRATION</span>
        <button type="button" class="settings-close" data-ui="true">×</button>
      </div>
      ${this.slider('beamIntensity', 'BEAM INTENSITY', 0.25, 2.0, 0.05)}
      ${this.slider('glow', 'PHOSPHOR BLOOM', 0.0, 2.0, 0.05)}
      ${this.slider('persistenceMs', 'PERSISTENCE (MS)', 0, 900, 10)}
      ${this.slider('phosphorBleed', 'PHOSPHOR DIFFUSION', 0, 2.0, 0.05)}
      ${this.slider('colorSeparation', 'COLOR DECAY SPLIT', 0, 1.0, 0.05)}
      ${this.slider('jitter', 'BEAM JITTER', 0, 2.0, 0.05)}
      ${this.slider('scanlines', 'SCANLINE INTENSITY', 0, 0.7, 0.01)}
      ${this.slider('vignette', 'EDGE VIGNETTE', 0, 0.75, 0.01)}
      ${this.slider('controlOpacity', 'CONTROL OVERLAY', 0.05, 0.7, 0.01)}
      <div class="settings-help">SELECT / O toggles this panel · A / Space fires · joystick / arrows steer · B / ↑ thrusts · X hyperspace · Y brake · L/R or Q/E rotate · START / P pauses</div>
    `;

    this.element.querySelector<HTMLButtonElement>('.settings-close')?.addEventListener('click', () => this.hide());
    this.element.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach((input) => {
      input.addEventListener('input', () => {
        const key = input.dataset.setting as keyof GraphicsSettings;
        this.settings[key] = Number(input.value);
        const output = this.element.querySelector<HTMLElement>(`[data-value="${String(key)}"]`);
        if (output) output.textContent = this.formatValue(key, this.settings[key]);
        this.onChange();
      });
    });
  }

  toggle(): void {
    this.visible ? this.hide() : this.show();
  }

  show(): void {
    this.visible = true;
    this.element.classList.remove('hidden');
  }

  hide(): void {
    this.visible = false;
    this.element.classList.add('hidden');
  }

  private slider(key: keyof GraphicsSettings, label: string, min: number, max: number, step: number): string {
    const value = this.settings[key];
    return `
      <label class="settings-row">
        <span>${label}</span>
        <input data-setting="${String(key)}" data-ui="true" type="range" min="${min}" max="${max}" step="${step}" value="${value}" />
        <output data-value="${String(key)}">${this.formatValue(key, value)}</output>
      </label>
    `;
  }

  private formatValue(key: keyof GraphicsSettings, value: number): string {
    return key === 'persistenceMs' ? `${Math.round(value)}` : value.toFixed(2);
  }
}
