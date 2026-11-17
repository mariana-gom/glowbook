import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const TZ = "America/Bogota";
// Los formateadores son inmutables: se reutilizan en agendas grandes en lugar de crearlos por fila.
const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});
const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const timeFormatter = new Intl.DateTimeFormat("es-CO", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
export function money(value: number) {
  return currencyFormatter.format(value);
}
export function dayKey(date = new Date()) {
  return dayFormatter.format(date);
}
export function prettyDate(date: string | Date) {
  return dateFormatter.format(new Date(date));
}
export function clock(date: string | Date) {
  return timeFormatter.format(new Date(date));
}
export function bogotaDate(day: string, minute: number) {
  return new Date(`${day}T00:00:00-05:00`).getTime() + minute * 60000;
}
