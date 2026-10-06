-- Roster order (2026-10-06): players drag their characters into the order they like; recruits since
-- the last save have no position and go last.
ALTER TABLE "characters" ADD COLUMN "position" integer;