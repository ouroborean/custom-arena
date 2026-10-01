ALTER TABLE "characters" ALTER COLUMN "loadout" SET DEFAULT '{"items":[],"infusions":[]}'::jsonb;
--> statement-breakpoint
-- Equipment infusions became a pool the player puts on skills (docs/meta.md §2.2): items no longer
-- carry per-item targets. Saved targets are dropped, and loadouts start with no infusions applied.
UPDATE "characters" SET "loadout" = jsonb_build_object(
  'items', coalesce((
    SELECT jsonb_agg(e.item - 'targets' - 'unused' ORDER BY e.n)
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof("characters"."loadout"->'items') = 'array' THEN "characters"."loadout"->'items' ELSE '[]'::jsonb END) WITH ORDINALITY AS e(item, n)
  ), '[]'::jsonb),
  'infusions', '[]'::jsonb
)
WHERE "characters"."loadout"->'infusions' IS NULL;
--> statement-breakpoint
UPDATE "loadout_presets" SET "loadout" = jsonb_build_object(
  'items', coalesce((
    SELECT jsonb_agg(e.item - 'targets' - 'unused' ORDER BY e.n)
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof("loadout_presets"."loadout"->'items') = 'array' THEN "loadout_presets"."loadout"->'items' ELSE '[]'::jsonb END) WITH ORDINALITY AS e(item, n)
  ), '[]'::jsonb),
  'infusions', '[]'::jsonb
)
WHERE "loadout_presets"."loadout"->'infusions' IS NULL;
