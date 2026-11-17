# GlowBook

Una plataforma para salones de belleza en Colombia, en un solo proyecto Next.js App Router + TypeScript. PostgreSQL en Neon, Drizzle, Better Auth, Tailwind, componentes shadcn/ui, Resend y Web Push estándar con VAPID. Idioma español, hora `America/Bogota` y valores enteros en COP.

**WhatsApp funciona mediante enlaces `wa.me`.** No hay llamadas a WhatsApp Business API, tokens de Meta, bots ni librerías no oficiales. El navegador prepara el texto; una persona pulsa Enviar en WhatsApp.

## Probar en Ghostty o cualquier terminal

Requiere Node.js 22 o superior.

```sh
cd /Users/marianagomez/dev/glowbook
npm ci
cp .env.example .env.local
npm run dev -- --port 3100
```

Abre http://localhost:3100/demo y entra como Dueña o Clienta. Si usas el puerto 3102, cambia `BETTER_AUTH_URL` a `http://localhost:3102` en `.env.local` y ejecuta `npm run dev -- --port 3102`. Mantén el terminal abierto; detén el servidor con Ctrl+C.

Sin `DATABASE_URL`, el demo es un sandbox con datos ficticios. Las reservas se simulan; los cambios administrativos no se guardan. Los botones de pendientes se marcan localmente durante esa visita y abren un chat ficticio; **no envíes mensajes a los contactos del demo**. Las notificaciones reales están deshabilitadas en él.

Rutas para probar, en partes pequeñas:

1. `/`: venta de GlowBook; `/demo`: entrada a las dos experiencias.
2. `/nails-glam-studio`: salón, catálogo de 25 servicios, tres profesionales, galería y reseñas.
3. `/nails-glam-studio/reservar`: servicios → profesional → disponibilidad → datos → botón **Confirmar por WhatsApp**.
4. `/panel/agenda`: día o semana, filtro profesional, resultado de citas y botones de WhatsApp.
5. `/panel/pendientes`: nuevas citas por confirmar, recordatorios, agradecimientos, mantenimiento, reactivación y cumpleaños.
6. `/panel/mensajes`: plantillas editables de WhatsApp y correo; cola automática.
7. `/panel/notificaciones`: instalación de la PWA y activación de Web Push por dispositivo.

El slug `nails-glam-studio` está reservado para el sandbox, incluso con Neon conectado. Usa otro slug para un negocio real. [Estructura y pantallas](docs/arquitectura.md); [esquema ejecutable](src/db/schema.ts).

## Actualizar una instalación existente

```sh
npm ci
npm run db:migrate
```

Las migraciones `0003` y `0004` agregan pendientes, dispositivos push, control diario y confirmación manual. Conservan las citas e historial; cancelan los WhatsApp automáticos antiguos y los recordatorios de dos horas. Los nuevos recordatorios por correo se programan para el lote del día anterior. **No uses `drizzle-kit push` en producción**: omitiría reglas SQL personalizadas.

No es necesario volver a ejecutar el seed ni borrar la base. Las nuevas plantillas tienen valores por defecto; puedes cambiarlas desde el panel. Conserva `BOOKING_TOKEN_SECRET`: permite reconstruir los enlaces privados de gestión para los mensajes preparados del equipo.

## Neon y primera administradora

1. Crea un proyecto PostgreSQL en Neon. Guarda su conexión **pooled con SSL** en `DATABASE_URL`. Usa una rama de base separada para desarrollo.
2. Define `BETTER_AUTH_URL` con el origen público final, sin barra al final. Genera tres secretos distintos con `openssl rand -hex 32`: `BETTER_AUTH_SECRET`, `BOOKING_TOKEN_SECRET` y `CRON_SECRET`. Nunca los publiques ni los compartas en chat.
3. Ejecuta `npm run db:migrate`. Incluye claves foráneas compuestas por salón y una restricción GiST que impide solapamientos, incluyendo limpieza.
4. Completa temporalmente `ADMIN_EMAIL`, `ADMIN_NAME` y `ADMIN_PASSWORD` (mínimo 12 caracteres) en `.env.local`; ejecuta `npm run admin:create` y retira `ADMIN_PASSWORD`.
5. Reinicia el servidor, entra en `/acceso` y abre `/superadmin`. El registro público con contraseña está deshabilitado.

La identidad de Better Auth es global; cada membresía asigna permisos por salón. Una dueña administra su salón. Una profesional consulta sus citas y clientas, prepara mensajes de sus citas y recibe los cambios de su agenda. La clienta reserva como invitada y gestiona la cita mediante un enlace privado. La superadmin crea negocios y cuentas, y activa o suspende salones.

