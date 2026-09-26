import {
  effectDefinition,
  effectName,
  evaluateNamedCondition,
  type ContentBundle,
  type EffectInstance,
  type PlayerId,
  type PlayerView,
  type SkillAvailability,
  type Unit,
} from '@arena/engine';
import { useStore } from '../store.js';
import { CostPips, elementClass, portraitStyle, skillCategory, skillCode, statusCode, unitCode, useHover, useMediaQuery } from './common.js';

// ---------------------------------------------------------------- shared pieces

function StatusChip({ e, content }: { e: EffectInstance; content: ContentBundle }) {
  const hover = useHover({ kind: 'effect', effect: e.id });
  const def = effectDefinition(content, e);
  const name = effectName(content, e.defId);
  const key = e.inline?.id ?? e.defId;
  const hidden = def?.visibility === 'hidden' && !e.revealed;
  return (
    <button
      type="button"
      className={`chip ${def?.kind ?? 'Neutral'}${hidden ? ' hidden' : ''}`}
      aria-label={`${name}${e.stacks > 1 ? ` ×${e.stacks}` : ''}${e.duration !== null ? `, ${e.duration} turn ends left` : ''}`}
      {...hover}
      onClick={hover.onFocus}
    >
      {statusCode(key, name)}
      {e.duration !== null && <span className="d">{e.duration}</span>}
      {(e.stacks > 1 || e.value > 0) && <span className="n">{e.value > 0 ? e.value : `×${e.stacks}`}</span>}
    </button>
  );
}

/** Fixed-size status grid: extras collapse into a "+N" badge that opens the unit's details. */
function StatusGrid({ unit, effects, limit, content }: { unit: Unit; effects: EffectInstance[]; limit: number; content: ContentBundle }) {
  const hover = useHover({ kind: 'unit', unit: unit.id });
  const overflow = effects.length > limit;
  return (
    <div className="statuses box" aria-label={`${unit.name} effects`}>
      {(overflow ? effects.slice(0, limit - 1) : effects).map((e) => (
        <StatusChip key={e.id} e={e} content={content} />
      ))}
      {overflow && (
        <button
          type="button"
          className="chip more"
          aria-label={`${effects.length - limit + 1} more effects`}
          {...hover}
          onClick={hover.onFocus}
        >
          +{effects.length - limit + 1}
        </button>
      )}
    </div>
  );
}

function SkillTile({
  unit,
  slot,
  content,
  availability,
  queued,
  queueIndex,
  locked,
  showName = true,
}: {
  unit: Unit;
  slot: number;
  content: ContentBundle;
  availability: SkillAvailability | undefined;
  queued: boolean;
  queueIndex: number;
  locked: boolean;
  showName?: boolean;
}) {
  const targeting = useStore((s) => s.targeting);
  const selectSkill = useStore((s) => s.selectSkill);
  const unqueue = useStore((s) => s.unqueue);
  const hover = useHover({ kind: 'skill', unit: unit.id, slot });
  const s = unit.skills[slot]!;
  const def = content.skills[s.defId]!;
  const cost = availability?.cost ?? def.cost;
  const usable = !!availability && availability.targets.length > 0;
  const selected = targeting?.actor === unit.id && targeting.slot === slot;
  const reason = !usable && !queued ? availability?.reason : null;
  // aria-disabled (not disabled) so unavailable skills still receive hover/focus for their details card.
  const unavailable = locked || (!usable && !queued);

  return (
    <div className="tile-wrap">
      <button
        type="button"
        className={`tile cat-${skillCategory(def)} ${elementClass(def.element)}${selected ? ' selected' : ''}${queued ? ' queued' : ''}`}
        aria-disabled={unavailable}
        aria-pressed={selected || queued}
        aria-label={`${def.name}${s.cooldown > 0 ? `, cooldown ${s.cooldown}` : ''}${queued ? ', queued' : ''}${reason ? `, unavailable: ${reason}` : ''}`}
        {...hover}
        onClick={() => {
          if (unavailable) return;
          if (queued && queueIndex >= 0) unqueue(queueIndex);
          else selectSkill(unit.id, slot);
        }}
      >
        <span className="code">{skillCode(def)}</span>
        <CostPips cost={cost} />
        {s.cooldown > 0 && <span className="cd">{s.cooldown}</span>}
      </button>
      {showName && (
        <span className="tile-name" aria-hidden>
          {def.name}
        </span>
      )}
    </div>
  );
}

