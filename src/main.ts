import './styles.css';
import { GameApp } from './app/GameApp';

declare global {
  interface Window {
    __VECTOR_ARCADE_DEBUG__?: {
      snapshot: () => ReturnType<GameApp['getDebugSnapshot']>;
    };
    /** Compatibility alias retained for older local test scripts. */
    __VECTOR_ASTEROIDS_DEBUG__?: {
      snapshot: () => ReturnType<GameApp['getDebugSnapshot']>;
    };
  }
}

async function main(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app root');

  const arcade = new GameApp(root);
  await arcade.start();

  if (new URLSearchParams(window.location.search).has('e2e')) {
    const debug = { snapshot: () => arcade.getDebugSnapshot() };
    window.__VECTOR_ARCADE_DEBUG__ = debug;
    window.__VECTOR_ASTEROIDS_DEBUG__ = debug;
  }
}

main().catch((error) => {
  console.error(error);
  document.body.innerHTML = `<pre style="color:#ff6688;background:#090909;padding:24px;white-space:pre-wrap">${String(error)}</pre>`;
});
