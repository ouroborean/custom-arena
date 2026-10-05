-- Player levels and loot boxes (docs/equipment.md §4.1, 2026-10-05): each account's total experience,
-- and the loot boxes its experience bar has paid (rolled when opened).
CREATE TABLE "loot_boxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"box" text NOT NULL,
	"level" integer NOT NULL,
	"at" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opened_at" timestamp with time zone,
	"contents" jsonb
);
--> statement-breakpoint
CREATE TABLE "player_progress" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loot_boxes" ADD CONSTRAINT "loot_boxes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_progress" ADD CONSTRAINT "player_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "loot_boxes_user_idx" ON "loot_boxes" USING btree ("user_id");