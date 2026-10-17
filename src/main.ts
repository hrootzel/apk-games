import './styles.css';
import { GameApp } from './app/GameApp';
import type { VectorArcadeDebugWindow, VectorArcadeE2EBridge } from './app/debugTypes';

async function main(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app root');

  const arcade = new GameApp(root);
  await arcade.start();

  // Never expose controller injection in normal production/app operation.
  // The bridge exists only for the deterministic Playwright harness.
  if (new URLSearchParams(window.location.search).has('e2e')) {
    const debug: VectorArcadeE2EBridge = {
      snapshot: () => arcade.getDebugSnapshot(),
      input: {
        press: (button, pointerId = 9000) => arcade.debugSetButton(button, true, pointerId),
        release: (button, pointerId = 9000) => arcade.debugSetButton(button, false, pointerId),
        joystick: (x, y) => arcade.debugSetJoystick(x, y),
        reset: () => arcade.debugResetInput(),
      },
    };
    const debugWindow = window as VectorArcadeDebugWindow;
    debugWindow.__VECTOR_ARCADE_DEBUG__ = debug;
    debugWindow.__VECTOR_ASTEROIDS_DEBUG__ = debug;
  }
}

main().catch((error) => {
  console.error(error);
  document.body.innerHTML = `<pre style="color:#ff6688;background:#090909;padding:24px;white-space:pre-wrap">${String(error)}</pre>`;
});
