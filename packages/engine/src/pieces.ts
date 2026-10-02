// Forged equipment (docs/equipment.md §6): a piece is one component or up to 3 forged together, and its
// id is the components' ids joined with "+", in forge order. Like items, pieces never enter the engine
// directly; these are pure helpers over the content bundle for the resolver, server, client and tools.

import { fusionOf, type ContentBundle, type ItemDef, type ItemInfusion } from './defs.js';

/** Most components a piece can hold. */
export const PIECE_MAX_COMPONENTS = 3;

/** A resolved piece of equipment. */
export interface PieceDef {
  /** The piece id: component ids joined with "+". */
  id: string;
  name: string;
  /** The components, in forge order. */
  components: ItemDef[];
  /** Base skills granted, in forge order. */
  skills: string[];
  infusions: ItemInfusion[];
  /** The Sigil's passive text and status, if the piece has one. */
  passive?: string;
  passiveEffect?: string;
}

export const pieceId = (componentIds: readonly string[]): string => componentIds.join('+');
export const pieceComponentIds = (id: string): string[] => id.split('+');

/** What's wrong with a piece made of these component ids (empty when it's a legal piece). */
export function pieceProblems(content: ContentBundle, componentIds: readonly string[]): string[] {
  const problems: string[] = [];
  if (componentIds.length === 0) problems.push('A piece needs at least one component');
  if (componentIds.length > PIECE_MAX_COMPONENTS) problems.push(`A piece can hold ${PIECE_MAX_COMPONENTS} components (this has ${componentIds.length})`);
  const defs = componentIds.map((id) => content.items[id]);
  componentIds.forEach((id, i) => {
    if (!defs[i]) problems.push(`Unknown component "${id}"`);
  });
  const known = defs.filter((d): d is ItemDef => !!d);
  if (known.filter((d) => d.type === 'Sigil').length > 1) problems.push('A piece can hold one Sigil');
  const skills = known.flatMap((d) => d.skills);
  const twice = skills.find((s, i) => skills.indexOf(s) !== i);
  if (twice) problems.push(`A piece can't grant ${content.skills[twice]?.name ?? twice} twice`);
  return problems;
}

/** The piece with this id, or undefined if it isn't a legal piece. */
export function describePiece(content: ContentBundle, id: string): PieceDef | undefined {
  const ids = pieceComponentIds(id);
  if (pieceProblems(content, ids).length) return undefined;
  const components = ids.map((c) => content.items[c]!);
  const sigil = components.find((c) => c.type === 'Sigil');
  return {
    id,
    name: pieceName(content, components),
    components,
    skills: components.flatMap((c) => c.skills),
    infusions: components.flatMap((c) => c.infusions),
    ...(sigil?.passive !== undefined ? { passive: sigil.passive } : {}),
    ...(sigil?.passiveEffect !== undefined ? { passiveEffect: sigil.passiveEffect } : {}),
  };
}

/** A piece's display name, or the id itself when it isn't a legal piece (old or unknown ids). */
export function pieceDisplayName(content: ContentBundle, id: string): string {
  return describePiece(content, id)?.name ?? id;
}

const sortedKey = (parts: readonly string[]) => [...parts].sort().join('+');

/** `[prefix] Base [suffix]` from the components, in forge order (docs/forging-names.md). */
export function pieceName(content: ContentBundle, components: readonly ItemDef[]): string {
  const f = content.forging;
  const skillParts = components.filter((c) => c.type === 'Skill');
  const skills = skillParts.flatMap((c) => c.skills);
  const elements = components.flatMap((c) => c.infusions.map((i) => i.element));
  const sigil = components.find((c) => c.type === 'Sigil');
  const fusion = elements.length === 2 ? fusionOf(content, elements[0]!, elements[1]!) : undefined;
  const pair = (a: string, b: string) => f.pairs[sortedKey([a, b])] ?? `${skillParts[0]!.name} & ${skillParts[1]!.name}`;

  let base: string;
  if (skills.length === 0) {
    if (elements.length === 0) base = 'Sigil';
    else if (elements.length === 1) base = `${elements[0]} Shard`;
    else if (elements.length === 2) base = (fusion && f.crystals[fusion.id]) ?? `${fusion?.name ?? elements.join('-')} Crystal`;
    else base = `Geode ${f.geodes[sortedKey(elements)] ?? `of ${elements.join(', ')}`}`;
  } else if (skills.length === 1) base = skillParts[0]!.name;
  else if (skills.length === 2) base = pair(skills[0]!, skills[1]!);
  else base = `${f.prefixes[skills[2]!] ?? skillParts[2]!.name} ${pair(skills[0]!, skills[1]!)}`;

  let prefix = '';
  if (skills.length > 0 && elements.length === 1) prefix = `${elements[0]}-Infused `;
  if (skills.length > 0 && elements.length === 2) prefix = `${fusion?.name ?? elements.join('-')}-Infused `;
  return `${prefix}${base}${sigil?.suffix ? ` ${sigil.suffix}` : ''}`;
}

/** What's wrong with forging `addition` onto `base` (empty when it's allowed). The result keeps the
 * base's components first, so a base keeps its name and gains a prefix or suffix. */
export function forgeProblems(content: ContentBundle, base: string, addition: string): string[] {
  return pieceProblems(content, [...pieceComponentIds(base), ...pieceComponentIds(addition)]);
}

/** The piece forging `addition` onto `base` makes. */
export const forgedId = (base: string, addition: string): string => `${base}+${addition}`;
