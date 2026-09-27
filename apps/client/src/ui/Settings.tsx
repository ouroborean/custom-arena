// Settings (GDD §9.1): per-device preferences — motion, battle speed, sound and language.

import { useSettings, type MotionPref } from '../settings.js';
import { playCue } from '../sfx.js';
import { useStore } from '../store.js';
import { Brand } from './Account.js';

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="control">
      <span className="label">{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.value)} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Settings() {
  const go = useStore((s) => s.go);
  const s = useSettings();
  return (
    <div className="meta-page">
      <div className="meta-header">
        <Brand />
        <button type="button" className="btn small" onClick={() => go('home')}>
          Home
        </button>
      </div>
      <h1 className="page-title">Settings</h1>
      <section className="panel settings" aria-label="Settings">
        <Segmented<MotionPref>
          label="Motion"
          value={s.motion}
          options={[
            { value: 'system', label: 'Like my device' },
            { value: 'reduce', label: 'Reduced' },
            { value: 'full', label: 'Full' },
          ]}
          onChange={(motion) => s.update({ motion })}
        />
        <Segmented<0 | 1 | 2>
          label="Battle playback"
          value={s.speed}
          options={[
            { value: 1, label: '1×' },
            { value: 2, label: '2×' },
            { value: 0, label: 'Instant' },
          ]}
          onChange={(speed) => s.update({ speed })}
        />
        <div className="control">
          <label htmlFor="settings-volume" className="label">
            Sound effects
          </label>
          <div className="volume">
            <input
              id="settings-volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.volume}
              disabled={s.muted}
              onChange={(e) => s.update({ volume: Number(e.target.value) })}
            />
            <span className="muted">{Math.round(s.volume * 100)}%</span>
            <button type="button" className="btn small" aria-pressed={s.muted} onClick={() => s.update({ muted: !s.muted })}>
              {s.muted ? 'Unmute' : 'Mute'}
            </button>
            <button type="button" className="btn small" disabled={s.muted} onClick={() => playCue('victory')}>
              Test
            </button>
          </div>
        </div>
        <p className="muted">
          Energy colors always have their own shapes (Strength ■, Agility ▲, Intelligence ◆, Wisdom ⬢, random ▢), so they never depend on
          telling colors apart. Settings are saved on this device.
        </p>
        <button type="button" className="btn small" onClick={() => s.reset()}>
          Reset to defaults
        </button>
      </section>
    </div>
  );
}
