# GlowBook

Plataforma multi-salón para negocios de belleza en Colombia. Un solo proyecto **Next.js App Router + TypeScript**, Server Components y Server Actions; PostgreSQL en Neon con Drizzle, Better Auth, Tailwind y componentes shadcn/ui. Hora fija `America/Bogota`, valores enteros en COP.

## Probar en partes pequeñas

Requiere Node.js 22 o superior y npm. El repositorio incluye `package-lock.json`.

```sh
npm ci
cp .env.example .env.local
npm run dev -- --port 3100
```

Sin `DATABASE_URL` puedes probar de inmediato:

1. **Venta:** http://localhost:3100 — propuesta, beneficios, demo y plan de lanzamiento.
2. **Demo:** http://localhost:3100/demo — un clic como Dueña o Clienta.
3. **Salón público:** http://localhost:3100/nails-glam-studio — catálogo, galería, equipo y reseñas.
4. **Reserva:** selecciona servicios → profesional → horario realista → datos → confirmación simulada.
5. **Panel:** entra como Dueña desde `/demo`; visita agenda, clientas, servicios, equipo, mensajes y configuración.

El demo está aislado: genera datos ficticios, no guarda cambios, no reserva cupos reales y no envía mensajes. El slug `nails-glam-studio` está reservado para él, incluso con Neon conectado. Usa un slug distinto para un negocio real. No hay contraseñas públicas que den acceso a datos reales.

El inventario de carpetas, entidades, pantallas y decisiones está en [docs/arquitectura.md](docs/arquitectura.md). El esquema ejecutable está en [src/db/schema.ts](src/db/schema.ts).

## Conectar Neon y crear la primera administradora

1. Crea un proyecto PostgreSQL en Neon y copia su conexión **pooled** con SSL en `DATABASE_URL` dentro de `.env.local`. Para pruebas usa una rama de base separada de producción.
2. Configura `BETTER_AUTH_URL` y genera tres secretos **distintos** con `openssl rand -hex 32`: `BETTER_AUTH_SECRET`, `BOOKING_TOKEN_SECRET` y `CRON_SECRET`. No los compartas en chat ni los subas a Git.
3. Ejecuta las migraciones versionadas:

   ```sh
   npm run db:migrate
   ```

   Incluyen `btree_gist`, claves foráneas compuestas por salón y la exclusión de horarios. **No uses `drizzle-kit push` en producción**: omite la protección SQL personalizada contra solapamientos.

4. En `.env.local`, completa temporalmente `ADMIN_EMAIL`, `ADMIN_NAME` y `ADMIN_PASSWORD` (mínimo 12 caracteres). Ejecuta:

   ```sh
   npm run admin:create
   ```

5. Elimina `ADMIN_PASSWORD` del entorno. Reinicia Next, entra en `/acceso` y abre `/superadmin`. El registro público con contraseña está deshabilitado.

Las cuentas de Better Auth son globales. Las membresías contienen `salonId` y asignan el rol independiente de dueña, profesional o clienta. El rol global `superadmin` solo se establece en el bootstrap; ningún formulario público puede asignarlo. La reserva como invitada no exige cuenta.

### Seed de PostgreSQL

El demo sin credenciales usa el mismo generador que el script de seed. Para cargar los datos en una **base de desarrollo**, establece `ALLOW_DEMO_SEED=true` y ejecuta:

```sh
npm run db:seed
```

Genera 3 profesionales, 25 servicios, 100 clientas, dos meses de citas sin solapamientos, reseñas e historial. Las fechas se calculan respecto al día de ejecución. El seed es transaccional y se omite si el slug ya existe: no borra datos ni crea mensajes para los contactos ficticios. Su página pública continúa siendo un sandbox independiente.

## Agregar un salón nuevo, sin editar código

