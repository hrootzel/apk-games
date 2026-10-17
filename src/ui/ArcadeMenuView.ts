import type { MenuController, MenuEntry, MenuSelection } from '../app/MenuController';

export class ArcadeMenuView {
  readonly element: HTMLDivElement;
  private readonly list: HTMLDivElement;
  private readonly status: HTMLDivElement;

  constructor(
    private readonly controller: MenuController,
    onSelect: (selection: MenuSelection) => void,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'arcade-menu';
    this.element.dataset.ui = 'true';
    this.element.innerHTML = `
      <div class="arcade-menu-kicker">VECTOR ARCADE SYSTEM</div>
      <div class="arcade-menu-title">SELECT PROGRAM</div>
      <div class="arcade-menu-list" role="listbox" aria-label="Vector Arcade programs"></div>
      <div class="arcade-menu-status">TOUCH AN ENTRY · OR USE JOYSTICK + A</div>
    `;
    const list = this.element.querySelector<HTMLDivElement>('.arcade-menu-list');
    const status = this.element.querySelector<HTMLDivElement>('.arcade-menu-status');
    if (!list || !status) throw new Error('Arcade menu DOM failed to initialize');
    this.list = list;
    this.status = status;

    for (const entry of controller.entries) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'arcade-menu-item';
      button.dataset.entryId = entry.id;
      button.dataset.ui = 'true';
      button.setAttribute('role', 'option');
      button.innerHTML = `
        <span class="arcade-menu-marker">◇</span>
        <span class="arcade-menu-copy">
          <span class="arcade-menu-name">${this.escape(entry.title)}</span>
          <span class="arcade-menu-subtitle">${this.escape(entry.subtitle ?? this.kindLabel(entry))}</span>
        </span>
      `;
      button.addEventListener('pointerenter', () => {
        const selection = controller.selectById(entry.id);
        if (selection) this.sync();
      });
      button.addEventListener('focus', () => {
        const selection = controller.selectById(entry.id);
        if (selection) this.sync();
      });
      button.addEventListener('click', () => {
        const selection = controller.selectById(entry.id);
        if (selection) onSelect(selection);
      });
      this.list.appendChild(button);
    }
    this.sync();
  }

  show(): void {
    this.element.classList.remove('hidden');
    this.sync();
  }

  hide(): void {
    this.element.classList.add('hidden');
  }

  sync(): void {
    const state = this.controller.getState();
    const buttons = this.list.querySelectorAll<HTMLButtonElement>('.arcade-menu-item');
    buttons.forEach((button, index) => {
      const selected = index === state.selectedIndex;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
      const marker = button.querySelector<HTMLElement>('.arcade-menu-marker');
      if (marker) marker.textContent = selected ? '◆' : '◇';
    });
    const active = buttons[state.selectedIndex];
    active?.scrollIntoView({ block: 'nearest' });
    this.status.textContent = `${state.selectedIndex + 1}/${this.controller.entries.length}  ·  TOUCH ENTRY OR ARROWS + SPACE  ·  CONFIGURATION FOR DISPLAY & CONTROLS`;
  }

  private kindLabel(entry: MenuEntry): string {
    return entry.kind === 'configuration' ? 'Global display and control configuration' : 'Vector game';
  }

  private escape(value: string): string {
    return value.replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    })[character] ?? character);
  }
}
