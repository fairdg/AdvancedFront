import { api } from "./client";

export type Patient = {
  id: string;
  createTime?: string;
  name: string;
  birthday?: string;
  gender?: "Male" | "Female";
  email?: string;
  phone?: string;
  hasPlannedVisits?: boolean;
};

export type Pagination = {
  size: number;
  count: number;
  current: number;
};

export type PatientsResponse = {
  patients: Patient[];
  pagination: Pagination;
};

export type InspectionConclusion = "Recovery" | "Disease" | "Death";

export type Diagnosis = {
  id: string;
  createTime?: string;
  code: string;
  name: string;
  description?: string;
  type: "Main" | "Concomitant" | "Complication";
};

export type Inspection = {
  id: string;
  createTime: string;
  previousId?: string | null;
  date: string;
  conclusion: InspectionConclusion;
  doctorId: string;
  doctor: string;
  patientId: string;
  patient: string;
  diagnosis: Diagnosis;
  hasChain: boolean;
  hasNested: boolean;
};

export type PatientInspectionsResponse = {
  inspections: Inspection[];
  pagination: Pagination;
};

export type CreateInspectionDiagnosis = {
  icdDiagnosisId: string;
  description: string;
  type: "Main" | "Concomitant" | "Complication";
};

export type CreateInspectionConsultation = {
  specialityId: string;
  comment: { content: string };
};

export type CreateInspectionRequest = {
  date: string;
  anamnesis: string;
  complaints: string;
  treatment: string;
  conclusion: InspectionConclusion;
  nextVisitDate?: string;
  deathDate?: string;
  previousInspectionId?: string;
  diagnoses: CreateInspectionDiagnosis[];
  consultations: CreateInspectionConsultation[];
};

export type PatientsQuery = {
  page: number;
  pageSize: number;
  name?: string;
  conclusion?: InspectionConclusion | "";
  hasPlannedVisits?: boolean;
  onlyMine?: boolean;
  sort?: string;
};

export async function getPatients(params: PatientsQuery): Promise<PatientsResponse> {
  const search = new URLSearchParams();
  search.set("page", String(params.page));
  search.set("current", String(params.page));
  search.set("pageSize", String(params.pageSize));
  search.set("size", String(params.pageSize));

  if (params.name) search.set("name", params.name);
  if (params.conclusion) {
    search.set("conclusion", params.conclusion);
    search.set("conclusions", params.conclusion);
  }
  if (params.hasPlannedVisits) {
    search.set("hasPlannedVisits", "true");
    search.set("planned", "1");
  }
  if (params.onlyMine) {
    search.set("onlyMine", "true");
    search.set("mine", "1");
  }
  if (params.sort) {
    search.set("sort", params.sort);
    search.set("sorting", params.sort);
  }

  return api<PatientsResponse>(`/api/patient?${search.toString()}`, { method: "GET" });
}

export type PatientInspectionsQuery = {
  page: number;
  pageSize: number;
};

export type CreatePatientRequest = {
  name: string;
  birthday: string;
  gender: "Male" | "Female";
};

export type CreatePatientResponse = {
  id: string;
};

export async function createPatient(body: CreatePatientRequest): Promise<CreatePatientResponse> {
  return api<CreatePatientResponse>("/api/patient", { method: "POST", json: body });
}

export async function getPatient(id: string): Promise<Patient> {
  return api<Patient>(`/api/patient/${id}`, { method: "GET" });
}

export async function getPatientInspections(
  patientId: string,
  params: PatientInspectionsQuery & { icdRoots?: string[]; grouped?: boolean }
): Promise<PatientInspectionsResponse> {
  const search = new URLSearchParams();
  search.set("page", String(params.page));
  search.set("current", String(params.page));
  search.set("pageSize", String(params.pageSize));
  search.set("size", String(params.pageSize));
  if (params.icdRoots?.length) {
    for (const root of params.icdRoots) search.append("icdRoots", root);
  }
  if (params.grouped) search.set("grouped", "true");
  return api<PatientInspectionsResponse>(`/api/patient/${patientId}/inspections?${search.toString()}`, { method: "GET" });
}

export async function createPatientInspection(patientId: string, body: CreateInspectionRequest): Promise<unknown> {
  return api(`/api/patient/${patientId}/inspections`, { method: "POST", json: body });
}
