import './styles.css';
import { GameApp } from './app/GameApp';

declare global {
  interface Window {
    __VECTOR_ASTEROIDS_DEBUG__?: {
      snapshot: () => ReturnType<GameApp['getDebugSnapshot']>;
    };
  }
}

async function main(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app root');

  const game = new GameApp(root);
  await game.start();

  if (new URLSearchParams(window.location.search).has('e2e')) {
    window.__VECTOR_ASTEROIDS_DEBUG__ = {
      snapshot: () => game.getDebugSnapshot(),
    };
  }
}

main().catch((error) => {
  console.error(error);
  document.body.innerHTML = `<pre style="color:#ff6688;background:#090909;padding:24px;white-space:pre-wrap">${String(error)}</pre>`;
});
