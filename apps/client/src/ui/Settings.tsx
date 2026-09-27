// Settings (GDD §9.1): per-device preferences — motion, battle speed, sound and language.

import { CATALOGS, useT } from '../i18n/index.js';
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
  const t = useT();
  const go = useStore((s) => s.go);
  const s = useSettings();
  return (
    <div className="meta-page">
      <div className="meta-header">
        <Brand />
        <button type="button" className="btn small" onClick={() => go('home')}>
          {t('common.home')}
        </button>
      </div>
      <h1 className="page-title">{t('settings.title')}</h1>
      <section className="panel settings" aria-label={t('settings.title')}>
        <Segmented<MotionPref>
          label={t('settings.motion')}
          value={s.motion}
          options={[
            { value: 'system', label: t('settings.motion.system') },
            { value: 'reduce', label: t('settings.motion.reduce') },
            { value: 'full', label: t('settings.motion.full') },
          ]}
          onChange={(motion) => s.update({ motion })}
        />
        <Segmented<0 | 1 | 2>
          label={t('settings.speed')}
          value={s.speed}
          options={[
            { value: 1, label: '1×' },
            { value: 2, label: '2×' },
            { value: 0, label: t('settings.speed.instant') },
          ]}
          onChange={(speed) => s.update({ speed })}
        />
        <div className="control">
          <label htmlFor="settings-volume" className="label">
            {t('settings.sound')}
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
              {s.muted ? t('settings.unmute') : t('settings.mute')}
            </button>
            <button type="button" className="btn small" disabled={s.muted} onClick={() => playCue('victory')}>
              {t('settings.test')}
            </button>
          </div>
        </div>
        <div className="control">
          <label htmlFor="settings-language" className="label">
            {t('settings.language')}
          </label>
          <select id="settings-language" value={s.locale} onChange={(e) => s.update({ locale: e.target.value })}>
            <option value="auto">{t('settings.language.auto')}</option>
            {Object.entries(CATALOGS).map(([tag, c]) => (
              <option key={tag} value={tag}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <p className="muted">{t('settings.shapesNote')}</p>
        <button type="button" className="btn small" onClick={() => s.reset()}>
          {t('settings.reset')}
        </button>
      </section>
    </div>
  );
}
