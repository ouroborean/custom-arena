// Screen-reader announcements for battle playback: new battle-log lines are read out through a
// polite live region as they play (the visible log is a scrolling panel, which isn't announced).

import { useStore } from '../store.js';

export function Announcer() {
  const lines = useStore((s) => s.logs[s.viewer]);
  // Only the latest few, so a reconnect or instant playback doesn't read a wall of text.
  const recent = lines.slice(-3);
  return (
    <div className="sr-only" role="log" aria-live="polite" aria-relevant="additions" aria-label="Battle events">
      {recent.map((l) => (
        <p key={l.id}>{l.text}</p>
      ))}
    </div>
  );
}
