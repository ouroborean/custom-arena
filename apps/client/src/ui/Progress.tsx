// The experience bar (docs/equipment.md §4.1): the player's level, a bar with a bubble at each loot-box
// milestone, and the dialog that opens the boxes it paid.

import { useState } from 'react';
import { describePiece } from '@arena/engine';
import type { LootRoll } from '../api.js';
import { content } from '../content.js';
import { useT } from '../i18n/index.js';
import { useMeta } from '../meta.js';
import { ItemFace, Tooltip } from './common.js';

const boxName = (box: string) => content.economy.lootBoxes?.[box]?.name ?? box;

/** Level, bar and bubbles, with the button that opens loot boxes. */
export function XpBar() {
  const t = useT();
  const progress = useMeta((s) => s.progress);
  const [opening, setOpening] = useState(false);
  const milestones = content.economy.progression?.milestones ?? [];
  if (!progress || !content.economy.progression) return null;
  const pct = Math.min(100, (100 * progress.xp) / progress.needed);
  const count = progress.boxes.length;

  return (
    <section className="panel xp-panel" aria-label={t('progress.label')} data-guide="xp">
      <div className="xp-level">
        <span className="xp-level-n">{progress.level}</span>
        <span className="panel-title">{t('progress.level', { level: progress.level })}</span>
      </div>
      <div className="xp-track-wrap">
        <div
          className="xp-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.needed}
          aria-valuenow={progress.xp}
          aria-valuetext={t('progress.xp', { xp: progress.xp, needed: progress.needed })}
        >
          <div className="xp-fill" style={{ width: `${pct}%` }} />
          {milestones.map((m) => {
            const earned = pct >= m.at;
            const label = t(earned ? 'progress.bubbleEarned' : 'progress.bubble', { box: boxName(m.box), at: m.at });
            return (
              <span key={m.at} className={`xp-bubble box-${m.box}${earned ? ' earned' : ''}`} style={{ left: `${m.at}%` }}>
                <Tooltip content={label}>
                  <span className="xp-bubble-dot" aria-label={label} />
                </Tooltip>
              </span>
            );
          })}
        </div>
        <span className="xp-numbers muted">{t('progress.xp', { xp: progress.xp, needed: progress.needed })}</span>
      </div>
      <button type="button" className={`btn${count ? ' primary' : ''}`} disabled={!count} onClick={() => setOpening(true)} title={count ? undefined : t('progress.noBoxes')}>
        {t('progress.boxes', { count })}
      </button>
      {opening && <LootBoxDialog onClose={() => setOpening(false)} />}
    </section>
  );
}

/** Opens the player's boxes one at a time and shows each one's three rolls, lowest first. */
function LootBoxDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const progress = useMeta((s) => s.progress);
  const openLootBox = useMeta((s) => s.openLootBox);
  const busy = useMeta((s) => s.busy);
  const error = useMeta((s) => s.error);
  const [opened, setOpened] = useState<{ key: number; box: string; rolls: LootRoll[] } | null>(null);
  const boxes = progress?.boxes ?? [];
  const next = boxes[0];

  const open = async () => {
    if (!next) return;
    const r = await openLootBox(next.id);
    if (r) setOpened({ key: Date.now(), ...r });
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="lootbox-title">
      <div className="dialog lootbox-dialog">
        <h2 id="lootbox-title">{t('progress.title')}</h2>
        {opened ? (
          <div className={`lootbox-opened box-${opened.box}`} key={opened.key}>
            <div className="lootbox-name">{boxName(opened.box)}</div>
            <div className="lootbox-rolls">
              {opened.rolls.map((r, i) => (
                <RollCard key={i} roll={r} index={i} />
              ))}
            </div>
          </div>
        ) : (
          next && (
            <div className={`lootbox-closed box-${next.box}`}>
              <div className="lootbox-crate" aria-hidden="true" />
              <div className="lootbox-name">{boxName(next.box)}</div>
              <div className="muted">{t('progress.from', { level: next.level, at: next.at })}</div>
            </div>
          )
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="muted">{t('progress.left', { count: boxes.length })}</span>
          <span style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn" onClick={onClose}>
              {t('progress.close')}
            </button>
            {next && (
              <button type="button" className="btn primary" autoFocus disabled={busy} onClick={() => void open()}>
                {busy ? t('progress.opening') : opened ? t('progress.openNext') : t('progress.open')}
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

/** One roll: gold, or a piece of gear with its tier (its component count). */
function RollCard({ roll, index }: { roll: LootRoll; index: number }) {
  const t = useT();
  const delay = { animationDelay: `${index * 350}ms` };
  if (roll.kind === 'gold') {
    return (
      <div className="loot-roll gold" style={delay}>
        <div className="loot-roll-coin" aria-hidden="true" />
        <b>{t('progress.gold', { amount: roll.currency.gold ?? 0 })}</b>
      </div>
    );
  }
  const piece = describePiece(content, roll.item);
  return (
    <div className={`loot-roll tier-${roll.tier}`} style={delay}>
      <span className="loot-roll-tier">{t('progress.tier', { tier: roll.tier })}</span>
      {piece && <ItemFace def={piece} content={content} />}
      <b>{piece?.name ?? roll.item}</b>
    </div>
  );
}
