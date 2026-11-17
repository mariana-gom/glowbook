import { createHash } from "node:crypto";
import type * as S from "@/db/schema";
import { bogotaDate, dayKey } from "./utils";
export const DEMO_SLUG = "nails-glam-studio";
export const demoId = (value: string) => {
  const h = createHash("sha256").update(`glowbook-demo:${value}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
export const defaultSettings: S.SalonSettings = {
  cancellationHours: 12,
  bookingDays: 45,
  minNoticeHours: 2,
  whatsapp: "573000000000",
  address: "Calle 85 # 12-34, Chicó",
  city: "Bogotá",
  description:
    "Un espacio para desconectarte, consentirte y volver a brillar. Belleza hecha con amor, a tu manera.",
  instagram: "https://instagram.com",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Chico+Bogota",
  heroUrl: "/images/salon.jpg",
  emailEnabled: true,
  whatsappEnabled: false,
  messages: {
    confirmation:
      "¡Hola, {nombre}! Tu momento en {salon} está reservado para {fecha}. Te esperamos. {enlace}",
    reminder24:
      "Tu cita en {salon} es mañana: {fecha}. Organiza tu visita aquí: {enlace}",
    reminder2: "¡Ya casi! Te esperamos en {salon} el {fecha}. {enlace}",
    thanks:
      "Gracias por visitarnos, {nombre}. Cuéntanos cómo estuvo tu experiencia: {enlace}",
    maintenance:
      "¡Es momento de renovar tu look, {nombre}! Reserva en {salon}: {enlace}",
    birthday: "¡Feliz cumpleaños, {nombre}! Con cariño, {salon}.",
    reactivation:
      "Te extrañamos, {nombre}. Vuelve a consentirte en {salon}: {enlace}",
  },
  whatsappTemplates: {},
};
const catalog: [string, string, number, number, number | null][] = [
  ["Manicure tradicional", "Manicure", 40, 25000, 7],
  ["Manicure semipermanente", "Manicure", 60, 55000, 21],
  ["Uñas en gel", "Manicure", 90, 85000, 21],
  ["Uñas acrílicas", "Manicure", 120, 110000, 21],
  ["Polygel", "Manicure", 100, 100000, 21],
  ["Kapping", "Manicure", 75, 70000, 21],
  ["Nail art", "Manicure", 30, 20000, null],
  ["Retiro de producto", "Manicure", 25, 15000, null],
  ["Pedicure tradicional", "Pedicure", 45, 30000, 15],
  ["Pedicure semipermanente", "Pedicure", 60, 60000, 21],
  ["Spa de pies", "Pedicure", 60, 65000, 30],
  ["Peinado social", "Cabello", 60, 80000, null],
  ["Cepillado", "Cabello", 45, 40000, null],
  ["Ondas", "Cabello", 45, 45000, null],
  ["Alisado / keratina", "Cabello", 180, 220000, 90],
  ["Botox capilar", "Cabello", 120, 160000, 60],
  ["Tinte", "Cabello", 120, 140000, 45],
  ["Mechas", "Cabello", 180, 260000, 90],
  ["Corte", "Cabello", 45, 45000, 60],
  ["Diseño de cejas", "Extras", 25, 25000, 21],
  ["Lifting de pestañas", "Extras", 60, 85000, 45],
  ["Depilación facial", "Extras", 30, 30000, 21],
  ["Maquillaje social", "Extras", 75, 120000, null],
  ["Mani + Pedi semipermanente", "Combos", 120, 105000, 21],
  ["Ritual spa de manos y pies", "Combos", 100, 95000, 30],
];
export type SalonData = {
  salon: typeof S.salons.$inferSelect;
  categories: (typeof S.serviceCategories.$inferSelect)[];
  services: (typeof S.services.$inferSelect)[];
  staff: (typeof S.staff.$inferSelect)[];
  staffServices: (typeof S.staffServices.$inferSelect)[];
  hours: (typeof S.workingHours.$inferSelect)[];
  timeOff: (typeof S.timeOff.$inferSelect)[];
  clients: (typeof S.clients.$inferSelect)[];
  appointments: (typeof S.appointments.$inferSelect)[];
  appointmentServices: (typeof S.appointmentServices.$inferSelect)[];
  reviews: (typeof S.reviews.$inferSelect)[];
  gallery: (typeof S.galleryPhotos.$inferSelect)[];
  demo: boolean;
  stats?: {
    totalClients: number;
    newClients: number;
    monthRevenue: number;
    completedCount: number;
    directoryCount: number;
  };
};
export function demoData(now = new Date()): SalonData {
  const salonId = demoId("salon");
  const salon: SalonData["salon"] = {
    id: salonId,
    slug: DEMO_SLUG,
    name: "Nails & Glam Studio",
    active: true,
    logoUrl: null,
    primaryColor: "#754c60",
    accentColor: "#b79867",
    settings: defaultSettings,
    createdAt: new Date("2026-01-01T12:00:00Z"),
  };
  const categories = [
    "Manicure",
    "Pedicure",
    "Cabello",
    "Extras",
    "Combos",
  ].map((name, sortOrder) => ({ id: demoId(name), salonId, name, sortOrder }));
  const services = catalog.map(
    ([name, category, duration, price, maintenanceDays], i) => ({
      id: demoId(`service-${i}`),
      salonId,
      categoryId: demoId(category),
      name,
      description: `${name} con productos profesionales y el cuidado que mereces. Incluye asesoría personalizada.`,
      duration,
      cleanup: 10,
      price,
      maintenanceDays,
      photoUrl: `/images/${category === "Cabello" ? "hair" : category === "Extras" ? "beauty" : "nails"}.jpg`,
      active: true,
    }),
  );
  const staff = ["Valentina Ríos", "Camila Torres", "Isabella López"].map(
    (name, i) => ({
      id: demoId(`staff-${i}`),
      salonId,
      userId: null,
      name,
      title: [
        "Nail artist · Manicure y pedicure",
        "Estilista · Color y cuidado capilar",
        "Beauty artist · Uñas y mirada",
      ][i],
      photoUrl: `/images/staff-${i}.jpg`,
      active: true,
    }),
  );
  const staffServices = staff.flatMap((p, i) =>
    services
      .filter((s) =>
        i === 1
          ? s.categoryId === demoId("Cabello")
          : s.categoryId !== demoId("Cabello"),
      )
      .map((s) => ({
        id: demoId(`${p.id}-${s.id}`),
        salonId,
        staffId: p.id,
        serviceId: s.id,
      })),
  );
  const hours = staff.flatMap((p) =>
    [1, 2, 3, 4, 5, 6].map((weekday) => ({
      id: demoId(`hour-${p.id}-${weekday}`),
      salonId,
      staffId: p.id,
      weekday,
      startMinute: 540,
      endMinute: 1140,
    })),
  );
  const firstNames = [
    "Laura",
    "Mariana",
    "Daniela",
    "Sofía",
    "Paula",
    "Catalina",
    "Andrea",
    "Natalia",
    "Sara",
    "Juliana",
    "Valeria",
    "Lucía",
    "Gabriela",
    "Carolina",
    "Ana",
    "Diana",
    "Alejandra",
    "Manuela",
    "Isabel",
    "Camila",
  ];
  const lastNames = ["Gómez", "Martínez", "Rodríguez", "López", "García"];
  const clients = Array.from({ length: 100 }, (_, i) => ({
    id: demoId(`client-${i}`),
    salonId,
    userId: null,
    name: `${firstNames[i % 20]} ${lastNames[Math.floor(i / 20)]}`,
    phone: `+57300000${String(i).padStart(4, "0")}`,
    email: `clienta${i}@example.invalid`,
    birthday: null,
    consentAt: now,
    marketingConsent: false,
    createdAt: new Date(now.getTime() - (i + 60) * 86400000),
  }));
  const appointments: SalonData["appointments"] = [];
  const appointmentServices: SalonData["appointmentServices"] = [];
  for (let d = -30; d < 30; d++) {
    const day = dayKey(new Date(now.getTime() + d * 86400000));
    if (new Date(`${day}T12:00:00-05:00`).getUTCDay() === 0) continue;
    staff.forEach((p, pi) =>
      [540, 720, 900].forEach((minute, si) => {
        const n = (d + 30) * 9 + pi * 3 + si;
        if (n % 5 === 0 || n % 17 === 3) return;
        const s =
          services[pi === 1 ? [12, 13, 18][si] : [0, 1, 8, 9, 5][n % 5]];
        const startsAt = new Date(bogotaDate(day, minute));
        const endsAt = new Date(+startsAt + s.duration * 60000);
        const id = demoId(`appointment-${n}`);
        const status =
          +endsAt < +now
            ? n % 17 === 0
              ? "no_show"
              : n % 13 === 0
                ? "cancelled"
                : "completed"
            : "confirmed";
        const client = clients[d > -7 ? n % 100 : n % 80];
        appointments.push({
          id,
          salonId,
          contact: {
            name: client.name,
            email: client.email,
            phone: client.phone,
          },
          clientId: client.id,
          staffId: p.id,
          startsAt,
          endsAt,
          busyUntil: new Date(+endsAt + s.cleanup * 60000),
          status,
          total: s.price,
          tokenHash: createHash("sha256")
            .update(`not-a-public-token-${n}`)
            .digest("hex"),
          version: 1,
          requestKey: `seed-${n}`,
          createdAt: new Date(+startsAt - 3 * 86400000),
        });
        appointmentServices.push({
          id: demoId(`as-${n}`),
          salonId,
          appointmentId: id,
          serviceId: s.id,
          name: s.name,
          price: s.price,
          duration: s.duration,
          cleanup: s.cleanup,
        });
      }),
    );
  }
  for (const c of clients) {
    const first = appointments
      .filter((a) => a.clientId === c.id)
      .sort((a, b) => +a.startsAt - +b.startsAt)[0];
    if (first)
      c.createdAt = new Date(Math.min(+now, +first.startsAt) - 2 * 86400000);
  }
  const reviews = appointments
    .filter((a) => a.status === "completed")
    .slice(0, 6)
    .map((a, i) => ({
      id: demoId(`review-${i}`),
      salonId,
      appointmentId: a.id,
      clientId: a.clientId,
      rating: i === 4 ? 4 : 5,
      comment: [
        "¡Mis uñas nunca se habían visto tan lindas! Vale es una artista. Me encantó poder reservar sin llamar.",
        "El lugar es hermoso, todo muy limpio y la atención increíble. Mi nuevo lugar favorito.",
        "Amé el resultado y la puntualidad. Un espacio para consentirse de verdad.",
      ][i % 3],
      author: clients.find((c) => c.id === a.clientId)!.name,
      published: true,
      createdAt: a.endsAt,
    }));
  const month = dayKey(now).slice(0, 7),
    completed = appointments.filter(
      (a) => a.status === "completed" && dayKey(a.startsAt).startsWith(month),
    );
  const stats = {
    totalClients: clients.length,
    newClients: clients.filter((c) => dayKey(c.createdAt).startsWith(month))
      .length,
    monthRevenue: completed.reduce((n, a) => n + a.total, 0),
    completedCount: completed.length,
    directoryCount: clients.length,
  };
  return {
    salon,
    categories,
    services,
    staff,
    staffServices,
    hours,
    timeOff: [],
    clients,
    appointments,
    appointmentServices,
    reviews,
    gallery: ["nails", "salon", "beauty", "hair"].map((name, i) => ({
      id: demoId(`gallery-${i}`),
      salonId,
      url: `/images/${name}.jpg`,
      caption: [
        "Detalles que enamoran",
        "Tu pausa favorita",
        "Belleza a tu manera",
        "Un nuevo look",
      ][i],
      sortOrder: i,
    })),
    demo: true,
    stats,
  };
}
