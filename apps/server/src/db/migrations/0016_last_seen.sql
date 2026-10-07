-- When each account was last active (2026-10-07), for the admin tool.
ALTER TABLE "users" ADD COLUMN "last_seen_at" timestamp with time zone;