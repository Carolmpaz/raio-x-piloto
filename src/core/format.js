/* Formatação pt-BR e conversão de datas no formato serial do Excel. Sem dependência de DOM. */

export const EPOCH = Date.UTC(1899, 11, 30);
export const DAY = 86400000;

export function ok(n) {
  return n !== null && n !== undefined && !isNaN(n) && isFinite(n);
}
export function fInt(n) {
  return ok(n) ? Math.round(n).toLocaleString("pt-BR") : "–";
}
export function fDec(n, d) {
  d = d === undefined ? 1 : d;
  return ok(n) ? n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "–";
}
export function fPct(n, d) {
  d = d || 0;
  return ok(n) ? (n * 100).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) + "%" : "–";
}

export function toDate(s) {
  return new Date(EPOCH + s * DAY);
}
export function dayOf(s) {
  return Math.floor(s + 1e-9);
}
export function fDay(s) {
  const d = toDate(dayOf(s));
  return String(d.getUTCDate()).padStart(2, "0") + "/" + String(d.getUTCMonth() + 1).padStart(2, "0");
}
export function fDayY(s) {
  return fDay(s) + "/" + toDate(dayOf(s)).getUTCFullYear();
}
/** Dia da semana com 0 = segunda e 6 = domingo. */
export function wd(s) {
  return (toDate(dayOf(s)).getUTCDay() + 6) % 7;
}
export function hourOf(s) {
  return Math.floor((s - dayOf(s)) * 24 + 1e-6);
}
export function isoOf(s) {
  return toDate(dayOf(s)).toISOString().slice(0, 10);
}
export function fromIso(v) {
  if (!v) return null;
  const p = v.split("-");
  return (Date.UTC(+p[0], +p[1] - 1, +p[2]) - EPOCH) / DAY;
}
export function serialFromParts(y, mo, d, h, mi) {
  return (Date.UTC(y, mo - 1, d, h || 0, mi || 0) - EPOCH) / DAY;
}

/** Normaliza texto para comparação: sem acentos, minúsculo, espaços colapsados. */
export function norm(s) {
  return String(s === null || s === undefined ? "" : s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Converte número serial, Date, "dd/mm/aaaa [hh:mm]" ou "aaaa-mm-dd[ hh:mm]" em serial do Excel. */
export function toSerial(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  if (v instanceof Date)
    return (
      (Date.UTC(v.getFullYear(), v.getMonth(), v.getDate(), v.getHours(), v.getMinutes(), v.getSeconds()) - EPOCH) / DAY
    );
  let m = String(v).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T]+(\d{1,2}):(\d{2}))?/);
  if (m) return serialFromParts(+m[3], +m[2], +m[1], +(m[4] || 0), +(m[5] || 0));
  m = String(v).match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (m) return serialFromParts(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0));
  return null;
}
export function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
}
export function mean(a) {
  return a.length
    ? a.reduce(function (x, y) {
        return x + y;
      }, 0) / a.length
    : NaN;
}
