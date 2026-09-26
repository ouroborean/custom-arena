import { useEffect } from 'react';
import { useMeta } from './meta.js';
import { useStore } from './store.js';
import { Account, Offline } from './ui/Account.js';
import { Battle } from './ui/Battle.js';
import { CharacterScreen } from './ui/CharacterScreen.js';
import { Home } from './ui/Home.js';
import { Setup } from './ui/Setup.js';

export function App() {
  const screen = useStore((s) => s.screen);
  const status = useMeta((s) => s.status);
  const init = useMeta((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  if (screen === 'battle') return <Battle />;
  if (screen === 'sandbox') return <Setup />;
  if (status === 'loading') return <div className="meta-page muted">Connecting…</div>;
  if (status === 'offline') return <Offline />;
  if (status === 'signedOut') return <Account />;
  if (screen === 'character') return <CharacterScreen />;
  return <Home />;
}