Google es opcional: configura `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`, con callback `https://tu-dominio.com/api/auth/callback/google`. Una identidad sin membresía no recibe acceso al panel.

## Agregar un salón desde el panel

1. En `/superadmin`, crea el salón con slug único, contacto, ubicación y cuenta de la dueña. Una cuenta existente conserva su contraseña.
2. La dueña configura identidad, teléfono de WhatsApp, ubicación, reglas y canales de correo en **Configuración**.
3. En **Servicios**, crea categorías y define precios, duración, limpieza, foto y días para mantenimiento. Archivar conserva el historial.
4. En **Mi equipo**, crea profesionales, asigna servicios, jornadas y ausencias. Para acceso individual, crea la cuenta desde superadmin y vincula su correo al perfil.
5. En **Mensajes**, edita los textos. En **Clientas**, registra cumpleaños y autorización comercial únicamente cuando la clienta la haya dado. En Configuración elige cuántos días sin visita activan reactivación.
6. Configura Resend, el cron y Web Push. Prueba una reserva de staging y comparte `https://tu-dominio.com/tu-slug`.

Para una visita, una profesional debe poder realizar todos los servicios elegidos. Los servicios que requieren profesionales diferentes se reservan por separado.

Las imágenes se cargan con un store público de Vercel Blob y `BLOB_READ_WRITE_TOKEN`: JPG, PNG o WebP hasta 4 MB, desde una sesión de dueña. Copia la URL al logo, portada, servicio, galería o profesional. El optimizador acepta imágenes locales, Unsplash y `*.public.blob.vercel-storage.com`. [Créditos del demo](docs/imagenes.md).

## WhatsApp manual

`buildWhatsAppLink(phone, template, data)` en `src/lib/whatsapp.ts` normaliza el número colombiano y aplica `encodeURIComponent` al mensaje completo. Variables:

```text
{nombre} {servicio} {fecha} {hora} {profesional} {codigo} {enlace_reprogramar}
```

También se admiten `{salon}` y el alias `{enlace}` para compatibilidad. Los valores de variables no se reinterpretan como plantillas. Se rechazan números inválidos y variables desconocidas al guardar.

- Al terminar la reserva real, la clienta llega a `/gestionar/[token]` y ve **Confirmar por WhatsApp**, dirigido al número público del salón.
- La agenda ofrece **Confirmar**, **Recordar** y **Agradecer y pedir reseña**, dirigidos a la clienta. El agradecimiento requiere una cita completada.
- Al tocar un pendiente, una Server Action comprueba rol, salón, versión de la cita y consentimiento cuando corresponde. Guarda `marked_sent` con fecha y usuaria; luego abre el chat.
- “Marcado enviado” significa **acción registrada por la usuaria**, no entrega verificada. Si cierra el chat sin enviar, el sistema no puede saberlo. No se confirma entrega ni lectura en WhatsApp.
- Confirmar desde el panel registra la confirmación de la dueña. Abrir el chat de la clienta no la confirma en nombre del negocio.
- `sendWhatsApp()` vive en `src/lib/whatsapp-delivery.ts` y solo se invoca desde el servidor. Recibe una clave estable del mensaje y devuelve `{ mode: 'link', url }`; sus consumidoras también aceptan `{ mode: 'sent', providerId }`. Un plan premium futuro puede sustituir el adaptador sin reescribir plantillas ni botones. No hay proveedor API implementado ni habilitado.

### Pendientes de hoy

La creación de una cita inserta confirmación y recordatorio manual; completarla agrega agradecimiento. Reprogramar o cancelar invalida tareas anteriores. El cron agrega mantenimiento según el último servicio, reactivación según la última visita y cumpleaños según el día colombiano.

Mantenimiento, reactivación y cumpleaños exigen consentimiento comercial. Tener una reserva futura suprime mantenimiento y reactivación. Cada tarea tiene una clave única: volver a ejecutar el cron no genera copias y no reinicia los ítems marcados. Los pendientes vencidos que dejan de aplicar se descartan; los que vuelven a ser pertinentes pueden reabrirse si nunca fueron marcados enviados. La pantalla muestra hasta 300 ítems, priorizando los pendientes.

## Correos automáticos con Resend

Configura `RESEND_API_KEY`, `EMAIL_FROM` con un dominio verificado y `BETTER_AUTH_URL`. No se requieren credenciales de WhatsApp.

