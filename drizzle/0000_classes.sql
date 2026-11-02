CREATE TABLE "classrooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"time_zone" text DEFAULT 'Asia/Dubai' NOT NULL,
	"term_start" bigint NOT NULL,
	"world_id" text DEFAULT 'space-fleet' NOT NULL,
	"low_graphics" boolean DEFAULT false NOT NULL,
	"show_scores" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "point_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigserial NOT NULL,
	"class_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"at" bigint NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "point_events" ADD CONSTRAINT "point_events_class_id_classrooms_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classrooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_events" ADD CONSTRAINT "point_events_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_class_id_classrooms_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classrooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "classrooms_owner" ON "classrooms" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "point_events_class_at" ON "point_events" USING btree ("class_id","at");--> statement-breakpoint
CREATE INDEX "students_class" ON "students" USING btree ("class_id","position");