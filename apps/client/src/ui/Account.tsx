// Sign in / register, plus the ways into the offline sandbox and the game reference.

import { useState, type FormEvent } from 'react';
import { useMeta } from '../meta.js';
import { useStore } from '../store.js';

export function Brand({ note }: { note?: string }) {
  return (
    <div className="hero">
      <h1>
        Custom <span>Arena</span>
      </h1>
      {note && <span className="hero-note">{note}</span>}
    </div>
  );
}

export function Account() {
  const [mode, setMode] = useState<'signIn' | 'register'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const { signIn, register, busy, error } = useMeta();
  const go = useStore((s) => s.go);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'signIn') void signIn(email, password);
    else void register(email, password, displayName);
  };

  return (
    <div className="meta-page">
      <Brand note="3v3 turn-based arena" />
      <form className="panel account-form" onSubmit={submit} aria-label={mode === 'signIn' ? 'Sign in' : 'Create account'}>
        <div className="segmented" role="group" aria-label="Account">
          <button type="button" aria-pressed={mode === 'signIn'} onClick={() => setMode('signIn')}>
            Sign in
          </button>
          <button type="button" aria-pressed={mode === 'register'} onClick={() => setMode('register')}>
            Create account
          </button>
        </div>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode === 'register' && (
          <label className="field">
            <span>Display name</span>
            <input type="text" maxLength={24} required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
        )}
        <label className="field">
          <span>Password {mode === 'register' && <em>(8+ characters)</em>}</span>
          <input
            type="password"
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn primary" disabled={busy}>
          {mode === 'signIn' ? 'Sign in' : 'Create account'}
        </button>
        {mode === 'register' && <p className="muted small-note">New accounts start with three characters and a few items.</p>}
      </form>
      <div className="row-actions">
        <button type="button" className="btn" onClick={() => go('sandbox')}>
          Play offline sandbox
        </button>
        <button type="button" className="btn" onClick={() => go('reference')}>
          Game reference
        </button>
      </div>
    </div>
  );
}

export function Offline() {
  const go = useStore((s) => s.go);
  const init = useMeta((s) => s.init);
  return (
    <div className="meta-page">
      <Brand />
      <section className="panel account-form">
        <h2>Server offline</h2>
        <p className="muted">
          {import.meta.env.DEV ? (
            <>
              The roster and equipment need the API server. Start it with <code>npm run server</code>, or play the sandbox
              with generated teams.
            </>
          ) : (
            "Can't reach the server. Your roster, the story and online play need it; the sandbox works offline with generated teams."
          )}
        </p>
        <div className="row-actions">
          <button type="button" className="btn" onClick={() => void init()}>
            Retry
          </button>
          <button type="button" className="btn primary" onClick={() => go('sandbox')}>
            Offline sandbox
          </button>
          <button type="button" className="btn" onClick={() => go('reference')}>
            Game reference
          </button>
        </div>
      </section>
    </div>
  );
}
