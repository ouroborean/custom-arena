// The battle animation canvases (vfx/): one over the board and one under the portraits. Mounting
// loads the animation data and starts fetching the sheets for the skills on the board.

import { useEffect, useRef } from 'react';
import type { PlayerView } from '@arena/engine';
import { loadVfx, preloadSheets } from '../vfx/data.js';
import { vfxReset } from '../vfx/player.js';
import { attachCanvases } from '../vfx/renderer.js';

export function VfxLayer({ view }: { view: PlayerView }) {
  const over = useRef<HTMLCanvasElement>(null);
  const under = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    attachCanvases(over.current, under.current);
    return () => {
      attachCanvases(null, null);
      vfxReset(true);
    };
  }, []);

  // The skills on the board: fetch their sheets before they're first used.
  const skills = [...new Set(view.units.flatMap((u) => u.skills.map((s) => s.defId)))].sort().join(',');
  useEffect(() => {
    let live = true;
    void loadVfx().then((d) => {
      if (!d || !live) return;
      preloadSheets(skills.split(',').flatMap((id) => (d.skills[id] ?? []).flatMap((c) => (c.k ? [c.k] : []))));
    });
    return () => {
      live = false;
    };
  }, [skills]);

  return (
    <>
      <canvas ref={under} className="vfx-canvas under" aria-hidden />
      <canvas ref={over} className="vfx-canvas over" aria-hidden />
    </>
  );
}