/** An enemy's skill, shown for reading only (hover to inspect the unit). */
function StaticTile({ unit, slot, content }: { unit: Unit; slot: number; content: ContentBundle }) {
  const hover = useHover({ kind: 'skill', unit: unit.id, slot });
  const s = unit.skills[slot]!;
  const def = content.skills[s.defId]!;
  return (
    <span className="tile-wrap">
      <span className={`tile static cat-${skillCategory(def)} ${elementClass(def.element)}`} tabIndex={0} aria-label={def.name} {...hover}>
        <span className="code">{skillCode(def)}</span>
        <CostPips cost={def.cost} />
        {s.cooldown > 0 && <span className="cd">{s.cooldown}</span>}
      </span>
    </span>
  );
}

function EnemySkill({ unit, slot, content }: { unit: Unit; slot: number; content: ContentBundle }) {
  const hover = useHover({ kind: 'skill', unit: unit.id, slot });
  const s = unit.skills[slot]!;
  return (
    <span className="mini" tabIndex={0} {...hover}>
      <span>{content.skills[s.defId]!.name}</span>
      <span className="cdn">{s.cooldown > 0 ? s.cooldown : ''}</span>
    </span>
  );
}

/** Everything a unit's visual needs: display HP (during playback), shield, targeting, queue. */
function useUnitState(unit: Unit, view: PlayerView, viewer: PlayerId, content: ContentBundle) {
  const targeting = useStore((s) => s.targeting);
  const displayHp = useStore((s) => s.displayHp);
  const playing = useStore((s) => s.pending.length > 0);
  const mine = unit.owner === viewer;
  const hp = displayHp[unit.id] ?? unit.hp;
  const alive = hp > 0 && unit.alive;
  const effects = view.effects.filter((e) => e.bearer === unit.id);
  const shield = effects.filter((e) => effectDefinition(content, e)?.shield).reduce((n, e) => n + e.value, 0);
  const pct = Math.max(0, Math.min(100, (hp / unit.maxHp) * 100));
  const queue = mine ? (view.players[viewer].queue ?? []) : [];
  const queueIndex = queue.findIndex((q) => q.actor === unit.id);
  const queued = queueIndex >= 0 ? queue[queueIndex] : undefined;
  return {
    mine,
    hp,
    alive,
    effects,
    shield,
    pct,
    shieldPct: Math.min(100 - pct, (shield / unit.maxHp) * 100),
    hpClass: pct <= 30 ? 'low' : pct <= 60 ? 'mid' : '',
    targetable: !!targeting && targeting.options.some((o) => o[0] === unit.id),
    acting: targeting?.actor === unit.id,
    playing,
    queue,
    queueIndex,
    queued,
  };
}

type UnitState = ReturnType<typeof useUnitState>;

function Portrait({ unit, st, view, content }: { unit: Unit; st: UnitState; view: PlayerView; content: ContentBundle }) {
  const allFloats = useStore((s) => s.floats);
  const removeFloat = useStore((s) => s.removeFloat);
  const chooseTarget = useStore((s) => s.chooseTarget);
  const hover = useHover({ kind: 'unit', unit: unit.id });
  const floats = allFloats.filter((f) => f.unit === unit.id);
  const queuedDef = st.queued ? content.skills[unit.skills[st.queued.slot]!.defId] : undefined;
  const queuedTarget = st.queued?.targets[0] ? view.units.find((u) => u.id === st.queued!.targets[0])?.name : undefined;

  // Named conditions from content that deserve a visible badge (derived, so they have no status chip).
  const prey = unit.alive && !!content.conditions.prey && evaluateNamedCondition(content, view, 'prey', unit.id);
  // Immobile is true of most units, so it's only worth showing when a Wind skill is in play.
  const windInPlay = view.units.some((u) => u.alive && u.skills.some((s) => content.skills[s.defId]?.element === 'Wind'));
  const immobile =
    windInPlay && unit.alive && !!content.conditions.immobile && evaluateNamedCondition(content, view, 'immobile', unit.id);
  const states = [prey && 'PREY', immobile && 'IMMOBILE'].filter(Boolean).join(' · ');

  const inner = (
    <>
      <span className="mono">{unitCode(unit)}</span>
      <span className="tag">{unit.name}</span>
      {states && (
        <span
          className="state-tag"
          title={[
            prey && 'Prey: more than 2 debuff stacks, under 20 HP, or marked',
            immobile && 'Immobile: no mobility skills and no Swiftness, Rushing or Leaping',
          ]
            .filter(Boolean)
            .join(' / ')}
        >
          {states}
        </span>
      )}
      {queuedDef && !st.playing && (
        <span className="queued-slot" title={`Queued: ${queuedDef.name}${queuedTarget ? ` → ${queuedTarget}` : ''}`}>
          {queuedDef.name}
          {queuedTarget ? ` → ${queuedTarget}` : ''}
        </span>
      )}
      <span className="floats" aria-hidden>
        {floats.map((f) => (
          <span key={f.id} className={`float ${f.kind}`} onAnimationEnd={() => removeFloat(f.id)}>
            {f.text}
          </span>
        ))}
      </span>
    </>
  );

  if (st.targetable) {
    return (
      <button
        type="button"
        className={`portrait targetable ${elementClass(unit.element)}`}
        style={portraitStyle(unit.defId)}
        aria-label={`Target ${unit.name}`}
        onClick={() => chooseTarget(unit.id)}
        {...hover}
      >
        {inner}
      </button>
    );
  }
  return (
    <div
      className={`portrait ${elementClass(unit.element)}${st.acting ? ' acting' : ''}`}
      style={portraitStyle(unit.defId)}
      tabIndex={0}
      role="group"
      aria-label={`${unit.name}, ${st.hp} of ${unit.maxHp} health`}
      {...hover}
    >
      {inner}
    </div>
  );
}

