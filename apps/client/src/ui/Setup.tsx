import { useState } from 'react';
import { randomCharacter, randomConfig } from '@arena/ai';
import { seedRng, type CharacterSpec, type MatchConfig } from '@arena/engine';
import { content } from '../content.js';
import type { BotKind, MatchMode } from '../match/LocalMatch.js';
import { useStore } from '../store.js';
import { classCode, CostPips, portraitStyle, Tooltip } from './common.js';

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
  onReroll: (classId?: string) => void;
}) {
  return (
    <div className="char-editor">
      <div className="portrait" style={portraitStyle(spec.classId ?? '')} aria-hidden>
        <span className="mono">{classCode(spec.classId ?? '')}</span>
      </div>
      <div className="body">
        <div className="top">
          <input type="text" aria-label="Character name" value={spec.name} onChange={(e) => onChange({ ...spec, name: e.target.value })} />
          <select aria-label="Class" value={spec.classId} onChange={(e) => onReroll(e.target.value)}>
            {Object.values(content.classes).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
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
                    <div>{d.description}</div>
                    <div className="row">
                      <CostPips cost={d.cost} /> · cooldown {d.cooldown}
                    </div>
                  </>
                }
              >
                <span className="skill-chip" tabIndex={0}>
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
  const [seed, setSeed] = useState(newSeed);
  const [config, setConfig] = useState<MatchConfig>(() => randomConfig(content, seed));
  const [mode, setMode] = useState<ModeKind>('vsBot');
  const [bot, setBot] = useState<BotKind>('greedy');
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

  /** New random skills, keeping the class if one is given (changing class re-rolls for that class). */
  const rerollChar = (p: 0 | 1, i: number, classId?: string) => {
    const c = randomCharacter(content, seedRng(newSeed()), '', classId);
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
          Battle prototype · {Object.keys(content.skills).length} skills · content {content.version.slice(0, 8)}
        </span>
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
              <option value="greedy">Greedy (normal)</option>
              <option value="random">Random (easy)</option>
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
              <CharacterEditor key={i} spec={c} onChange={(n) => updateChar(p, i, n)} onReroll={(classId) => rerollChar(p, i, classId)} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
