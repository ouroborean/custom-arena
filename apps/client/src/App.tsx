import { useEffect } from 'react';
import { useMeta } from './meta.js';
import { useStore } from './store.js';
import { Account, Offline } from './ui/Account.js';
import { Battle } from './ui/Battle.js';
import { CharacterScreen } from './ui/CharacterScreen.js';
import { History } from './ui/History.js';
import { Home } from './ui/Home.js';
import { Setup } from './ui/Setup.js';
import { Story } from './ui/Story.js';
import { Settings } from './ui/Settings.js';
import { Tutorial } from './ui/Tutorial.js';

export function App() {
  const screen = useStore((s) => s.screen);
  const status = useMeta((s) => s.status);
  const init = useMeta((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  if (screen === 'battle') return <Battle />;
  if (screen === 'sandbox') return <Setup />;
  if (screen === 'settings') return <Settings />;
  if (status === 'loading') return <div className="meta-page muted">Connecting…</div>;
  if (status === 'offline') return <Offline />;
  if (status === 'signedOut') return <Account />;
  if (screen === 'character') return <CharacterScreen />;
  if (screen === 'history') return <History />;
  if (screen === 'story') return <Story />;
  if (screen === 'tutorial') return <Tutorial />;
  return <Home />;
}
