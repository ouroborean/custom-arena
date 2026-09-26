import { useStore } from './store.js';
import { Battle } from './ui/Battle.js';
import { Setup } from './ui/Setup.js';

export function App() {
  const screen = useStore((s) => s.screen);
  return screen === 'setup' ? <Setup /> : <Battle />;
}
