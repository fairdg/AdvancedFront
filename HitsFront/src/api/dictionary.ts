import { api } from "./client";

export type Specialty = { id: string; name: string; createTime?: string };
export type Pagination = { size: number; count: number; current: number };
export type SpecialtyListResponse = { specialties: Specialty[]; pagination: Pagination };

export type Icd10Root = { id: string; createTime?: string; code: string; name: string };

export async function getSpecialities(params: { name?: string; page?: number; size?: number }): Promise<Specialty[]> {
  const search = new URLSearchParams();
  if (params.name) search.set("name", params.name);
  if (params.page != null) search.set("page", String(params.page));
  if (params.page != null) search.set("current", String(params.page));
  if (params.size != null) search.set("size", String(params.size));

  const json = await api<SpecialtyListResponse>(`/api/dictionary/speciality?${search.toString()}`, { method: "GET" });
  return json.specialties ?? [];
}

export async function getIcd10Roots(): Promise<Icd10Root[]> {
  const json = await api<Icd10Root[]>("/api/dictionary/icd10/roots", { method: "GET" });
  return json ?? [];
}
