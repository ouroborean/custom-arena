-- Infused Recruits (2026-10-09): every account, existing ones included, starts with 3.
ALTER TABLE "users" ADD COLUMN "infused_recruits" integer DEFAULT 3 NOT NULL;