function Health({ unit, st }: { unit: Unit; st: UnitState }) {
  return (
    <>
      <div className="hpbar" aria-hidden>
        <div className={`fill ${st.hpClass}`} style={{ width: `${st.pct}%` }} />
        {st.shield > 0 && <div className="shield" style={{ left: `${st.pct}%`, width: `${st.shieldPct}%` }} />}
      </div>
      <div className="hptext">
        {st.alive ? `${st.hp} / ${unit.maxHp}` : 'KO'}
        {st.shield > 0 && <span className="sh"> +{st.shield}</span>}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- character rows

export function UnitRow({
  unit,
  view,
  viewer,
  content,
  availability,
  hit,
}: {
  unit: Unit;
  view: PlayerView;
  viewer: PlayerId;
  content: ContentBundle;
  availability: SkillAvailability[];
  hit: boolean;
}) {
  const st = useUnitState(unit, view, viewer, content);
  const narrow = useMediaQuery('(max-width: 900px)');
  const phone = useMediaQuery('(max-width: 600px)');
  const statusLimit = !st.mine && narrow ? 4 : phone ? 8 : 15;
  const rowClass = ['unit-row', st.mine ? '' : 'enemy', st.alive ? '' : 'dead', hit ? 'hit' : ''].filter(Boolean).join(' ');

  return (
    <div className={rowClass}>
      <div className="fighter">
        <Portrait unit={unit} st={st} view={view} content={content} />
        <Health unit={unit} st={st} />
      </div>

      <StatusGrid unit={unit} effects={st.effects} limit={statusLimit} content={content} />

      {st.mine && unit.skills.length > 0 && (
        <div className="strip">
          {unit.skills.map((_, i) => (
            <SkillTile
              key={i}
              unit={unit}
              slot={i}
              content={content}
              availability={availability.find((a) => a.actor === unit.id && a.slot === i)}
              queued={st.queued?.slot === i}
              queueIndex={st.queueIndex}
              locked={st.playing || !st.alive}
            />
          ))}
        </div>
      )}

      {!st.mine && unit.skills.length > 0 && (
        <div className="enemy-skills" aria-label={`${unit.name} skills`}>
          {unit.skills.map((slot, i) => (
            <EnemySkill key={i} unit={unit} slot={i} content={content} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- minion bench

const MINION_SKILL_SLOTS = 2;

export function MinionSlot({
  unit,
  view,
  viewer,
  content,
  availability,
  hit,
}: {
  unit: Unit;
  view: PlayerView;
  viewer: PlayerId;
  content: ContentBundle;
  availability: SkillAvailability[];
  hit: boolean;
}) {
  const st = useUnitState(unit, view, viewer, content);
  const cls = ['slot', 'filled', st.mine ? '' : 'enemy', st.alive ? '' : 'dead', hit ? 'hit' : ''].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <div className="slot-left">
        <Portrait unit={unit} st={st} view={view} content={content} />
      </div>
      <div className="slot-right">
        <Health unit={unit} st={st} />
        <StatusGrid unit={unit} effects={st.effects} limit={4} content={content} />
        <div className="slot-skills" aria-label={`${unit.name} skills`}>
          {unit.skills.slice(0, MINION_SKILL_SLOTS).map((_, i) =>
            st.mine ? (
              <SkillTile
                key={i}
                unit={unit}
                slot={i}
                content={content}
                availability={availability.find((a) => a.actor === unit.id && a.slot === i)}
                queued={st.queued?.slot === i}
                queueIndex={st.queueIndex}
                locked={st.playing || !st.alive}
                showName={false}
              />
            ) : (
              <StaticTile key={i} unit={unit} slot={i} content={content} />
            ),
          )}
          {unit.skills.length === 0 && <span className="slot-note">Acts automatically</span>}
        </div>
      </div>
    </div>
  );
}

export function EmptySlot() {
  return (
    <div className="slot empty" aria-hidden>
      <span>Minion slot</span>
    </div>
  );
}
