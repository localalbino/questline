ALTER TABLE "boards" ADD COLUMN "streak_weeks" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "streak_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "streak_resets_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "streak_completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "streak_counted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Games already checked off before streaks existed don't get to count by being unchecked and rechecked.
UPDATE "cards" SET "streak_counted" = "isCompleted";
