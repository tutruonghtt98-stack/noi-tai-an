// Ngày được lưu dạng @db.Date (UTC 00:00). Mọi phép tính "hôm nay" phải dựa trên
// múi giờ của người dùng, rồi quy về chuỗi ISO yyyy-mm-dd.

export type ISODate = string; // "2026-10-19"

export function todayISO(timeZone = "Asia/Ho_Chi_Minh"): ISODate {
  return isoInZone(new Date(), timeZone);
}

export function isoInZone(d: Date, timeZone: string): ISODate {
  // en-CA cho định dạng yyyy-mm-dd
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Giờ:phút ("HH:mm") của một mốc thời gian, theo múi giờ chỉ định. */
export function timeInZone(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

export function hourInZone(timeZone: string, d = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hour12: false }).format(d),
  );
}

export function toDbDate(iso: ISODate): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function fromDbDate(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function isValidISO(s: unknown): s is ISODate {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = toDbDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fromDbDate(d);
}

export function dayOfWeek(iso: ISODate): number {
  return toDbDate(iso).getUTCDay();
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toDbDate(b).getTime() - toDbDate(a).getTime()) / 86_400_000);
}

export function rangeISO(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function startOfWeek(iso: ISODate, weekStartsOn = 1): ISODate {
  const diff = (dayOfWeek(iso) - weekStartsOn + 7) % 7;
  return addDays(iso, -diff);
}

export function monthBounds(year: number, month: number): { from: ISODate; to: ISODate } {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from, to: `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}` };
}

export function quarterOf(month: number): number {
  return Math.floor((month - 1) / 3) + 1;
}

/** Chuỗi "YYYY-MM-DDTHH:mm" (giờ địa phương, từ <input type="datetime-local">) → đúng mốc UTC,
 * diễn giải theo múi giờ của người dùng (không phải múi giờ máy chủ). */
export function zonedDateTimeToUTC(local: string, timeZone: string): Date {
  const [datePart, timePart] = local.split("T");
  const [y, mo, d] = (datePart ?? "").split("-").map(Number);
  const [h, mi] = (timePart ?? "00:00").split(":").map(Number);
  const asUTC = Date.UTC(y!, (mo ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(asUTC));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const hour = get("hour") % 24; // Intl trả "24" lúc nửa đêm thay vì "00"
  const asIfUTCInZone = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  const offset = asIfUTCInZone - asUTC;
  return new Date(asUTC - offset);
}

/** Mốc UTC → chuỗi "YYYY-MM-DDTHH:mm" theo múi giờ người dùng, để đổ vào <input type="datetime-local">. */
export function utcToZonedDateTimeInput(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

export function formatDate(iso: ISODate, locale: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "vi-VN", { timeZone: "UTC", ...opts }).format(
    toDbDate(iso),
  );
}
