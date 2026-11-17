CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
-- El intervalo incluye limpieza. [) permite empezar exactamente al terminar el bloqueo anterior.
ALTER TABLE appointments ADD CONSTRAINT appointments_no_overlap
EXCLUDE USING gist (salon_id WITH =, staff_id WITH =, tstzrange(starts_at, busy_until, '[)') WITH &&)
WHERE (status IN ('confirmed', 'completed'));
--> statement-breakpoint
ALTER TABLE appointments ADD CONSTRAINT appointment_status CHECK (status IN ('confirmed','completed','cancelled','no_show'));
--> statement-breakpoint
ALTER TABLE memberships ADD CONSTRAINT membership_role CHECK (role IN ('owner','staff','client'));
--> statement-breakpoint
ALTER TABLE users ADD CONSTRAINT user_role CHECK (role IN ('superadmin','client'));
--> statement-breakpoint
ALTER TABLE scheduled_messages ADD CONSTRAINT message_state CHECK (status IN ('pending','processing','sent','cancelled','failed','uncertain'));
--> statement-breakpoint
ALTER TABLE scheduled_messages ADD CONSTRAINT message_channel CHECK (channel IN ('email','whatsapp'));
--> statement-breakpoint
CREATE INDEX time_off_staff_range ON time_off (salon_id, staff_id, starts_at, ends_at);
--> statement-breakpoint
CREATE INDEX clients_created ON clients (salon_id, created_at);
--> statement-breakpoint
CREATE INDEX membership_user ON memberships (user_id);
