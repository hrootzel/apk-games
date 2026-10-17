import type { GraphicsSettings } from '../graphics/settings';

export class SettingsPanel {
  readonly element: HTMLDivElement;
  private visible = false;
  private readonly returnButton: HTMLButtonElement | null;

  constructor(
    private readonly settings: GraphicsSettings,
    private readonly onChange: () => void,
    private readonly onReturnToMenu?: () => void,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'settings-panel hidden';
    this.element.dataset.ui = 'true';
    this.element.innerHTML = `
      <div class="settings-header">
        <span>VECTOR DISPLAY & CONTROLS</span>
        <button type="button" class="settings-close" data-ui="true" aria-label="Close settings">×</button>
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
      ${this.slider('controlSize', 'CONTROL SIZE (PX)', 56, 100, 2)}
      ${this.slider('controlInset', 'CONTROL EDGE SPACING (PX)', 8, 48, 2)}
      ${this.toggleControl('dragSteering', 'TEMPEST DRAG STEERING')}
      ${this.toggleControl('combinedFireThrust', 'FIRE + THRUST BUTTON')}
      <div class="settings-actions">
        <button type="button" class="settings-return" data-ui="true">RETURN TO ARCADE MENU</button>
      </div>
      <div class="settings-help">Settings are global across the arcade. SELECT / O opens configuration during a game. START pauses. START + SELECT together returns to the arcade menu.</div>
    `;

    this.element.querySelector<HTMLButtonElement>('.settings-close')?.addEventListener('click', () => this.hide());
    this.returnButton = this.element.querySelector<HTMLButtonElement>('.settings-return');
    if (!this.onReturnToMenu) this.returnButton?.classList.add('hidden');
    this.returnButton?.addEventListener('click', () => {
      this.hide();
      this.onReturnToMenu?.();
    });

    this.element.querySelectorAll<HTMLInputElement>('input[data-setting]').forEach((input) => {
      input.addEventListener('input', () => {
        const key = input.dataset.setting as keyof GraphicsSettings;
        this.settings[key] = input.type === 'checkbox' ? Number(input.checked) : Number(input.value);
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

  isVisible(): boolean {
    return this.visible;
  }

  private toggleControl(key: 'dragSteering' | 'combinedFireThrust', label: string): string {
    return `<label class="settings-row"><span>${label}</span>
      <input data-setting="${key}" data-ui="true" type="checkbox" ${this.settings[key] ? 'checked' : ''} />
    </label>`;
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
