export function asText(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function toDisplayText(value: unknown, fallback = "—") {
  const text = asText(value).trim();
  return text || fallback;
}
