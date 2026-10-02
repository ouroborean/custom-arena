-- Characters have no rarity any more, and their base element's infusion sits in their pool instead of
-- locked on a skill (docs/meta.md §1, 2026-10-03). Locked native infusions come off their skills (the
-- pool gives the element back to place), and the rarity and pity columns go.
UPDATE "characters" SET "skills" = coalesce((
  SELECT jsonb_agg(
    CASE WHEN (e.s->>'locked')::boolean THEN e.s || '{"infusion": null, "locked": false}'::jsonb ELSE e.s END
    ORDER BY e.n)
  FROM jsonb_array_elements("characters"."skills") WITH ORDINALITY AS e(s, n)
), '[]'::jsonb)
WHERE jsonb_typeof("characters"."skills") = 'array';
--> statement-breakpoint
ALTER TABLE "characters" DROP COLUMN "rarity";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "rolls_since_pity";
