import type { InputSnapshot } from '../game/types';

export type MenuEntryKind = 'game' | 'configuration';

export interface MenuEntry {
  id: string;
  title: string;
  subtitle?: string;
  kind: MenuEntryKind;
}

export interface MenuSelection {
  id: string;
  kind: MenuEntryKind;
}

export class MenuController {
  private selectedIndex = 0;
  private scrollOffset = 0;
  private lastVertical = 0;
  private lastConfirm = false;

  constructor(
    readonly entries: readonly MenuEntry[],
    private readonly visibleRows = 5,
  ) {
    if (entries.length === 0) throw new Error('Menu requires at least one entry');
  }

  update(input: InputSnapshot): MenuSelection | null {
    const vertical = input.joystick.y;
    const direction = vertical <= -0.45 ? -1 : vertical >= 0.45 ? 1 : 0;

    if (direction !== 0 && this.lastVertical === 0) this.move(direction);
    this.lastVertical = direction;

    const confirm = input.buttons.a || input.buttons.start;
    let selection: MenuSelection | null = null;
    if (confirm && !this.lastConfirm) {
      const entry = this.entries[this.selectedIndex];
      if (entry) selection = { id: entry.id, kind: entry.kind };
    }
    this.lastConfirm = confirm;
    return selection;
  }

  move(delta: number): void {
    const length = this.entries.length;
    this.selectedIndex = ((this.selectedIndex + delta) % length + length) % length;
    this.ensureVisible();
  }

  selectById(id: string): MenuSelection | null {
    const index = this.entries.findIndex((entry) => entry.id === id);
    if (index < 0) return null;
    this.selectedIndex = index;
    this.ensureVisible();
    const entry = this.entries[index];
    return entry ? { id: entry.id, kind: entry.kind } : null;
  }

  setSelectedIndex(index: number): void {
    const clamped = Math.max(0, Math.min(this.entries.length - 1, Math.round(index)));
    this.selectedIndex = clamped;
    this.ensureVisible();
  }

  resetInputEdges(): void {
    this.lastVertical = 0;
    this.lastConfirm = false;
  }

  getState() {
    return {
      selectedIndex: this.selectedIndex,
      selectedId: this.entries[this.selectedIndex]?.id ?? '',
      scrollOffset: this.scrollOffset,
      visibleRows: this.visibleRows,
      visibleEntries: this.entries.slice(this.scrollOffset, this.scrollOffset + this.visibleRows),
    };
  }

  private ensureVisible(): void {
    if (this.selectedIndex < this.scrollOffset) this.scrollOffset = this.selectedIndex;
    if (this.selectedIndex >= this.scrollOffset + this.visibleRows) {
      this.scrollOffset = this.selectedIndex - this.visibleRows + 1;
    }
    const maxOffset = Math.max(0, this.entries.length - this.visibleRows);
    this.scrollOffset = Math.max(0, Math.min(maxOffset, this.scrollOffset));
  }
}
