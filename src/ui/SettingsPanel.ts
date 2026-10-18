import type { GraphicsSettings } from '../graphics/settings';
import type { InputSettings } from '../input/settings';

type GraphicsKey = keyof GraphicsSettings;
type InputKey = keyof InputSettings;

export class SettingsPanel {
  readonly element: HTMLDivElement;
  private visible = false;
  private readonly returnButton: HTMLButtonElement | null;

  constructor(
    private readonly graphics: GraphicsSettings,
    private readonly input: InputSettings,
    private readonly onChange: () => void,
    private readonly onReturnToMenu?: () => void,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'settings-panel hidden';
    this.element.dataset.ui = 'true';
    this.element.innerHTML = `
      <div class="settings-header">
        <span>VECTOR ARCADE CONFIGURATION</span>
        <button type="button" class="settings-close" data-ui="true" aria-label="Close settings">×</button>
      </div>
      <div class="settings-section-title">DISPLAY / PHOSPHOR</div>
      ${this.graphicsSlider('beamIntensity', 'BEAM INTENSITY', 0.25, 2.0, 0.05)}
      ${this.graphicsSlider('glow', 'PHOSPHOR BLOOM', 0.0, 2.0, 0.05)}
      ${this.graphicsSlider('persistenceMs', 'PERSISTENCE (MS)', 0, 900, 10)}
      ${this.graphicsSlider('phosphorBleed', 'PHOSPHOR DIFFUSION', 0, 2.0, 0.05)}
      ${this.graphicsSlider('colorSeparation', 'COLOR DECAY SPLIT', 0, 1.0, 0.05)}
      ${this.graphicsSlider('jitter', 'BEAM JITTER', 0, 2.0, 0.05)}
      ${this.graphicsSlider('scanlines', 'SCANLINE INTENSITY', 0, 0.7, 0.01)}
      ${this.graphicsSlider('vignette', 'EDGE VIGNETTE', 0, 0.75, 0.01)}
      <div class="settings-section-title">INPUT / TOUCH</div>
      ${this.inputSlider('controlOpacity', 'CONTROL OVERLAY', 0.05, 0.7, 0.01)}
      ${this.inputSlider('controlSize', 'CONTROL SIZE (PX)', 56, 100, 2)}
      ${this.inputSlider('controlInset', 'CONTROL EDGE SPACING (PX)', 8, 48, 2)}
      ${this.toggleControl('dragSteering', 'TEMPEST DRAG STEERING')}
      ${this.toggleControl('combinedFireThrust', 'FIRE + THRUST BUTTON')}
      <div class="settings-actions">
        <button type="button" class="settings-return" data-ui="true">RETURN TO ARCADE MENU</button>
      </div>
      <div class="settings-help">Display settings affect the phosphor renderer. Input settings affect touch overlays only. SELECT / O opens configuration during a game. START pauses. START + SELECT together returns to the arcade menu.</div>
    `;

    this.element.querySelector<HTMLButtonElement>('.settings-close')?.addEventListener('click', () => this.hide());
    this.returnButton = this.element.querySelector<HTMLButtonElement>('.settings-return');
    if (!this.onReturnToMenu) this.returnButton?.classList.add('hidden');
    this.returnButton?.addEventListener('click', () => {
      this.hide();
      this.onReturnToMenu?.();
    });

    this.element.querySelectorAll<HTMLInputElement>('input[data-domain][data-setting]').forEach((input) => {
      input.addEventListener('input', () => {
        const domain = input.dataset.domain;
        const key = input.dataset.setting ?? '';
        const value = input.type === 'checkbox' ? Number(input.checked) : Number(input.value);
        if (domain === 'graphics' && key in this.graphics) {
          const typed = key as GraphicsKey;
          this.graphics[typed] = value;
          this.updateOutput(domain, typed, value);
        } else if (domain === 'input' && key in this.input) {
          const typed = key as InputKey;
          this.input[typed] = value;
          this.updateOutput(domain, typed, value);
        }
        this.onChange();
      });
    });
  }

  toggle(): void { this.visible ? this.hide() : this.show(); }
  show(): void { this.visible = true; this.element.classList.remove('hidden'); }
  hide(): void { this.visible = false; this.element.classList.add('hidden'); }
  isVisible(): boolean { return this.visible; }

  private toggleControl(key: 'dragSteering' | 'combinedFireThrust', label: string): string {
    return `<label class="settings-row"><span>${label}</span>
      <input data-domain="input" data-setting="${key}" data-ui="true" type="checkbox" ${this.input[key] ? 'checked' : ''} />
    </label>`;
  }

  private graphicsSlider(key: GraphicsKey, label: string, min: number, max: number, step: number): string {
    return this.sliderMarkup('graphics', key, label, min, max, step, this.graphics[key]);
  }

  private inputSlider(key: InputKey, label: string, min: number, max: number, step: number): string {
    return this.sliderMarkup('input', key, label, min, max, step, this.input[key]);
  }

  private sliderMarkup(domain: 'graphics' | 'input', key: string, label: string, min: number, max: number, step: number, value: number): string {
    return `
      <label class="settings-row">
        <span>${label}</span>
        <input data-domain="${domain}" data-setting="${key}" data-ui="true" type="range" min="${min}" max="${max}" step="${step}" value="${value}" />
        <output data-value="${domain}.${key}">${this.formatValue(key, value)}</output>
      </label>
    `;
  }

  private updateOutput(domain: string, key: string, value: number): void {
    const output = this.element.querySelector<HTMLElement>(`[data-value="${domain}.${key}"]`);
    if (output) output.textContent = this.formatValue(key, value);
  }

  private formatValue(key: string, value: number): string {
    return key === 'persistenceMs' ? `${Math.round(value)}` : value.toFixed(2);
  }
}
