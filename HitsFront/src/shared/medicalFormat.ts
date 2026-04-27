import type { InspectionConclusion } from "../api/patient";

export function formatConclusion(value: InspectionConclusion) {
  if (value === "Recovery") return "Выздоровление";
  if (value === "Disease") return "Болезнь";
  if (value === "Death") return "Смерть";
  return value;
}

export function formatGender(value: unknown) {
  if (value === "Male") return "Мужчина";
  if (value === "Female") return "Женщина";
  return "—";
}
