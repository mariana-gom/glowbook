# Primera entrega: estructura, esquema y pantallas

## Estructura

```text
src/
  app/
    page.tsx                   Venta de GlowBook
    demo/                      Entrada al sandbox
    acceso/                    Email/contraseña y Google
    [slug]/                    Página pública por salón
      reservar/                Recorrido de cuatro pasos
    gestionar/[token]/         Cambio, cancelación y reseña
    panel/
      agenda/                  Día o siete días, con filtro de profesional
      clientas/                Directorio paginado e historial individual
      servicios/               Categorías, catálogo, precios y tiempos
      equipo/                  Perfiles, asignación, jornadas y ausencias
      mensajes/                Plantillas y estados de envío
      configuracion/           Marca, reglas, galería y reseñas
    superadmin/                Altas, cuentas y activación de negocios
    actions/                   Mutaciones autorizadas y validadas
    api/
      auth/[...all]/           Better Auth
      images/                  Carga autenticada en Vercel Blob
      cron/process/            Cola de mensajes
      cron/daily/              Gancho protegido; campañas deshabilitadas
  components/                  Interfaz reutilizable y formularios
    ui/                        Primitivas shadcn/ui
  db/
    schema.ts                  Único esquema Drizzle
    index.ts                   Driver Neon y conexión
    tenant.ts                  Filtro obligatorio por salón
  emails/                      Plantilla React Email
  lib/                         Lecturas, acceso, disponibilidad y envíos
scripts/                       Migración, seed y bootstrap
drizzle/                       Migraciones y snapshots
tests/                         Reglas de disponibilidad y PostgreSQL real
  e2e/                         Recorrido del demo en escritorio y móvil
```

## Esquema de Drizzle

El archivo `src/db/schema.ts` es la definición ejecutable. Las tablas de negocio llevan `salon_id`; las relaciones entre ellas incluyen el salón en la clave foránea, por lo que PostgreSQL también rechaza asociaciones entre negocios distintos.

```text
salons
 ├─ memberships ── users ── sessions / accounts / verifications
 ├─ service_categories ── services
 ├─ staff ── staff_services ── services
 │   ├─ working_hours
 │   └─ time_off
 ├─ clients
 │   ├─ appointments ── staff
 │   │   ├─ appointment_services ── services
 │   │   ├─ scheduled_messages
 │   │   └─ reviews
 │   └─ loyalty_transactions      [reservada para Fase 2]
 ├─ gallery_photos
 └─ promotions                   [reservada para Fase 2]
```

- `salons`: slug único, estado, marca y configuración tipada en JSONB.
- `users`, `accounts`, `sessions`, `verifications`: identidad global de Better Auth. Es una excepción deliberada a `salonId`: una persona puede acceder a varios salones sin duplicar su cuenta. Las membresías resuelven su permiso por negocio.
- `staff`, `staff_services`: perfiles y servicios que una profesional puede realizar.
- `services`: COP enteros, duración, limpieza, imagen, descripción y mantenimiento futuro.
- `working_hours`: día de semana y minutos locales; la interfaz muestra horas legibles.
- `time_off`: intervalos de ausencia; se rechaza un bloqueo que cruce citas confirmadas.
- `clients`: contacto por salón, autorización operacional y consentimiento comercial separado.
- `appointments`: intervalos con zona horaria, estado, total, versión, clave de petición y hash del token de gestión. Conserva un contacto de esa reserva, sin sobrescribir el perfil desde una reserva pública.
- `appointment_services`: nombre, precio y duración contratados; editar el catálogo no altera el historial.
- `scheduled_messages`: fecha, canal, clave de deduplicación, estado, intentos, primera tentativa, errores y referencia del proveedor.
- `reviews`: una reseña por cita completada, con publicación explícita.

Las fechas se almacenan como `timestamptz`; horarios se interpretan siempre con `America/Bogota` (UTC−05). Se reservan intervalos `[inicio, fin + limpieza)`. La migración `0001_booking_guards.sql` crea una restricción `EXCLUDE USING gist` sobre salón, profesional y rango: no depende de que dos navegadores consulten la disponibilidad a tiempo.

## Mapa de pantallas y permisos

```text
/                         Venta → demo → contacto comercial configurado
/demo                     Dueña → /panel con datos ficticios
                          Clienta → /nails-glam-studio
/[slug]                   Servicios + galería + equipo + reseñas + ubicación
/[slug]/reservar           1 Servicios → 2 Profesional → 3 Fecha/hora → 4 Datos
/gestionar/[token]         Estado → reprogramar / cancelar / reseña
/acceso                   Email/contraseña o Google
/panel                    Resumen operacional
/panel/agenda              Dueña: todas; profesional: solo las propias
/panel/clientas            Dueña: todas; profesional: clientas de sus citas
/panel/servicios           Solo dueña
/panel/equipo              Solo dueña
/panel/mensajes            Solo dueña
/panel/configuracion      Solo dueña
/superadmin               Solo administradora global
```

## Decisiones para mantenerlo sola

Un monolito, una base y una cola en PostgreSQL. No hay Redis, microservicios, un backend adicional, motor de campañas ni infraestructura de workers permanente. Los endpoints sirven únicamente a autenticación, cargas y cron; las mutaciones del producto usan Server Actions con validación y autorización propias.

El helper `tenant()` exige un UUID antes de producir filtros operativos. Los endpoints públicos jamás aceptan un `salonId` como autorización: lo resuelven del slug activo. El panel lo resuelve de la sesión y su membresía. La clienta usa un token aleatorio de alta entropía; ese token resuelve un salón antes de cualquier cambio.

La atomicidad cubre cita, detalle de servicios y cola. El envío al proveedor sucede después y conserva trazabilidad. Las respuestas externas ambiguas requieren revisión; no se promete exactamente una entrega cuando la API externa no puede garantizarla.

El sandbox usa un generador determinista respecto al día actual y no escribe datos. El mismo generador alimenta el seed opcional. No hay cuentas de demo con contraseñas compartidas en producción.

Fase 2 y Fase 3 no se activan automáticamente. El endpoint diario responde que las campañas no están habilitadas hasta aprobar esa fase.
