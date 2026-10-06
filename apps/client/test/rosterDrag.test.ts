// Roster drag-and-drop (decided 2026-10-06): dropping a card on another moves it there; dropping a
// character on a team slot puts them in it, replacing who was there, or swapping places if they were
// already in the team.

import { describe, expect, it } from 'vitest';
import { moveInRoster, placeInTeam } from '../src/ui/RosterDrag.js';

describe('moving a card in the roster', () => {
  const ids = ['a', 'b', 'c', 'd'];
  it('lands before or after the card it was dropped on', () => {
    expect(moveInRoster(ids, 'a', { index: 2, after: false })).toEqual(['b', 'a', 'c', 'd']);
    expect(moveInRoster(ids, 'a', { index: 2, after: true })).toEqual(['b', 'c', 'a', 'd']);
    expect(moveInRoster(ids, 'd', { index: 0, after: false })).toEqual(['d', 'a', 'b', 'c']);
    expect(moveInRoster(ids, 'b', { index: 3, after: true })).toEqual(['a', 'c', 'd', 'b']);
  });

  it('dropped on itself, nothing moves', () => {
    expect(moveInRoster(ids, 'b', { index: 1, after: false })).toEqual(ids);
    expect(moveInRoster(ids, 'b', { index: 1, after: true })).toEqual(ids);
  });
});

describe('putting a character in a team slot', () => {
  it('replaces whoever was in the slot', () => {
    expect(placeInTeam(['a', 'b', 'c'], 'd', 1)).toEqual(['a', 'd', 'c']);
  });

  it('swaps places with a character already in the team', () => {
    expect(placeInTeam(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'b', 'a']);
    expect(placeInTeam(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'b', 'c']);
  });

  it('fills an empty slot at the end of a short team', () => {
    expect(placeInTeam(['a', 'b'], 'c', 2)).toEqual(['a', 'b', 'c']);
  });
});
