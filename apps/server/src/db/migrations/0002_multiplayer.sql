CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"kind" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_actions" (
	"match_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"player" smallint NOT NULL,
	"command" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_actions_match_id_seq_pk" PRIMARY KEY("match_id","seq")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"content_version" text NOT NULL,
	"engine_version" text NOT NULL,
	"config" jsonb NOT NULL,
	"p0_user" uuid NOT NULL,
	"p1_user" uuid NOT NULL,
	"winner" smallint,
	"end_reason" text,
	"turns" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"rating_changes" jsonb
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"user_id" uuid NOT NULL,
	"queue" text NOT NULL,
	"rating" double precision NOT NULL,
	"rd" double precision NOT NULL,
	"vol" double precision NOT NULL,
	"games" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ratings_user_id_queue_pk" PRIMARY KEY("user_id","queue")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_actions" ADD CONSTRAINT "match_actions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_p0_user_users_id_fk" FOREIGN KEY ("p0_user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_p1_user_users_id_fk" FOREIGN KEY ("p1_user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_user_idx" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_kind_idx" ON "audit_log" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "matches_p0_idx" ON "matches" USING btree ("p0_user");--> statement-breakpoint
CREATE INDEX "matches_p1_idx" ON "matches" USING btree ("p1_user");--> statement-breakpoint
CREATE INDEX "matches_status_idx" ON "matches" USING btree ("status");