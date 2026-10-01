ALTER TABLE "characters" ALTER COLUMN "loadout" SET DEFAULT '{"items":[]}'::jsonb;
--> statement-breakpoint
-- Loadouts had typed slots (two-handed, main hand, off hand, body, accessories, crystal sockets);
-- now they're a list of up to four items of any type (docs/meta.md §2.1). Items keep that slot
-- order; any past the fourth are unequipped and stay in the inventory.
UPDATE "characters" SET "loadout" = (
  SELECT jsonb_build_object('items', coalesce(jsonb_agg(e.item ORDER BY e.ord), '[]'::jsonb))
  FROM (
    SELECT s.item, s.ord FROM (
      SELECT "characters"."loadout"->'twoHanded' AS item, 0 AS ord
      UNION ALL SELECT "characters"."loadout"->'mainHand', 1
      UNION ALL SELECT "characters"."loadout"->'offHand', 2
      UNION ALL SELECT "characters"."loadout"->'body', 3
      UNION ALL SELECT a.value, 10 + a.n FROM jsonb_array_elements(CASE WHEN jsonb_typeof("characters"."loadout"->'accessories') = 'array' THEN "characters"."loadout"->'accessories' ELSE '[]'::jsonb END) WITH ORDINALITY AS a(value, n)
      UNION ALL SELECT k.value, 100 + k.n FROM jsonb_array_elements(CASE WHEN jsonb_typeof("characters"."loadout"->'sockets') = 'array' THEN "characters"."loadout"->'sockets' ELSE '[]'::jsonb END) WITH ORDINALITY AS k(value, n)
    ) s
    WHERE jsonb_typeof(s.item) = 'object'
    ORDER BY s.ord
    LIMIT 4
  ) e
)
WHERE "characters"."loadout"->'items' IS NULL;
--> statement-breakpoint
UPDATE "loadout_presets" SET "loadout" = (
  SELECT jsonb_build_object('items', coalesce(jsonb_agg(e.item ORDER BY e.ord), '[]'::jsonb))
  FROM (
    SELECT s.item, s.ord FROM (
      SELECT "loadout_presets"."loadout"->'twoHanded' AS item, 0 AS ord
      UNION ALL SELECT "loadout_presets"."loadout"->'mainHand', 1
      UNION ALL SELECT "loadout_presets"."loadout"->'offHand', 2
      UNION ALL SELECT "loadout_presets"."loadout"->'body', 3
      UNION ALL SELECT a.value, 10 + a.n FROM jsonb_array_elements(CASE WHEN jsonb_typeof("loadout_presets"."loadout"->'accessories') = 'array' THEN "loadout_presets"."loadout"->'accessories' ELSE '[]'::jsonb END) WITH ORDINALITY AS a(value, n)
      UNION ALL SELECT k.value, 100 + k.n FROM jsonb_array_elements(CASE WHEN jsonb_typeof("loadout_presets"."loadout"->'sockets') = 'array' THEN "loadout_presets"."loadout"->'sockets' ELSE '[]'::jsonb END) WITH ORDINALITY AS k(value, n)
    ) s
    WHERE jsonb_typeof(s.item) = 'object'
    ORDER BY s.ord
    LIMIT 4
  ) e
)
WHERE "loadout_presets"."loadout"->'items' IS NULL;
