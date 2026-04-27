import { asText } from "./text";
import { isRecord } from "./typeGuards";

export type DoctorIdentity = {
  id: string;
  name: string;
  email: string;
  specialityId: string;
  specialityName: string;
};

export const EMPTY_DOCTOR_IDENTITY: DoctorIdentity = {
  id: "",
  name: "",
  email: "",
  specialityId: "",
  specialityName: "",
};

export function normalizeDoctorIdentity(input: unknown): DoctorIdentity {
  if (!isRecord(input)) return EMPTY_DOCTOR_IDENTITY;

  return {
    id: asText(input.id).trim(),
    name: asText(input.name).trim(),
    email: asText(input.email).trim(),
    specialityId: asText(input.specialityId || input.speciality || input.specialtyId).trim(),
    specialityName: asText(input.specialityName || input.specialtyName || input.speciality).trim(),
  };
}

export function isSameDoctor(currentDoctor: DoctorIdentity, doctorId: unknown, doctorName: unknown): boolean {
  const currentDoctorName = currentDoctor.name.trim().toLowerCase();
  const currentDoctorEmail = currentDoctor.email.trim().toLowerCase();
  const normalizedDoctorId = asText(doctorId).trim();
  const normalizedDoctorName = asText(doctorName).trim().toLowerCase();

  return Boolean(
    (currentDoctor.id && normalizedDoctorId && currentDoctor.id === normalizedDoctorId) ||
    (currentDoctorName && normalizedDoctorName && currentDoctorName === normalizedDoctorName) ||
    (currentDoctorEmail && normalizedDoctorName && currentDoctorEmail === normalizedDoctorName)
  );
}

export function canReplyToConsultation(
  currentDoctor: DoctorIdentity,
  consultationSpecialityId: unknown,
  consultationSpecialityName: unknown,
  inspectionDoctorId: unknown,
  inspectionDoctorName: unknown
): boolean {
  if (isSameDoctor(currentDoctor, inspectionDoctorId, inspectionDoctorName)) return true;

  if (!currentDoctor.specialityId && !currentDoctor.specialityName) {
    return true;
  }

  const currentDoctorSpecialityId = currentDoctor.specialityId.toLowerCase();
  const currentDoctorSpecialityName = currentDoctor.specialityName.toLowerCase();
  const normalizedConsultationSpecialityId = asText(consultationSpecialityId).trim().toLowerCase();
  const normalizedConsultationSpecialityName = asText(consultationSpecialityName).trim().toLowerCase();

  return Boolean(
    (currentDoctorSpecialityId &&
      normalizedConsultationSpecialityId &&
      currentDoctorSpecialityId === normalizedConsultationSpecialityId) ||
    (currentDoctorSpecialityName &&
      normalizedConsultationSpecialityName &&
      currentDoctorSpecialityName === normalizedConsultationSpecialityName)
  );
}