1. Entra a `/superadmin`, abre **Crear un salón** y define nombre, slug, contacto, ubicación y cuenta de la dueña. Una cuenta existente conserva su contraseña.
2. La dueña inicia sesión. En **Configuración** actualiza presentación, colores, logo, portada, ubicación, contacto y reglas de reserva.
3. En **Servicios**, configura categorías, duración, precio, limpieza y foto. Archivar un servicio conserva el historial y lo retira de reservas nuevas.
4. En **Mi equipo**, crea profesionales, asigna todos los servicios que realiza cada una y establece sus jornadas semanales. Registra vacaciones y descansos mediante ausencias; los bloqueos que cruzan citas existentes se rechazan.
5. Para acceso de una profesional, crea su cuenta desde superadmin y vincula su correo en **Mi equipo**. Solo podrá consultar sus citas y clientas, y registrar resultados de sus citas. La configuración del negocio exige rol de dueña.
6. Configura **Mensajes** y habilita los canales solo después de completar sus credenciales. Las credenciales de infraestructura viven en el entorno del despliegue; los textos y reglas del negocio se editan en el panel.
7. Prueba una reserva y comparte `https://tu-dominio.com/slug-del-salon`. El panel de superadmin permite suspenderla. Suspender bloquea la página, nuevas reservas y los mensajes pendientes.

Una profesional debe poder realizar **todos** los servicios elegidos para una visita. Si se requiere cambiar de profesional entre servicios, se crean reservas separadas. El MVP no implementa citas con varios profesionales dentro de la misma visita.

## Autenticación e imágenes

- **Email y contraseña:** Better Auth persiste usuarios, cuentas y sesiones en Neon. Cada Server Action vuelve a comprobar el rol y el salón.
- **Google:** configura `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`; agrega `https://tu-dominio.com/api/auth/callback/google` a los redirect URI del cliente OAuth y el equivalente de localhost para desarrollo. Una identidad sin membresía no recibe acceso al panel.
- **Imágenes:** crea un store **público** de Vercel Blob y define `BLOB_READ_WRITE_TOKEN`. En Configuración carga JPG, PNG o WebP de hasta 4 MB y copia la URL al campo correspondiente. La carga exige una sesión de dueña. El optimizador admite imágenes locales, Unsplash y `*.public.blob.vercel-storage.com`.
- Las fotos incluidas son recursos de demostración de Unsplash; no representan negocios, profesionales ni reseñas reales. [Créditos](docs/imagenes.md).

## Mensajes automáticos y garantía de entrega

Al crear una cita, la misma transacción guarda los servicios contratados y su cola de confirmación, recordatorios de 24 h y 2 h y agradecimiento con reseña. Los recordatorios cuyo momento ya pasó no se crean. El agradecimiento se envía después de marcar la cita como completada; se espera hasta 48 h y luego se descarta si no se completa.

Al reprogramar, se anulan mensajes pendientes/en proceso y se crea una versión nueva de la cola. Al cancelar o marcar inasistencia se anulan los futuros. La clienta recibe un enlace aleatorio de gestión, almacenado como hash en la cita. El enlace permite cambiar dentro de las reglas, cancelar y dejar una reseña después de completar la visita. Las reseñas requieren publicación de la dueña.

`GET` o `POST /api/cron/process` exige `Authorization: Bearer <CRON_SECRET>`. Reclama hasta ocho mensajes por ejecución con `FOR UPDATE SKIP LOCKED`, envía dos en paralelo y registra estado, intentos, fecha de envío e identificador del proveedor. Revisa nuevamente la cita y el salón bajo bloqueo antes de enviar. Hay hasta cinco intentos con espera exponencial para errores recuperables. Los procesos abandonados pasan a `uncertain`; el panel permite resolverlos después de comprobar el proveedor.

**Idempotencia no equivale a entrega exactamente una vez en sistemas externos.** Las claves únicas y bloqueos evitan que dos cron procesen la misma fila a la vez. Resend recibe una clave de idempotencia y no se reintenta fuera de su ventana de 24 horas. Meta no garantiza una clave equivalente: un timeout o respuesta ambigua queda en `uncertain`, sin reenvío automático. Si el proveedor acepta un mensaje y el proceso muere antes de registrar el resultado, también se revisa manualmente. Esto prioriza evitar duplicados, a costa de posibles entregas pendientes de revisión.

