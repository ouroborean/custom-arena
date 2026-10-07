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
import { GuideCoach } from './ui/GuideCoach.js';
import { KeywordHelp } from './ui/KeywordHelp.js';
import { ReferenceScreen } from './ui/Reference.js';
import { isReferenceHash } from './reference/route.js';

export function App() {
  const screen = useStore((s) => s.screen);
  const status = useMeta((s) => s.status);
  const init = useMeta((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  // A reference link (#reference/…) opens the game reference: on Home's Reference tab when signed in,
  // else on its own screen. A match in progress isn't left for one.
  useEffect(() => {
    const open = () => {
      const s = useStore.getState();
      if (!isReferenceHash(location.hash) || s.screen === 'battle') return;
      if (useMeta.getState().status === 'signedIn') {
        s.setHomeTab('reference');
        s.go('home');
      } else s.go('reference');
    };
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, []);
  useEffect(() => {
    if (status !== 'signedIn' || screen !== 'reference') return;
    const s = useStore.getState();
    s.setHomeTab('reference');
    s.go('home');
  }, [status, screen]);

  return (
    <>
      <Page screen={screen} status={status} />
      {status === 'signedIn' && <GuideCoach />}
      <KeywordHelp />
    </>
  );
}

function Page({ screen, status }: { screen: ReturnType<typeof useStore.getState>['screen']; status: ReturnType<typeof useMeta.getState>['status'] }) {
  if (screen === 'battle') return <Battle />;
  if (screen === 'sandbox') return <Setup />;
  if (screen === 'settings') return <Settings />;
  if (screen === 'reference') return <ReferenceScreen />;
  if (status === 'loading') return <div className="meta-page muted">Connecting…</div>;
  if (status === 'offline') return <Offline />;
  if (status === 'signedOut') return <Account />;
  if (screen === 'character') return <CharacterScreen />;
  if (screen === 'history') return <History />;
  if (screen === 'story') return <Story />;
  if (screen === 'tutorial') return <Tutorial />;
  return <Home />;
}
