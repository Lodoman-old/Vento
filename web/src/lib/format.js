const TZ = "America/Mexico_City";

export function fmtDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("es-MX", { timeZone: TZ });
}

export function fmtTime(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("es-MX", {
    hour: "2-digit", minute: "2-digit", timeZone: TZ, timeZoneName: "short",
  });
}

export function fmtDateTime(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("es-MX", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: TZ, timeZoneName: "short",
  });
}

export function fmtMoney(amount) {
  return Number(amount).toLocaleString("es-MX", {
    style: "currency", currency: "MXN", minimumFractionDigits: 2,
  });
}