### Resend

Configura `RESEND_API_KEY` y un `EMAIL_FROM` de dominio verificado. La plantilla React Email está en `src/emails/appointment.tsx`. La confirmación intenta procesar la cola después de guardar la reserva; si falla, la retoma el cron. La aplicación no considera un mensaje enviado solo porque el proveedor lo aceptó para procesamiento: `sent` representa aceptación por la API, no lectura ni entrega al dispositivo. No se han implementado webhooks de entrega en Fase 1.

### WhatsApp Cloud API

Configura `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` y una versión soportada en `WHATSAPP_API_VERSION`. Las credenciales son compartidas por la plataforma y el canal usa un solo número emisor de Meta. Los salones conservan su contacto público independiente. **Un número emisor de Meta distinto por salón requiere ampliar el almacenamiento de credenciales antes de ofrecer esa modalidad.**

Todo envío pasa por `sendWhatsApp()` en `src/lib/messages.tsx`. Crea y aprueba en Meta las plantillas de utilidad en idioma `es_CO`. El contrato del adaptador espera dos parámetros de cuerpo: texto y enlace. Incluye texto estático en la plantilla, por ejemplo “Información de tu cita: {{1}}. Gestiona tu visita: {{2}}”; su aprobación depende de Meta. Guarda los nombres aprobados en Mensajes y habilita el canal en Configuración. Los textos pendientes no cambian retroactivamente al editar una plantilla.

### Cron en Vercel

`vercel.json` incluye dos ejecuciones diarias compatibles con la frecuencia de Hobby: cola a las 12:00 UTC (07:00 Colombia) y gancho diario a las 13:00 UTC (08:00 Colombia). **Una vez al día no sirve para recordatorios puntuales**.

Para el MVP usa **cron-job.org cada 10 o 15 minutos** apuntando a `https://tu-dominio.com/api/cron/process`, método GET o POST, cabecera `Authorization: Bearer <CRON_SECRET>`. No pongas el secreto en la URL. Si tienes Deployment Protection, permite el acceso del programador o usa un dominio de producción accesible. El plan gratuito externo puede tener retrasos y límites; los recordatorios se envían en la siguiente ejecución y no a un segundo exacto.

En un plan Vercel que permita mayor frecuencia, cambia solo el horario de `/api/cron/process` a `*/10 * * * *`. Al crecer el volumen, programa cada minuto y observa el número de pendientes; el tamaño de lote es ocho para mantener tiempos acotados. Ejecuciones concurrentes son seguras, pero los límites de Resend y Meta siguen aplicando. Hobby tiene restricciones de uso comercial: elige un plan permitido para vender la plataforma.

`/api/cron/daily` está protegido pero no ejecuta campañas en Fase 1. Su respuesta indica `campaignsEnabled: false`. Mantenimiento, reactivación, cumpleaños, puntos, referidos y lista de espera pertenecen a Fase 2 y requieren aprobación antes de implementarse.

## Desplegar en Vercel + Neon

1. Guarda este repositorio en tu proveedor Git y crea un proyecto Vercel con framework Next.js. El build es `npm run build`; Node.js 22 o superior.
2. Usa una base Neon de producción y añade las variables de `.env.example` que correspondan al entorno Production. Nunca copies `ADMIN_PASSWORD`, `TEST_DATABASE_URL` o `ALLOW_DEMO_SEED=true` a producción.
3. Ejecuta `npm run db:migrate` una sola vez por versión desde un entorno seguro con la conexión de producción. Hazlo antes de servir código que dependa de la migración. No se aplica automáticamente durante cada build.
4. Configura el dominio final en `BETTER_AUTH_URL`, los redirect URI de Google y el dominio remitente de Resend. Crea el almacén público de Blob.
5. Crea la cuenta superadmin con el script en un entorno seguro, retira la contraseña temporal y configura el primer salón desde el panel.
6. Define `NEXT_PUBLIC_SALES_WHATSAPP` para el botón comercial “Lo quiero para mi salón” (57 + diez dígitos). Sin ese número, la página ofrece explorar el demo.
7. Configura el cron frecuente externo o un plan Vercel adecuado; confirma que el endpoint rechace solicitudes sin el secreto y que procese una reserva de prueba autorizada.
8. Antes de abrir al público, completa la política de tratamiento de datos de tu negocio, confirma los remitentes y plantillas aprobados y prueba en un entorno de staging: reservar, reprogramar, cancelar, completar y publicar reseña.