- **Clienta:** confirmación y enlace privado de gestión; recordatorio en el lote del día anterior; agradecimiento/reseña después de completar la cita.
- **Dueñas:** nueva cita, reprogramación, cancelación y resumen diario de la agenda. Se usa el correo de cada cuenta con membresía de dueña.
- Los dos canales se habilitan por separado en Configuración. Los mensajes ya en cola conservan su texto; las nuevas reservas usan las plantillas actualizadas.
- La cola guarda versión de cita, deduplicación, intentos, errores e identificador del proveedor. El envío vuelve a comprobar permisos, estado y suspensión del salón.
- Resend recibe una clave de idempotencia; no se reintenta fuera de su ventana. Los resultados ambiguos o procesos interrumpidos quedan `uncertain`, para revisión desde Mensajes.

El servicio respeta el modelo gratuito del proveedor, **con sus cuotas**; los límites son compartidos por todos los salones que usen la misma cuenta. “Enviado” representa aceptación por la API, no entrega o lectura en el buzón. No se han añadido webhooks de entrega.

## PWA y Web Push con VAPID

1. Genera las claves sin mostrarlas en la consola:

   ```sh
   npm run push:keys
   ```

   El comando guarda `NEXT_PUBLIC_VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` en `.env.local` con permisos privados. Se niega a rotar claves existentes. Configura `VAPID_SUBJECT` con un contacto real, por ejemplo `mailto:reservas@tu-dominio.com`.

2. Reinicia el servidor. En Vercel, transfiere las tres variables mediante su gestor privado y **reconstruye** la aplicación: la clave pública se incorpora al bundle del navegador. Nunca publiques la clave privada.
3. La dueña y cada profesional entran a **Mi aplicación** (`/panel/notificaciones`). Desde allí pueden instalar la PWA y tocar **Activar notificaciones**. La aplicación no pide permiso al cargar una página.
4. En iPhone, primero **Compartir → Agregar a Inicio**, abre la aplicación desde su icono y entonces activa las notificaciones. En otros navegadores usa Instalar aplicación o Agregar a pantalla de inicio. La disponibilidad depende de navegador y sistema.

En producción se requiere **HTTPS**. `localhost` permite pruebas de service worker; un celular que abre una IP HTTP de tu computador no equivale a localhost seguro.

Los avisos se crean dentro de la transacción de la cita y se procesan después de confirmar esa transacción. Las dueñas reciben novedades del salón y cada profesional únicamente las de su agenda. Se revalidan membresías antes de enviar. Las suscripciones caducadas (404/410) se eliminan y se desconecta el dispositivo al cerrar sesión. Un endpoint se asocia a una cuenta y salón activos por dispositivo.

La pantalla bloqueada recibe solo una novedad genérica, sin nombre, celular ni servicio de la clienta. Las etiquetas estables reemplazan avisos del mismo evento. Como cualquier Web Push, la aceptación por el servicio no garantiza recepción inmediata en un dispositivo sin conexión, con ahorro de batería o permisos retirados.

`public/sw.js` almacena únicamente la pantalla pública sin conexión y sus iconos. **No almacena en caché agenda, clientas, respuestas autenticadas ni tokens.** La aplicación necesita conexión para reservar o consultar datos. No hay un backend adicional ni un servicio de notificaciones de pago obligatorio.

## Cron diario en Vercel

`vercel.json` registra una sola tarea:

```json
{ "path": "/api/cron/daily", "schedule": "0 12 * * *" }
```

12:00 UTC corresponde a 07:00 en Colombia. El plan puede aplicar variaciones de horario. La ruta acepta GET o POST y exige `Authorization: Bearer <CRON_SECRET>` con un secreto de al menos 32 caracteres. Vercel añade esa cabecera a su cron cuando la variable está configurada.

Cada ejecución:

1. Reclama un registro único `(salonId, día colombiano)`.
2. En una transacción prepara pendientes y el resumen; si falla, revierte también la marca diaria y una nueva llamada puede retomarla.
3. Procesa correos y notificaciones pendientes con `FOR UPDATE SKIP LOCKED`, reintentos acotados y trazabilidad.
4. Devuelve salones preparados, fallidos y pendientes, tareas planeadas, aceptaciones y errores. Repetir una llamada continúa el trabajo sin duplicar resúmenes.

**Una ejecución diaria no puede entregar un recordatorio exactamente 24 horas antes de todas las citas.** Aquí “24 h” es la plantilla de recordatorio del día anterior, procesada en el lote de la mañana. Si la reserva se crea después del lote que le habría correspondido, su confirmación ya contiene fecha y enlace y no se añade un recordatorio inmediato redundante.

Las confirmaciones y avisos de cambios intentan procesarse inmediatamente tras guardar la cita. El cron retoma los pendientes. `/api/cron/process` queda disponible como procesador protegido opcional, en lotes de cuatro: puedes llamarlo más frecuentemente para reducir esperas y reintentar avisos sin esperar al día siguiente. No está programado por defecto. Para una precisión mayor habrá que cambiar la frecuencia y la programación de recordatorios.

