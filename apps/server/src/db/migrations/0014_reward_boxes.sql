-- Loot boxes from tutorial lessons and menu guides (2026-10-06): a box records what paid it, and only
-- level-up boxes have a level and bubble. guide_rewards pays each menu guide once per account.
CREATE TABLE "guide_rewards" (
	"user_id" uuid NOT NULL,
	"guide_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guide_rewards_user_id_guide_id_pk" PRIMARY KEY("user_id","guide_id")
);
--> statement-breakpoint
ALTER TABLE "loot_boxes" ALTER COLUMN "level" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "loot_boxes" ALTER COLUMN "at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "loot_boxes" ADD COLUMN "source" text DEFAULT 'level' NOT NULL;--> statement-breakpoint
ALTER TABLE "guide_rewards" ADD CONSTRAINT "guide_rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;