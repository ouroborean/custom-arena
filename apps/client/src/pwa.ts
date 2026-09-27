// Installing the app, and its service worker (docs/live-ops.md §6). The worker is registered in
// production builds only: in development Vite serves modules a cache would only get in the way of.

import { create } from 'zustand';

/** Chromium's install prompt (not in the DOM typings). */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  /** Set when the browser offers installation (Chromium browsers); null elsewhere and once used. */
  prompt: InstallPromptEvent | null;
  /** Running as an installed app. */
  installed: boolean;
}

function standalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches === true || (navigator as { standalone?: boolean }).standalone === true;
}

export const usePwa = create<PwaState>(() => ({ prompt: null, installed: standalone() }));

export function initPwa(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    usePwa.setState({ prompt: e as InstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => usePwa.setState({ prompt: null, installed: true }));
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err: unknown) => console.warn('Service worker registration failed', err));
    });
  }
}

/** Shows the browser's install prompt (from a click). */
export async function install(): Promise<void> {
  const p = usePwa.getState().prompt;
  if (!p) return;
  await p.prompt();
  const { outcome } = await p.userChoice;
  usePwa.setState({ prompt: null, installed: outcome === 'accepted' });
}
