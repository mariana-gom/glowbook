-- Conserva el historial y anula cualquier envío automático de WhatsApp anterior.
UPDATE scheduled_messages SET status='cancelled', last_error='Migración a WhatsApp manual con wa.me' WHERE channel='whatsapp' AND status IN ('pending','processing');
--> statement-breakpoint
UPDATE scheduled_messages SET status='cancelled', last_error='El flujo diario reemplaza los recordatorios de dos horas' WHERE kind='reminder2' AND status IN ('pending','processing');
--> statement-breakpoint
ALTER TABLE scheduled_messages DROP CONSTRAINT message_channel;
--> statement-breakpoint
ALTER TABLE scheduled_messages ADD CONSTRAINT message_channel CHECK (channel IN ('email','push','whatsapp'));
--> statement-breakpoint
ALTER TABLE scheduled_messages ADD CONSTRAINT push_recipient CHECK (channel <> 'push' OR (subscription_id IS NOT NULL AND user_id IS NOT NULL));
--> statement-breakpoint
UPDATE scheduled_messages AS m SET appointment_version=a.version FROM appointments AS a WHERE a.id=m.appointment_id AND a.salon_id=m.salon_id AND m.appointment_version IS NULL;
--> statement-breakpoint
UPDATE scheduled_messages AS m SET scheduled_at = (((a.starts_at AT TIME ZONE 'America/Bogota')::date - 1) + time '07:00') AT TIME ZONE 'America/Bogota' FROM appointments AS a WHERE a.id=m.appointment_id AND a.salon_id=m.salon_id AND m.kind='reminder24' AND m.status='pending' AND m.channel='email';
--> statement-breakpoint
UPDATE salons SET settings=(settings - 'whatsappTemplates' - 'whatsappEnabled') || jsonb_build_object('whatsappMessages',coalesce(settings->'whatsappMessages',$${"clientConfirmation":"Hola, soy {nombre}. Quiero confirmar mi cita {codigo}: {servicio}, el {fecha} a las {hora}, con {profesional}. Mi enlace de gestión: {enlace_reprogramar}","confirmation":"¡Hola, {nombre}! Te confirmamos tu cita {codigo} en {salon}: {servicio}, el {fecha} a las {hora}, con {profesional}. Cambios: {enlace_reprogramar}","reminder24":"Hola, {nombre}. Te esperamos en {salon} el {fecha} a las {hora} para {servicio}, con {profesional}. Cita {codigo}. Cambios: {enlace_reprogramar}","thanks":"Gracias por visitarnos, {nombre}. Cuéntanos cómo estuvo tu experiencia: {enlace_reprogramar}","maintenance":"Hola, {nombre}. Es momento de renovar tu {servicio}. Reserva en {salon}: {enlace_reprogramar}","reactivation":"¡Te extrañamos, {nombre}! Reserva tu próxima visita en {salon}: {enlace_reprogramar}","birthday":"¡Feliz cumpleaños, {nombre}! Con cariño, {salon}. {enlace_reprogramar}"}$$::jsonb),'reactivationDays',coalesce(settings->'reactivationDays','60'::jsonb),'ownerEmailEnabled',coalesce(settings->'ownerEmailEnabled','true'::jsonb));
