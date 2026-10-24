CREATE TABLE "experience" (
	"user_id" text PRIMARY KEY,
	"xp" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "experience" ADD CONSTRAINT "experience_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;