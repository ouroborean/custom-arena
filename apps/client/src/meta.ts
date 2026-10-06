// Account, roster and inventory state (the out-of-battle "meta" game), backed by the API server.

import { create } from 'zustand';
import { api, ApiError, type Character, type InventoryItem, type LootRoll, type Progress, type User, type Wallet } from './api.js';
import { content } from './content.js';
import { useGuide } from './guides.js';
import { online } from './match/online.js';

export type MetaStatus = 'loading' | 'signedOut' | 'signedIn' | 'offline';

interface MetaState {
  status: MetaStatus;
  user: User | null;
  characters: Character[];
  maxRoster: number;
  team: string[];
  inventory: InventoryItem[];
  wallet: Wallet;
  /** Level, experience bar and unopened loot boxes (null until loaded). */
  progress: Progress | null;
  /** Set when the server runs different content than this client build. */
  contentMismatch: string | null;
  busy: boolean;
  error: string | null;

  init(): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  register(email: string, password: string, displayName: string): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
  roll(): Promise<Character | null>;
  setTeam(ids: string[]): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  retire(id: string): Promise<void>;
  /** Forges the `addition` instance onto the `base` one (both unequipped); returns the new piece. */
  forge(base: string, addition: string): Promise<InventoryItem | null>;
  /** Splits a forged (unequipped) instance into its components. */
  split(id: string): Promise<InventoryItem[] | null>;
  salvage(id: string): Promise<void>;
  /** Trades in single components (economy `tradeIn`) for one random other; the new piece, or null. */
  tradeIn(ids: string[]): Promise<InventoryItem | null>;
  /** Opens a loot box; its gold and gear are paid at once. Null if it failed. */
  openLootBox(id: string): Promise<{ box: string; rolls: LootRoll[] } | null>;
  clearError(): void;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const useMeta = create<MetaState>((set, get) => {
  /** Runs an action with the busy flag and error capture; returns its result or null. */
  async function act<T>(fn: () => Promise<T>): Promise<T | null> {
    set({ busy: true, error: null });
    try {
      return await fn();
    } catch (e) {
      set({ error: message(e) });
      return null;
    } finally {
      set({ busy: false });
    }
  }

  return {
    status: 'loading',
    user: null,
    characters: [],
    maxRoster: 0,
    team: [],
    inventory: [],
    wallet: {},
    progress: null,
    contentMismatch: null,
    busy: false,
    error: null,

    async init() {
      try {
        const health = await api.health();
        set({ contentMismatch: health.content === content.version ? null : health.content });
      } catch {
        return set({ status: 'offline' });
      }
      try {
        const { user } = await api.me();
        set({ user, status: 'signedIn' });
        await get().refresh();
      } catch (e) {
        set({ status: e instanceof ApiError && e.status === 401 ? 'signedOut' : 'offline' });
      }
    },

    async signIn(email, password) {
      const r = await act(() => api.login(email, password));
      if (r) {
        set({ user: r.user, status: 'signedIn' });
        await get().refresh();
      }
    },

    async register(email, password, displayName) {
      const r = await act(() => api.register(email, password, displayName));
      if (r) {
        set({ user: r.user, status: 'signedIn' });
        await get().refresh();
      }
    },

    async signOut() {
      online.disconnect();
      await act(() => api.logout());
      useGuide.getState().load([]);
      useGuide.getState().stop();
      set({ user: null, status: 'signedOut', characters: [], team: [], inventory: [], wallet: {}, progress: null });
    },

    async refresh() {
      await act(async () => {
        const [chars, team, inv, progress, guides] = await Promise.all([api.characters(), api.activeTeam(), api.inventory(), api.progress(), api.guides()]);
        useGuide.getState().load(guides.done);
        set({
          progress,
          characters: chars.characters,
          maxRoster: chars.maxRoster,
          team: team.team?.characterIds ?? [],
          inventory: inv.items,
          wallet: inv.wallet,
        });
      });
    },

    async roll() {
      const r = await act(() => api.roll());
      if (!r) return null;
      set({ characters: [...get().characters, r.character], wallet: r.wallet });
      // The first three recruits become the active team on the server.
      if (get().team.length < 3) {
        const team = await act(() => api.activeTeam());
        if (team) set({ team: team.team?.characterIds ?? [] });
      }
      return r.character;
    },

    async setTeam(ids) {
      const r = await act(() => api.setActiveTeam(ids));
      if (r) set({ team: r.team.characterIds });
    },

    async rename(id, name) {
      const r = await act(() => api.rename(id, name));
      if (r) set({ characters: get().characters.map((c) => (c.id === id ? r.character : c)) });
    },

    async retire(id) {
      const ok = await act(async () => {
        await api.retire(id);
        return true;
      });
      if (ok) await get().refresh();
    },

    async forge(base, addition) {
      const r = await act(() => api.forge(base, addition));
      if (!r) return null;
      set({ inventory: [...get().inventory.filter((i) => i.id !== base && i.id !== addition), r.item], wallet: r.wallet });
      return r.item;
    },

    async split(id) {
      const r = await act(() => api.split(id));
      if (!r) return null;
      set({ inventory: [...get().inventory.filter((i) => i.id !== id), ...r.items], wallet: r.wallet });
      return r.items;
    },

    async salvage(id) {
      const r = await act(() => api.salvage(id));
      if (r) set({ inventory: get().inventory.filter((i) => i.id !== id), wallet: r.wallet });
    },

    async tradeIn(ids) {
      const r = await act(() => api.tradeIn(ids));
      if (!r) return null;
      set({ inventory: [...get().inventory.filter((i) => !ids.includes(i.id)), r.item], wallet: r.wallet });
      return r.item;
    },

    async openLootBox(id) {
      const r = await act(async () => {
        const opened = await api.openLootBox(id);
        // Its gear went straight into the inventory.
        const inv = await api.inventory();
        set({ wallet: opened.wallet, progress: opened.progress, inventory: inv.items });
        return opened;
      });
      return r && { box: r.box, rolls: r.rolls };
    },

    clearError() {
      set({ error: null });
    },
  };
});