La preparación y el envío tienen presupuestos de tiempo para respetar los límites de funciones. Si el volumen deja pendientes, se observa en la respuesta y la cola del panel; llama de nuevo al procesador o aumenta la frecuencia en un plan adecuado. Los planes gratuitos no ofrecen capacidad ilimitada. Vercel Hobby tiene restricciones de uso comercial: revisa un plan permitido antes de vender la plataforma.

## Desplegar en Vercel + Neon

1. Sube este repositorio a tu proveedor Git, crea un proyecto Vercel Next.js y usa Node.js 22 o superior, build `npm run build`.
2. Crea una base Neon de producción. Añade las variables correspondientes de `.env.example` en Production. No copies `ADMIN_PASSWORD`, `ALLOW_DEMO_SEED=true` ni variables de pruebas a producción.
3. Desde un entorno seguro con esa conexión ejecuta `npm run db:migrate` **antes** de servir la versión que depende del esquema nuevo. Las migraciones no se ejecutan durante cada build.
4. Configura URL final, remitente Resend, Blob y, si se usa, Google OAuth. Crea la superadmin y el salón.
5. Configura VAPID y `CRON_SECRET` en Vercel antes de reconstruir y desplegar. Comprueba el cron diario en el panel de Vercel y que una llamada sin secreto devuelva 401.
6. Define `NEXT_PUBLIC_SALES_WHATSAPP` (57 + diez dígitos) para el botón comercial. Sin ese número, la página ofrece explorar el demo.
7. En staging, con contactos propios autorizados, prueba reservar, reprogramar, cancelar, completar, reseñar, abrir cada enlace y recibir los correos y push. En un celular real verifica instalación y permisos.
8. Publica la política de tratamiento de datos y la información del negocio antes de admitir clientas reales.

No se han conectado ni desplegado cuentas externas automáticamente. El demo y las pruebas no envían mensajes reales. La entrega efectiva en Resend y en celulares reales requiere esas credenciales y pruebas de staging.

## Seed y comprobaciones

El demo usa el mismo generador que el seed: 25 servicios, tres profesionales, 100 clientas, dos meses de citas, reseñas, métricas y casos de seguimiento. Para una base de desarrollo establece `ALLOW_DEMO_SEED=true` y ejecuta `npm run db:seed`. Es transaccional y se omite si el slug ya existe. No crea credenciales públicas ni envíos a los contactos ficticios.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
```

Para incluir PostgreSQL real en `npm test`, define `TEST_DATABASE_URL` hacia una base **vacía, aislada y terminada en `glowbook_test`**. La suite no borra tablas para prepararse. Verifica migraciones, seed, carreras de reservas, claves entre salones, idempotencia de pendientes y resúmenes y selección de destinatarias. Las pruebas de Web Push validan suscripciones y preparación, sin contactar los servicios push.

Las pruebas Playwright arrancan la versión de producción sin Neon en el puerto 3101. Comprueban reserva, límites del demo, apertura codificada de WhatsApp, PWA y pantalla sin conexión en escritorio y móvil. Interceptan WhatsApp para no contactar sus servidores ni sus contactos ficticios.

Para cambios de esquema: edita `src/db/schema.ts`, genera con `npm run db:generate`, revisa SQL y prueba en una rama de Neon antes de migrar producción. Conserva las restricciones SQL de horarios de `0001_booking_guards.sql`. Las consultas operativas usan `tenant(salonId).where(...)`; autenticación, superadmin, resolución de tokens y trabajadores globales son los accesos globales deliberados.

El directorio de clientas tiene páginas de 50, la agenda consulta un intervalo y los totales usan agregados SQL. El historial individual todavía carga todas sus visitas; conviene paginarlo cuando crezca. La protección de reservas públicas incluye validación, honeypot y un límite de cinco citas futuras por contacto; no sustituye una protección anti-bot o verificación de celular completa.

### Ramas y commits

Funcionalidad: `feat/descripcion`, commit `feat: descripción`. Corrección: `fix/descripcion`, commit `fix: descripción`. Esta ampliación vive en `feat/whatsapp-pwa-notificaciones`, sobre `feat/glowbook-mvp`.

Se implementaron los seguimientos manuales solicitados. Puntos, referidos, lista de espera, pagos, suscripciones y envío por API oficial premium siguen pendientes de aprobación e implementación.

Referencias oficiales: [Next.js PWA](https://nextjs.org/docs/app/guides/progressive-web-apps), [Web Push](https://github.com/web-push-libs/web-push), [Web Push en iPhone](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Resend: idempotencia](https://resend.com/docs/dashboard/emails/idempotency-keys), [Vercel Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing).
