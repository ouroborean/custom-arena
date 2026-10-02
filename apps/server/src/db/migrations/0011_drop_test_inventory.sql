-- The "all equipment unlocked" testing mode is gone (2026-10-03), so accounts start out as players
-- will: the free copies it handed out (source 'dev') are removed, except any a character is wearing.
DELETE FROM "item_instances"
WHERE "item_instances"."source" = 'dev'
  AND NOT EXISTS (
    SELECT 1
    FROM "characters" c,
      jsonb_array_elements(CASE WHEN jsonb_typeof(c."loadout"->'items') = 'array' THEN c."loadout"->'items' ELSE '[]'::jsonb END) AS e(item)
    WHERE c."user_id" = "item_instances"."user_id" AND e.item->>'instanceId' = "item_instances"."id"::text
  );
