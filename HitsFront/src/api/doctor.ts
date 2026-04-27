export type Gender = "Male" | "Female";

export type DoctorRegisterRequest = {
  name: string;
  password: string;
  email: string;
  birthday: string;
  gender: Gender;
  phone: string;
  speciality: string; 
};

import { api } from "./client";

export type DoctorProfile = {
  id: string;
  createTime: string;
  name: string;
  birthday: string;
  gender: Gender;
  email: string;
  phone: string;
  speciality?: string;
  specialityId?: string;
  specialityName?: string;
  specialtyId?: string;
  specialtyName?: string;
};

export type DoctorProfileUpdateRequest = Pick<DoctorProfile, "email" | "name" | "phone" | "gender" | "birthday">;

export async function registerDoctor(body: DoctorRegisterRequest): Promise<unknown> {
  return api("/api/doctor/register", { method: "POST", json: body });
}

export async function getDoctorProfile(): Promise<DoctorProfile> {
  return api<DoctorProfile>("/api/doctor/profile", { method: "GET" });
}

export async function updateDoctorProfile(body: DoctorProfileUpdateRequest): Promise<DoctorProfile> {
  return api<DoctorProfile>("/api/doctor/profile", { method: "PUT", json: body });
}

export async function logoutDoctor(): Promise<unknown> {
  return api("/api/doctor/logout", { method: "POST" });
}
