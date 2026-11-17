CREATE TABLE "daily_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"day" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_runs_salon_id_day_unique" UNIQUE("salon_id","day")
);
--> statement-breakpoint
CREATE TABLE "follow_up_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"service_id" uuid,
	"appointment_id" uuid,
	"appointment_version" integer,
	"kind" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"due_on" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"marked_at" timestamp with time zone,
	"marked_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follow_up_tasks_salon_id_dedupe_key_unique" UNIQUE("salon_id","dedupe_key"),
	CONSTRAINT "task_status" CHECK ("follow_up_tasks"."status" IN ('pending','marked_sent','dismissed')),
	CONSTRAINT "task_kind" CHECK ("follow_up_tasks"."kind" IN ('confirmation','reminder24','thanks','maintenance','reactivation','birthday'))
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"keys" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint"),
	CONSTRAINT "push_subscriptions_salon_id_id_unique" UNIQUE("salon_id","id")
);
--> statement-breakpoint
ALTER TABLE "scheduled_messages" ALTER COLUMN "client_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "owner_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD COLUMN "subscription_id" uuid;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD COLUMN "appointment_version" integer;--> statement-breakpoint
ALTER TABLE "daily_runs" ADD CONSTRAINT "daily_runs_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_marked_by_users_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_salon_id_service_id_services_salon_id_id_fk" FOREIGN KEY ("salon_id","service_id") REFERENCES "public"."services"("salon_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_salon_id_client_id_clients_salon_id_id_fk" FOREIGN KEY ("salon_id","client_id") REFERENCES "public"."clients"("salon_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_salon_id_appointment_id_appointments_salon_id_id_fk" FOREIGN KEY ("salon_id","appointment_id") REFERENCES "public"."appointments"("salon_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_due" ON "follow_up_tasks" USING btree ("salon_id","status","due_on");--> statement-breakpoint
CREATE INDEX "push_user" ON "push_subscriptions" USING btree ("salon_id","user_id");--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_salon_id_subscription_id_push_subscriptions_salon_id_id_fk" FOREIGN KEY ("salon_id","subscription_id") REFERENCES "public"."push_subscriptions"("salon_id","id") ON DELETE cascade ON UPDATE no action;