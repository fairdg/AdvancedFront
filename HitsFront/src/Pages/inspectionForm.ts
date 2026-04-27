import type {
  CreateInspectionDiagnosis,
  Diagnosis,
  InspectionConclusion,
  UpdateInspectionRequest,
} from "../api/patient";
import { asText } from "../shared/text";

export type InspectionFormState = {
  anamnesis: string;
  complaints: string;
  treatment: string;
  conclusion: InspectionConclusion;
  nextVisitDate: string;
  deathDate: string;
  diagnoses: CreateInspectionDiagnosis[];
};

type InspectionLike = Record<string, unknown> | null;
type IcdRoot = { id: string; code: string };

export const conclusionOptions: Array<{ value: InspectionConclusion; label: string }> = [
  { value: "Recovery", label: "Выздоровление" },
  { value: "Disease", label: "Болезнь" },
  { value: "Death", label: "Смерть" },
];

export function normalizeConclusion(value: unknown): InspectionConclusion {
  return value === "Recovery" || value === "Disease" || value === "Death" ? value : "Disease";
}

export function toLocalDateTime(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toIso(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function createEmptyDiagnosis(
  type: CreateInspectionDiagnosis["type"] = "Main"
): CreateInspectionDiagnosis {
  return { icdDiagnosisId: "", description: "", type };
}

function rootLetter(code: string) {
  const match = code.trim().toUpperCase().match(/^[A-Z]/);
  return match ? match[0] : "";
}

function resolveIcdDiagnosisId(
  diagnosis: Diagnosis,
  roots: IcdRoot[] | undefined
) {
  const diagnosisId = asText(diagnosis.id).trim();
  if (!roots?.length) return diagnosisId;
  if (roots.some((root) => root.id === diagnosisId)) return diagnosisId;

  const diagnosisLetter = rootLetter(asText(diagnosis.code));
  if (!diagnosisLetter) return diagnosisId;

  const matchedRoot = roots.find((root) => rootLetter(root.code) === diagnosisLetter);
  return matchedRoot?.id ?? diagnosisId;
}

export function createInspectionFormState(): InspectionFormState {
  return {
    anamnesis: "",
    complaints: "",
    treatment: "",
    conclusion: "Disease",
    nextVisitDate: "",
    deathDate: "",
    diagnoses: [createEmptyDiagnosis()],
  };
}

export function buildInspectionFormState(
  inspection: InspectionLike,
  diagnoses: Diagnosis[],
  roots: IcdRoot[] | undefined
): InspectionFormState {
  if (!inspection) return createInspectionFormState();

  return {
    anamnesis: asText(inspection.anamnesis),
    complaints: asText(inspection.complaints),
    treatment: asText(inspection.treatment),
    conclusion: normalizeConclusion(inspection.conclusion),
    nextVisitDate: toLocalDateTime(asText(inspection.nextVisitDate)),
    deathDate: toLocalDateTime(asText(inspection.deathDate)),
    diagnoses: diagnoses.length
      ? diagnoses.map((diagnosis) => ({
          icdDiagnosisId: resolveIcdDiagnosisId(diagnosis, roots),
          description: asText(diagnosis.description),
          type: diagnosis.type,
        }))
      : [createEmptyDiagnosis()],
  };
}

function trimDiagnoses(diagnoses: CreateInspectionDiagnosis[]) {
  return diagnoses.map((diagnosis) => ({
    icdDiagnosisId: diagnosis.icdDiagnosisId.trim(),
    description: diagnosis.description.trim(),
    type: diagnosis.type,
  }));
}

export function validateInspectionForm(form: InspectionFormState) {
  const errors: string[] = [];
  if (!form.anamnesis.trim()) errors.push("Заполни анамнез.");
  if (!form.complaints.trim()) errors.push("Заполни жалобы.");
  if (!form.treatment.trim()) errors.push("Заполни лечение.");
  if (form.conclusion === "Disease" && !toIso(form.nextVisitDate)) {
    errors.push("Для заключения “Болезнь” нужно указать дату следующего визита.");
  }
  if (form.conclusion === "Death" && !toIso(form.deathDate)) {
    errors.push("Для заключения “Смерть” нужно указать дату смерти.");
  }

  const diagnoses = trimDiagnoses(form.diagnoses);
  if (!diagnoses.length) errors.push("Добавь хотя бы один диагноз.");
  if (diagnoses.some((diagnosis) => !diagnosis.icdDiagnosisId)) {
    errors.push("В каждом диагнозе должен быть указан `icdDiagnosisId`.");
  }
  const mainCount = diagnoses.filter((diagnosis) => diagnosis.type === "Main").length;
  if (mainCount !== 1) errors.push("Должен быть ровно один основной диагноз (Main).");

  return errors;
}

export function buildInspectionUpdateRequest(form: InspectionFormState): UpdateInspectionRequest {
  return {
    anamnesis: form.anamnesis.trim(),
    complaints: form.complaints.trim(),
    treatment: form.treatment.trim(),
    conclusion: form.conclusion,
    diagnoses: trimDiagnoses(form.diagnoses),
    ...(form.conclusion === "Disease" && toIso(form.nextVisitDate)
      ? { nextVisitDate: toIso(form.nextVisitDate)! }
      : {}),
    ...(form.conclusion === "Death" && toIso(form.deathDate)
      ? { deathDate: toIso(form.deathDate)! }
      : {}),
  };
}
