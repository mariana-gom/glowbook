import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  jsonb,
  unique,
  index,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const salonId = () =>
  uuid("salon_id")
    .notNull()
    .references(() => salons.id);
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export type MessageKind =
  | "confirmation"
  | "reminder24"
  | "reminder2"
  | "thanks"
  | "maintenance"
  | "birthday"
  | "reactivation";
export type SalonSettings = {
  cancellationHours: number;
  bookingDays: number;
  minNoticeHours: number;
  whatsapp: string;
  address: string;
  city: string;
  description: string;
  instagram: string;
  mapsUrl: string;
  heroUrl: string;
  messages: Record<MessageKind, string>;
  whatsappTemplates: Partial<Record<MessageKind, string>>;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
};
export const salons = pgTable("salons", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").notNull().default("#754c60"),
  accentColor: text("accent_color").notNull().default("#b79867"),
  settings: jsonb("settings").$type<SalonSettings>().notNull(),
  createdAt: createdAt(),
});
// La identidad es global. Las membresías asignan permisos independientes en cada salón.
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("client"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    salonId: salonId(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").$type<"owner" | "staff" | "client">().notNull(),
  },
  (t) => [unique().on(t.salonId, t.userId)],
);
export const serviceCategories = pgTable(
  "service_categories",
  {
    id: id(),
    salonId: salonId(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [unique().on(t.salonId, t.id)],
);
export const services = pgTable(
  "services",
  {
    id: id(),
    salonId: salonId(),
    categoryId: uuid("category_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    duration: integer("duration").notNull(),
    cleanup: integer("cleanup").notNull().default(10),
    price: integer("price").notNull(),
    maintenanceDays: integer("maintenance_days"),
    photoUrl: text("photo_url"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [
    unique().on(t.salonId, t.id),
    foreignKey({
      columns: [t.salonId, t.categoryId],
      foreignColumns: [serviceCategories.salonId, serviceCategories.id],
    }),
    check(
      "service_values",
      sql`${t.duration} > 0 AND ${t.cleanup} >= 0 AND ${t.price} >= 0`,
    ),
  ],
);
export const staff = pgTable(
  "staff",
  {
    id: id(),
    salonId: salonId(),
    userId: text("user_id").references(() => users.id),
    name: text("name").notNull(),
    title: text("title").notNull(),
    photoUrl: text("photo_url"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [unique().on(t.salonId, t.id)],
);
export const staffServices = pgTable(
  "staff_services",
  {
    id: id(),
    salonId: salonId(),
    staffId: uuid("staff_id").notNull(),
    serviceId: uuid("service_id").notNull(),
  },
  (t) => [
    unique().on(t.salonId, t.staffId, t.serviceId),
    foreignKey({
      columns: [t.salonId, t.staffId],
      foreignColumns: [staff.salonId, staff.id],
    }),
    foreignKey({
      columns: [t.salonId, t.serviceId],
      foreignColumns: [services.salonId, services.id],
    }),
  ],
);
export const workingHours = pgTable(
  "working_hours",
  {
    id: id(),
    salonId: salonId(),
    staffId: uuid("staff_id").notNull(),
    weekday: integer("weekday").notNull(),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.salonId, t.staffId],
      foreignColumns: [staff.salonId, staff.id],
    }),
    check(
      "hours_range",
      sql`${t.weekday} BETWEEN 0 AND 6 AND ${t.startMinute} >= 0 AND ${t.endMinute} <= 1440 AND ${t.endMinute} > ${t.startMinute}`,
    ),
  ],
);
export const timeOff = pgTable(
  "time_off",
  {
    id: id(),
    salonId: salonId(),
    staffId: uuid("staff_id").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    reason: text("reason"),
  },
  (t) => [
    foreignKey({
      columns: [t.salonId, t.staffId],
      foreignColumns: [staff.salonId, staff.id],
    }),
    check("time_off_range", sql`${t.endsAt} > ${t.startsAt}`),
  ],
);
export const clients = pgTable(
  "clients",
  {
    id: id(),
    salonId: salonId(),
    userId: text("user_id").references(() => users.id),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull(),
    birthday: text("birthday"),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
    marketingConsent: boolean("marketing_consent").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.salonId, t.id), unique().on(t.salonId, t.phone)],
);
export const appointments = pgTable(
  "appointments",
  {
    id: id(),
    salonId: salonId(),
    clientId: uuid("client_id").notNull(),
    staffId: uuid("staff_id").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    busyUntil: timestamp("busy_until", { withTimezone: true }).notNull(),
    status: text("status")
      .$type<"confirmed" | "completed" | "cancelled" | "no_show">()
      .notNull()
      .default("confirmed"),
    contact: jsonb("contact")
      .$type<{ name: string; email: string; phone: string }>()
      .notNull(),
    total: integer("total").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    version: integer("version").notNull().default(1),
    requestKey: text("request_key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique().on(t.salonId, t.id),
    unique().on(t.salonId, t.requestKey),
    index("appointment_agenda").on(t.salonId, t.startsAt),
    foreignKey({
      columns: [t.salonId, t.clientId],
      foreignColumns: [clients.salonId, clients.id],
    }),
    foreignKey({
      columns: [t.salonId, t.staffId],
      foreignColumns: [staff.salonId, staff.id],
    }),
    check(
      "appointment_range",
      sql`${t.startsAt} < ${t.endsAt} AND ${t.endsAt} <= ${t.busyUntil}`,
    ),
  ],
);
export const appointmentServices = pgTable(
  "appointment_services",
  {
    id: id(),
    salonId: salonId(),
    appointmentId: uuid("appointment_id").notNull(),
    serviceId: uuid("service_id").notNull(),
    name: text("name").notNull(),
    price: integer("price").notNull(),
    duration: integer("duration").notNull(),
    cleanup: integer("cleanup").notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.salonId, t.appointmentId],
      foreignColumns: [appointments.salonId, appointments.id],
    }),
    foreignKey({
      columns: [t.salonId, t.serviceId],
      foreignColumns: [services.salonId, services.id],
    }),
  ],
);
export const scheduledMessages = pgTable(
  "scheduled_messages",
  {
    id: id(),
    salonId: salonId(),
    appointmentId: uuid("appointment_id"),
    clientId: uuid("client_id").notNull(),
    kind: text("kind").$type<MessageKind>().notNull(),
    channel: text("channel").$type<"email" | "whatsapp">().notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: text("status")
      .$type<
        "pending" | "processing" | "sent" | "cancelled" | "failed" | "uncertain"
      >()
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    firstAttemptAt: timestamp("first_attempt_at", { withTimezone: true }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    providerId: text("provider_id"),
    lastError: text("last_error"),
    payload: jsonb("payload")
      .$type<{
        name: string;
        email: string;
        phone: string;
        salon: string;
        text: string;
        managementUrl: string;
        template?: string;
      }>()
      .notNull(),
  },
  (t) => [
    unique().on(t.salonId, t.dedupeKey),
    index("message_due").on(t.status, t.scheduledAt),
    foreignKey({
      columns: [t.salonId, t.appointmentId],
      foreignColumns: [appointments.salonId, appointments.id],
    }),
    foreignKey({
      columns: [t.salonId, t.clientId],
      foreignColumns: [clients.salonId, clients.id],
    }),
  ],
);
export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    salonId: salonId(),
    appointmentId: uuid("appointment_id").notNull(),
    clientId: uuid("client_id").notNull(),
    rating: integer("rating").notNull(),
    comment: text("comment").notNull(),
    author: text("author").notNull(),
    published: boolean("published").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    unique().on(t.salonId, t.appointmentId),
    foreignKey({
      columns: [t.salonId, t.appointmentId],
      foreignColumns: [appointments.salonId, appointments.id],
    }),
    foreignKey({
      columns: [t.salonId, t.clientId],
      foreignColumns: [clients.salonId, clients.id],
    }),
    check("rating_range", sql`${t.rating} BETWEEN 1 AND 5`),
  ],
);
export const galleryPhotos = pgTable("gallery_photos", {
  id: id(),
  salonId: salonId(),
  url: text("url").notNull(),
  caption: text("caption").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});
// Reservadas para Fase 2; no se ejecutan campañas sin habilitar esa fase.
export const loyaltyTransactions = pgTable(
  "loyalty_transactions",
  {
    id: id(),
    salonId: salonId(),
    clientId: uuid("client_id").notNull(),
    points: integer("points").notNull(),
    reason: text("reason").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.salonId, t.clientId],
      foreignColumns: [clients.salonId, clients.id],
    }),
  ],
);
export const promotions = pgTable(
  "promotions",
  {
    id: id(),
    salonId: salonId(),
    code: text("code").notNull(),
    discountPercent: integer("discount_percent").notNull(),
    active: boolean("active").notNull().default(false),
    endsAt: timestamp("ends_at", { withTimezone: true }),
  },
  (t) => [
    unique().on(t.salonId, t.code),
    check("discount_range", sql`${t.discountPercent} BETWEEN 1 AND 100`),
  ],
);
