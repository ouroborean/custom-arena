CREATE TABLE "season_rewards" (
	"user_id" uuid NOT NULL,
	"season_id" text NOT NULL,
	"tier" text NOT NULL,
	"rating" integer NOT NULL,
	"currency" jsonb NOT NULL,
	"items" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "season_rewards_user_id_season_id_pk" PRIMARY KEY("user_id","season_id")
);
--> statement-breakpoint
ALTER TABLE "season_rewards" ADD CONSTRAINT "season_rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;