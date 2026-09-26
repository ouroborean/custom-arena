CREATE TABLE "achievement_progress" (
	"user_id" uuid NOT NULL,
	"achievement_id" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "achievement_progress_user_id_achievement_id_pk" PRIMARY KEY("user_id","achievement_id")
);
--> statement-breakpoint
CREATE TABLE "sp_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"ref" text NOT NULL,
	"content_version" text NOT NULL,
	"engine_version" text NOT NULL,
	"config" jsonb NOT NULL,
	"outcome" text,
	"turns" integer,
	"commands" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "story_chapters" (
	"user_id" uuid NOT NULL,
	"chapter_id" text NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_chapters_user_id_chapter_id_pk" PRIMARY KEY("user_id","chapter_id")
);
--> statement-breakpoint
CREATE TABLE "story_progress" (
	"user_id" uuid NOT NULL,
	"encounter_id" text NOT NULL,
	"clears" integer DEFAULT 0 NOT NULL,
	"first_cleared_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_progress_user_id_encounter_id_pk" PRIMARY KEY("user_id","encounter_id")
);
--> statement-breakpoint
ALTER TABLE "achievement_progress" ADD CONSTRAINT "achievement_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sp_attempts" ADD CONSTRAINT "sp_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_chapters" ADD CONSTRAINT "story_chapters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_progress" ADD CONSTRAINT "story_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sp_attempts_user_idx" ON "sp_attempts" USING btree ("user_id");