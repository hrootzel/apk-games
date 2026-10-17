import { describe, expect, it } from 'vitest';
import { MenuController, type MenuEntry } from '../../src/app/MenuController';
import { input } from './helpers';

function entries(count = 7): MenuEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index === count - 1 ? 'configuration' : `game-${index}`,
    title: index === count - 1 ? 'CONFIGURATION' : `GAME ${index}`,
    kind: index === count - 1 ? 'configuration' : 'game',
  }));
}

describe('MenuController', () => {
  it('requires at least one entry', () => {
    expect(() => new MenuController([])).toThrow(/at least one entry/);
  });

  it('moves one row per joystick deflection edge and wraps both directions', () => {
    const menu = new MenuController(entries(3), 2);
    menu.update(input({}, { x: 0, y: 1 }));
    expect(menu.getState().selectedIndex).toBe(1);
    menu.update(input({}, { x: 0, y: 1 }));
    expect(menu.getState().selectedIndex).toBe(1);
    menu.update(input());
    menu.update(input({}, { x: 0, y: 1 }));
    expect(menu.getState().selectedIndex).toBe(2);
    menu.update(input());
    menu.update(input({}, { x: 0, y: 1 }));
    expect(menu.getState().selectedIndex).toBe(0);
    menu.update(input());
    menu.update(input({}, { x: 0, y: -1 }));
    expect(menu.getState().selectedIndex).toBe(2);
  });

  it('confirms using A or Start only on the press edge', () => {
    const menu = new MenuController(entries(2));
    expect(menu.update(input({ a: true }))).toEqual({ id: 'game-0', kind: 'game' });
    expect(menu.update(input({ a: true }))).toBeNull();
    menu.update(input({ a: false }));
    expect(menu.update(input({ start: true }))).toEqual({ id: 'game-0', kind: 'game' });
  });

  it('keeps selection within a scrolling viewport', () => {
    const menu = new MenuController(entries(8), 3);
    menu.setSelectedIndex(5);
    const state = menu.getState();
    expect(state.selectedIndex).toBe(5);
    expect(state.scrollOffset).toBe(3);
    expect(state.visibleEntries.map((entry) => entry.id)).toEqual(['game-3', 'game-4', 'game-5']);

    menu.setSelectedIndex(0);
    expect(menu.getState().scrollOffset).toBe(0);
  });

  it('supports direct selection by id and safely rejects unknown ids', () => {
    const menu = new MenuController(entries(4));
    expect(menu.selectById('configuration')).toEqual({ id: 'configuration', kind: 'configuration' });
    expect(menu.getState().selectedId).toBe('configuration');
    expect(menu.selectById('missing')).toBeNull();
    expect(menu.getState().selectedId).toBe('configuration');
  });

  it('can reset held input edges when the shell changes modes', () => {
    const menu = new MenuController(entries(2));
    expect(menu.update(input({ a: true }))).toEqual({ id: 'game-0', kind: 'game' });
    menu.resetInputEdges();
    expect(menu.update(input({ a: true }))).toEqual({ id: 'game-0', kind: 'game' });

    menu.update(input({}, { x: 0, y: 1 }));
    expect(menu.getState().selectedIndex).toBe(1);
    menu.resetInputEdges();
    menu.update(input({}, { x: 0, y: 1 }));
    expect(menu.getState().selectedIndex).toBe(0);
  });


  it('can prime held edges so a Start+Select return does not immediately confirm the menu', () => {
    const menu = new MenuController(entries(3));
    const heldChord = input({ start: true, select: true });

    menu.primeInputEdges(heldChord);
    expect(menu.update(heldChord)).toBeNull();
    expect(menu.getState().selectedIndex).toBe(0);

    // A held navigation direction is suppressed too until it returns neutral.
    const heldDown = input({ start: false, select: false }, { x: 0, y: 1 });
    menu.primeInputEdges(heldDown);
    expect(menu.update(heldDown)).toBeNull();
    expect(menu.getState().selectedIndex).toBe(0);

    menu.update(input());
    expect(menu.update(input({ start: true }))).toEqual({ id: 'game-0', kind: 'game' });
  });

  it('clamps externally requested selected indices', () => {
    const menu = new MenuController(entries(3));
    menu.setSelectedIndex(99);
    expect(menu.getState().selectedIndex).toBe(2);
    menu.setSelectedIndex(-5);
    expect(menu.getState().selectedIndex).toBe(0);
  });
});
