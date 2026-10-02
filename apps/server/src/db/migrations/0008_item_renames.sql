-- Single-skill items were renamed to plain base nouns (docs/equipment.md): "Mighty Greathammer" is
-- now "Greathammer", and so on. Owned instances, loadouts and presets move to the new ids.
UPDATE "item_instances" SET "item_id" = r.new_id
FROM (VALUES
  ('worn_blade', 'longsword'),
  ('mighty_greathammer', 'greathammer'),
  ('infantry_spear', 'spear'),
  ('duelling_sidearm', 'rapier'),
  ('berserker_helmet', 'warhelm'),
  ('trackers_shortbow', 'shortbow'),
  ('marksmans_rifle', 'longrifle'),
  ('trappers_blade', 'snare'),
  ('grappling_hook', 'grapnel'),
  ('bear_idol', 'totem'),
  ('apprentice_wand', 'wand'),
  ('magic_tome', 'tome'),
  ('arcane_orb', 'orb'),
  ('glove_of_the_arcanist', 'glove'),
  ('crown_of_the_magi', 'circlet'),
  ('assassins_knife', 'dagger'),
  ('butchers_blades', 'hatchets'),
  ('dervish_blades', 'scimitars'),
  ('initiates_mace', 'mace'),
  ('holy_water', 'chalice'),
  ('cursed_vessel', 'effigy'),
  ('holy_sceptre', 'sceptre'),
  ('book_of_hymns', 'hymnal'),
  ('war_horn', 'warhorn'),
  ('iron_shield', 'shield'),
  ('flag_of_challenge', 'banner'),
  ('mithril_plate', 'fullplate')
) AS r(old_id, new_id)
WHERE "item_instances"."item_id" = r.old_id;
--> statement-breakpoint
UPDATE "characters" SET "loadout" = jsonb_set("characters"."loadout", '{items}', coalesce((
  SELECT jsonb_agg(CASE WHEN m.new_id IS NULL THEN e.item ELSE jsonb_set(e.item, '{itemId}', to_jsonb(m.new_id)) END ORDER BY e.n)
  FROM jsonb_array_elements("characters"."loadout"->'items') WITH ORDINALITY AS e(item, n)
  LEFT JOIN (VALUES
    ('worn_blade', 'longsword'),
    ('mighty_greathammer', 'greathammer'),
    ('infantry_spear', 'spear'),
    ('duelling_sidearm', 'rapier'),
    ('berserker_helmet', 'warhelm'),
    ('trackers_shortbow', 'shortbow'),
    ('marksmans_rifle', 'longrifle'),
    ('trappers_blade', 'snare'),
    ('grappling_hook', 'grapnel'),
    ('bear_idol', 'totem'),
    ('apprentice_wand', 'wand'),
    ('magic_tome', 'tome'),
    ('arcane_orb', 'orb'),
    ('glove_of_the_arcanist', 'glove'),
    ('crown_of_the_magi', 'circlet'),
    ('assassins_knife', 'dagger'),
    ('butchers_blades', 'hatchets'),
    ('dervish_blades', 'scimitars'),
    ('initiates_mace', 'mace'),
    ('holy_water', 'chalice'),
    ('cursed_vessel', 'effigy'),
    ('holy_sceptre', 'sceptre'),
    ('book_of_hymns', 'hymnal'),
    ('war_horn', 'warhorn'),
    ('iron_shield', 'shield'),
    ('flag_of_challenge', 'banner'),
    ('mithril_plate', 'fullplate')
  ) AS m(old_id, new_id) ON m.old_id = e.item->>'itemId'
), '[]'::jsonb))
WHERE jsonb_typeof("characters"."loadout"->'items') = 'array';
--> statement-breakpoint
UPDATE "loadout_presets" SET "loadout" = jsonb_set("loadout_presets"."loadout", '{items}', coalesce((
  SELECT jsonb_agg(CASE WHEN m.new_id IS NULL THEN e.item ELSE jsonb_set(e.item, '{itemId}', to_jsonb(m.new_id)) END ORDER BY e.n)
  FROM jsonb_array_elements("loadout_presets"."loadout"->'items') WITH ORDINALITY AS e(item, n)
  LEFT JOIN (VALUES
    ('worn_blade', 'longsword'),
    ('mighty_greathammer', 'greathammer'),
    ('infantry_spear', 'spear'),
    ('duelling_sidearm', 'rapier'),
    ('berserker_helmet', 'warhelm'),
    ('trackers_shortbow', 'shortbow'),
    ('marksmans_rifle', 'longrifle'),
    ('trappers_blade', 'snare'),
    ('grappling_hook', 'grapnel'),
    ('bear_idol', 'totem'),
    ('apprentice_wand', 'wand'),
    ('magic_tome', 'tome'),
    ('arcane_orb', 'orb'),
    ('glove_of_the_arcanist', 'glove'),
    ('crown_of_the_magi', 'circlet'),
    ('assassins_knife', 'dagger'),
    ('butchers_blades', 'hatchets'),
    ('dervish_blades', 'scimitars'),
    ('initiates_mace', 'mace'),
    ('holy_water', 'chalice'),
    ('cursed_vessel', 'effigy'),
    ('holy_sceptre', 'sceptre'),
    ('book_of_hymns', 'hymnal'),
    ('war_horn', 'warhorn'),
    ('iron_shield', 'shield'),
    ('flag_of_challenge', 'banner'),
    ('mithril_plate', 'fullplate')
  ) AS m(old_id, new_id) ON m.old_id = e.item->>'itemId'
), '[]'::jsonb))
WHERE jsonb_typeof("loadout_presets"."loadout"->'items') = 'array';
