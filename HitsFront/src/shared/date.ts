export function formatDate(value: string | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU");
}

export function toIsoFromDate(value: string) {
  return new Date(value).toISOString();
}
