import { useState } from 'react';
import { availableElements, randomCharacter, randomConfig } from '@arena/ai';
import { seedRng, type CharacterSpec, type MatchConfig } from '@arena/engine';
import { content } from '../content.js';
import type { BotKind, MatchMode } from '../match/LocalMatch.js';
import { useStore } from '../store.js';
import { portraitKey } from '../assets.js';
import { classCode, CostPips, elementClass, PortraitArt, portraitStyle, SkillGlyph, Tooltip } from './common.js';
import { RulesText } from './RulesText.js';

const ELEMENTS = availableElements(content);

type ModeKind = MatchMode['kind'];

function newSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}

function CharacterEditor({
  spec,
  onChange,
  onReroll,
}: {
  spec: CharacterSpec;
  onChange: (c: CharacterSpec) => void;
  onReroll: (classId?: string, element?: string) => void;
}) {
  return (
    <div className="char-editor">
      <div className={`portrait ${elementClass(spec.element)}`} style={portraitStyle(spec.classId ?? '')} aria-hidden>
        <PortraitArt artKey={portraitKey({ classId: spec.classId ?? '', element: spec.element ?? 'None' })} />
        <span className="mono">{classCode(spec.classId ?? '')}</span>
      </div>
      <div className="body">
        <div className="top">
          <input type="text" aria-label="Character name" value={spec.name} onChange={(e) => onChange({ ...spec, name: e.target.value })} />
          <select aria-label="Class" value={spec.classId} onChange={(e) => onReroll(e.target.value, spec.element)}>
            {Object.values(content.classes).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select aria-label="Element" value={spec.element} onChange={(e) => onReroll(spec.classId, e.target.value)}>
            {ELEMENTS.map((el) => (
              <option key={el} value={el}>
                {el}
              </option>
            ))}
          </select>
          <button type="button" className="btn small" onClick={() => onReroll()} aria-label="Randomize character">
            ⟳
          </button>
        </div>
        <div className="skill-list" aria-label={`${spec.name} skills`}>
          {spec.skills.map((id) => {
            const d = content.skills[id]!;
            return (
              <Tooltip
                key={id}
                content={
                  <>
                    <h4>{d.name}</h4>
                    <div><RulesText text={d.description} /></div>
                    <div className="row">
                      <CostPips cost={d.cost} /> · cooldown {d.cooldown}
                    </div>
                  </>
                }
              >
                <span className={`skill-chip ${elementClass(d.element)}`} tabIndex={0}>
                  <SkillGlyph def={d} content={content} />
                  {d.name}
                  <CostPips cost={d.cost} />
                </span>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function Setup() {
  const newMatch = useStore((s) => s.newMatch);
  const go = useStore((s) => s.go);
  const [seed, setSeed] = useState(newSeed);
  const [config, setConfig] = useState<MatchConfig>(() => randomConfig(content, seed));
  const [mode, setMode] = useState<ModeKind>('vsBot');
  const [bot, setBot] = useState<BotKind>('normal');
  const [human, setHuman] = useState<0 | 1>(0);

  const reroll = () => {
    const s = newSeed();
    setSeed(s);
    setConfig(randomConfig(content, s));
  };

  const updateChar = (p: 0 | 1, i: number, c: CharacterSpec) => {
    const teams = [config.teams[0].slice(), config.teams[1].slice()] as MatchConfig['teams'];
    teams[p][i] = c;
    setConfig({ ...config, teams });
  };

  /** New random skills and infusions, keeping the class and/or element when given. */
  const rerollChar = (p: 0 | 1, i: number, classId?: string, element?: string) => {
    const c = randomCharacter(content, seedRng(newSeed()), '', classId, element);
    const name = `${p === 0 ? 'Blue' : 'Red'} ${content.classes[c.classId!]!.name} ${i + 1}`;
    updateChar(p, i, { ...c, name });
  };

  const start = () => {
    const m: MatchMode =
      mode === 'vsBot' ? { kind: 'vsBot', bot, human } : mode === 'hotseat' ? { kind: 'hotseat' } : { kind: 'watch', bots: [bot, bot] };
    newMatch(content, { ...config, seed }, m);
  };

  const sideName = (p: 0 | 1) =>
    mode === 'vsBot' ? (p === human ? 'Your team' : 'Bot team') : mode === 'hotseat' ? `Player ${p + 1}` : `Bot ${p + 1}`;

  return (
    <div className="setup">
      <div className="hero">
        <h1>
          Custom <span>Arena</span>
        </h1>
        <span className="muted" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 12, fontWeight: 700 }}>
          Sandbox · {Object.keys(content.skills).length} skills · content {content.version.slice(0, 8)}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn" onClick={() => go('home')}>
          ← Home
        </button>
      </div>

      <section className="panel setup-controls" aria-label="Match options">
        <div className="control">
          <span className="label">Mode</span>
          <div className="segmented" role="group" aria-label="Mode">
            {(
              [
                ['vsBot', 'vs Bot'],
                ['hotseat', 'Hotseat'],
                ['watch', 'Watch bots'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {mode !== 'hotseat' && (
          <div className="control">
            <label htmlFor="bot">Bot</label>
            <select id="bot" value={bot} onChange={(e) => setBot(e.target.value as BotKind)}>
              <option value="easy">Easy</option>
              <option value="normal">Normal</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        )}
        {mode === 'vsBot' && (
          <div className="control">
            <span className="label">You play</span>
            <div className="segmented" role="group" aria-label="Turn order">
              <button type="button" aria-pressed={human === 0} onClick={() => setHuman(0)}>
                First
              </button>
              <button type="button" aria-pressed={human === 1} onClick={() => setHuman(1)}>
                Second
              </button>
            </div>
          </div>
        )}
        <div className="control">
          <label htmlFor="seed">Seed</label>
          <input
            id="seed"
            type="number"
            value={seed}
            style={{ width: 120 }}
            onChange={(e) => {
              const s = Number(e.target.value) || 0;
              setSeed(s);
              setConfig(randomConfig(content, s));
            }}
          />
        </div>
        <button type="button" className="btn" onClick={reroll}>
          Random teams
        </button>
        <span style={{ flex: 1 }} />
        <button type="button" className="end-turn-btn" onClick={start}>
          Start match
        </button>
      </section>

      <div className="teams">
        {([0, 1] as const).map((p) => (
          <section className="team-editor" key={p} aria-label={sideName(p)}>
            <div className="side-label">
              <span>{sideName(p)}</span>
            </div>
            {config.teams[p].map((c, i) => (
              <CharacterEditor key={i} spec={c} onChange={(n) => updateChar(p, i, n)} onReroll={(classId, element) => rerollChar(p, i, classId, element)} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