No se ha desplegado este repositorio ni conectado cuentas externas automáticamente. El código de producción necesita las credenciales de tu infraestructura y una prueba de extremo a extremo con esos proveedores.

## Comprobar y mantener

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
npm audit
```

`npm test` ejecuta las pruebas de disponibilidad; omite la suite PostgreSQL si no hay `TEST_DATABASE_URL`. Para ejecutarla crea una base vacía, aislada, cuyo nombre termine en `glowbook_test`, y define su conexión en esa variable. La prueba aplica las migraciones reales y verifica seed, exclusión de intervalos, carreras concurrentes, claves entre salones, rollback y deduplicación. Se niega a borrar o reutilizar una base con tablas.

Las pruebas Playwright requieren `npx playwright install chromium` y un build previo. Arrancan la app en el puerto 3101 sin Neon; comprueban el demo, sus permisos, una reserva en cuatro pasos, el endpoint protegido y el diseño móvil. No envían mensajes ni crean citas reales.

Para cambiar el esquema: edita `src/db/schema.ts`, ejecuta `npm run db:generate`, revisa el SQL, prueba en una rama de Neon y aplica la migración. Las reglas PostgreSQL personalizadas están en `0001_booking_guards.sql` y deben conservarse. Las consultas operativas usan `tenant(salonId).where(...)`; los únicos accesos globales permitidos son autenticación, administración de plataforma, resolución de tokens aleatorios y el trabajador de cola, que fija luego el salón.

El directorio de clientas tiene páginas de 50 registros; la agenda consulta su intervalo y la portada del panel usa agregados SQL para totales. El historial individual conserva todas las visitas; para salones con historiales muy grandes será necesario paginar también ese historial. El control de abuso inicial incluye validación, honeypot y límite de cinco reservas futuras por contacto; no sustituye verificación de celular ni protección anti-bot avanzada.

### Regla `feat` / `fix`

- Funcionalidad: rama `feat/descripcion-corta`, commit `feat: descripción`.
- Corrección: rama `fix/descripcion-corta`, commit `fix: descripción`.
- Una modificación pequeña y comprobable por commit. No mezclar migraciones destructivas con cambios de interfaz.
- Esta primera entrega vive en `feat/glowbook-mvp`.

## Alcance por fases

Fase 1: venta, salón público, reserva, autogestión, autenticación, agenda, clientas, catálogo, profesionales, horarios, ausencias, identidad, cola de mensajes, reseñas, imágenes y superadmin. El demo permite probar el producto sin credenciales; las integraciones reales requieren configuración y validación en staging.

Fases 2 y 3: **no implementadas ni habilitadas**. Hay campos de mantenimiento y tablas de puntos/promociones preparados, sin campañas ni cobros. Anticipos, Wompi/Mercado Pago, regalos y suscripciones quedan para una fase posterior aprobada.

Referencias oficiales: [Better Auth + Drizzle](https://better-auth.com/docs/adapters/drizzle), [driver Neon](https://neon.com/docs/serverless/serverless-driver), [frecuencia de Vercel Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing), [plan Hobby](https://vercel.com/docs/plans/hobby), [idempotencia de Resend](https://resend.com/docs/dashboard/emails/idempotency-keys).
