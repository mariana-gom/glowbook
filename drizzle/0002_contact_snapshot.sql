ALTER TABLE "appointments" ADD COLUMN "contact" jsonb;
--> statement-breakpoint
UPDATE appointments AS a SET contact = jsonb_build_object('name', c.name, 'email', c.email, 'phone', c.phone)
FROM clients AS c WHERE c.salon_id = a.salon_id AND c.id = a.client_id;
--> statement-breakpoint
ALTER TABLE appointments ALTER COLUMN contact SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD COLUMN "first_attempt_at" timestamp with time zone;
