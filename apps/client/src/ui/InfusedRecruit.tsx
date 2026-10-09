// The Infused Recruit picker (decided 2026-10-09): choose an element and a class, read what each is
// about, and recruit a character of that pair already equipped (meta `infusedRecruitKit`): a forged
// class skill with a shard of the element, another class skill item, and two shards, every infusion
// placed.

import { useState } from 'react';
import { rollableClasses, rollableElements } from '@arena/meta';
import { content } from '../content.js';
import { useT } from '../i18n/index.js';
import { useMeta } from '../meta.js';
import { CLASS_PROSE, ELEMENT_FLAVOR, ELEMENT_PROSE } from '../reference/prose.js';
import { elementClass } from './common.js';
import { Portrait } from './Roster.js';

type El = keyof typeof ELEMENT_PROSE;

export function InfusedRecruitDialog({ onClose, onRecruited }: { onClose: () => void; onRecruited: (id: string) => void }) {
  const t = useT();
  const { infusedRecruits, busy, recruitInfused, characters, maxRoster } = useMeta();
  const elements = rollableElements(content);
  const classes = rollableClasses(content);
  const [element, setElement] = useState<string>(elements[0]!);
  const [classId, setClassId] = useState<string>(classes[0]!.id);
  const cls = content.classes[classId]!;
  const pool = [...cls.signatures, ...cls.affinity];
  const skillName = (base: string) => content.skills[base]?.name ?? base;
  const full = characters.length >= maxRoster;

  const recruit = async () => {
    const c = await recruitInfused(classId, element);
    if (c) onRecruited(c.id);
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="infused-title" onClick={onClose}>
      <div className="dialog infused-dialog" onClick={(e) => e.stopPropagation()}>
        <h2 id="infused-title">{t('infused.title')}</h2>
        <p className="muted">{t('infused.lead', { count: infusedRecruits })}</p>

        <div className="infused-body">
          <div className="infused-pick">
            <h3>{t('infused.element')}</h3>
            <div className="infused-options" role="radiogroup" aria-label={t('infused.element')}>
              {elements.map((el) => (
                <button
                  key={el}
                  type="button"
                  role="radio"
                  aria-checked={el === element}
                  className={`infused-option ${elementClass(el)}${el === element ? ' on' : ''}`}
                  onClick={() => setElement(el)}
                >
                  <span className="infused-swatch" aria-hidden />
                  {el}
                </button>
              ))}
            </div>
            <h3>{t('infused.class')}</h3>
            <div className="infused-options" role="radiogroup" aria-label={t('infused.class')}>
              {classes.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={c.id === classId}
                  className={`infused-option${c.id === classId ? ' on' : ''}`}
                  onClick={() => setClassId(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="infused-summary" aria-live="polite">
            <div className="infused-hero">
              <Portrait c={{ classId, element }} size={84} />
              <div>
                <div className="infused-name">
                  {element} {cls.name}
                </div>
                <div className="muted">{t('infused.kit', { element })}</div>
              </div>
            </div>

            <section className={`infused-block ${elementClass(element)}`}>
              <h4>{element}</h4>
              <p className="infused-flavor">{ELEMENT_FLAVOR[element as El]}</p>
              <p>{ELEMENT_PROSE[element as El]?.tagline}</p>
              <p className="muted">{ELEMENT_PROSE[element as El]?.themes}</p>
            </section>

            <section className="infused-block">
              <h4>{cls.name}</h4>
              <p className="infused-flavor">{CLASS_PROSE[classId]?.flavor}</p>
              <p>{CLASS_PROSE[classId]?.play}</p>
              <p className="muted">
                {t('infused.skills', {
                  starter: skillName(cls.starter ?? pool[0]!),
                  others: pool.filter((b) => b !== cls.starter).map(skillName).join(', '),
                })}
              </p>
            </section>
          </div>
        </div>

        {full && <p className="muted">{t('infused.full')}</p>}
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn primary" disabled={busy || full || infusedRecruits <= 0} onClick={() => void recruit()}>
            {t('infused.confirm', { name: `${element} ${cls.name}` })}
          </button>
        </div>
      </div>
    </div>
  );
}
