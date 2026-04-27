import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import ui from "../controls.module.css";
import { getDoctorProfile } from "../api/doctor";
import { getIcd10Roots } from "../api/dictionary";
import { ConsultationSection } from "../components/ConsultationSection/ConsultationSection";
import { isSameDoctor, normalizeDoctorIdentity } from "../shared/doctorAccess";
import { formatDateTime } from "../shared/dateTime";
import { formatConclusion } from "../shared/medicalFormat";
import { asText, toDisplayText } from "../shared/text";
import { isRecord } from "../shared/typeGuards";
import {
  getInspection,
  updateInspection,
  type Diagnosis,
  type InspectionConclusion,
} from "../api/patient";
import {
  buildInspectionFormState,
  buildInspectionUpdateRequest,
  conclusionOptions,
  createEmptyDiagnosis,
  createInspectionFormState,
  normalizeConclusion,
  type InspectionFormState,
  validateInspectionForm,
} from "./inspectionForm";
import s from "./InspectionPage.module.css";

function diagnosisKey(diagnosis: Diagnosis, index: number) {
  return diagnosis.id || `${diagnosis.code}-${diagnosis.type}-${index}`;
}

function getInspectionRecord(raw: unknown) {
  if (isRecord(raw) && "inspection" in raw && isRecord(raw.inspection)) return raw.inspection;
  return isRecord(raw) ? raw : null;
}

function getInspectionDiagnoses(inspection: Record<string, unknown> | null) {
  if (!inspection) return [];

  const list = Array.isArray(inspection.diagnoses)
    ? inspection.diagnoses.filter(isRecord)
    : isRecord(inspection.diagnosis)
      ? [inspection.diagnosis]
      : [];

  return list as Diagnosis[];
}

function getInspectionConsultations(inspection: Record<string, unknown> | null) {
  if (!inspection || !Array.isArray(inspection.consultations)) return [];
  return inspection.consultations.filter(isRecord);
}

export function InspectionPage() {
  const { id } = useParams();
  const inspectionId = id ?? "";
  const queryClient = useQueryClient();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [form, setForm] = useState<InspectionFormState>(() => createInspectionFormState());

  const inspectionQuery = useQuery({
    queryKey: ["inspection", inspectionId],
    queryFn: () => getInspection(inspectionId),
    enabled: Boolean(inspectionId),
    retry: 0,
  });

  const icdRootsQuery = useQuery({
    queryKey: ["icd10Roots"],
    queryFn: () => getIcd10Roots(),
    retry: 0,
  });

  const doctorProfileQuery = useQuery({
    queryKey: ["doctorProfile"],
    queryFn: () => getDoctorProfile(),
    retry: 0,
  });

  const inspection = useMemo(() => getInspectionRecord(inspectionQuery.data), [inspectionQuery.data]);
  const diagnoses = useMemo(() => getInspectionDiagnoses(inspection), [inspection]);
  const consultations = useMemo<Record<string, unknown>[]>(() => getInspectionConsultations(inspection), [inspection]);
  const currentDoctor = normalizeDoctorIdentity(doctorProfileQuery.data);
  const canEditInspection = inspection ? isSameDoctor(currentDoctor, inspection.doctorId, inspection.doctor) : false;

  useEffect(() => {
    const className = "inspection-modal-open";
    if (isEditOpen) document.body.classList.add(className);
    else document.body.classList.remove(className);

    return () => {
      document.body.classList.remove(className);
    };
  }, [isEditOpen]);

  const validationErrors = validateInspectionForm(form);
  const isCreateContinuationDisabled = inspection?.hasChain === true;
  const shouldShowValidationErrors = submitAttempted && validationErrors.length > 0;

  const openEditModal = () => {
    setForm(buildInspectionFormState(inspection, diagnoses, icdRootsQuery.data));
    setSubmitAttempted(false);
    setIsEditOpen(true);
  };

  const updateFormField = <Key extends keyof InspectionFormState>(
    field: Key,
    value: InspectionFormState[Key]
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateDiagnosisAt = (
    index: number,
    updater: (
      diagnosis: InspectionFormState["diagnoses"][number]
    ) => InspectionFormState["diagnoses"][number]
  ) => {
    setForm((prev) => ({
      ...prev,
      diagnoses: prev.diagnoses.map((diagnosis, diagnosisIndex) =>
        diagnosisIndex === index ? updater(diagnosis) : diagnosis
      ),
    }));
  };

  const addDiagnosis = () => {
    setForm((prev) => ({
      ...prev,
      diagnoses: [...prev.diagnoses, createEmptyDiagnosis("Concomitant")],
    }));
  };

  const removeDiagnosisAt = (index: number) => {
    setForm((prev) => ({
      ...prev,
      diagnoses: prev.diagnoses.length > 1 ? prev.diagnoses.filter((_, diagnosisIndex) => diagnosisIndex !== index) : prev.diagnoses,
    }));
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      return updateInspection(inspectionId, buildInspectionUpdateRequest(form));
    },
    onSuccess: async (data) => {
      setIsEditOpen(false);
      setSubmitAttempted(false);
      await queryClient.invalidateQueries({ queryKey: ["inspection", inspectionId] });
      if (data.patientId) {
        await queryClient.invalidateQueries({ queryKey: ["patientInspections", data.patientId] });
        await queryClient.invalidateQueries({ queryKey: ["patientInspectionsAll", data.patientId] });
      }
    },
  });

  if (!inspectionId) return <div className={s.container}>Нет id осмотра</div>;

  return (
    <div className={s.container}>
      <div className={s.card}>
        <div className={s.headerRow}>
          <div>
            <h1 className={s.title}>Детали осмотра</h1>
            <p className={s.subtitle}>Осмотр от {formatDateTime(asText(inspection?.date), "—")}</p>
          </div>
          <div className={s.actions}>
            {inspection?.patientId ? (
              <Link className={`${ui.button} ${ui.buttonSecondary}`} to={`/patient/${inspection.patientId}`}>
                К пациенту
              </Link>
            ) : null}
            {inspection && canEditInspection ? (
              <button className={`${ui.button} ${ui.buttonSecondary}`} type="button" onClick={openEditModal}>
                Редактировать
              </button>
            ) : null}
            {inspection?.patientId ? (
              <Link
                className={`${ui.button}${isCreateContinuationDisabled ? ` ${s.actionDisabled}` : ""}`}
                to={`/patient/${inspection.patientId}/inspections/create?previousInspectionId=${inspectionId}`}
                aria-disabled={isCreateContinuationDisabled}
                onClick={(e) => {
                  if (isCreateContinuationDisabled) e.preventDefault();
                }}
              >
                Создать продолжение
              </Link>
            ) : null}
          </div>
        </div>

        {inspectionQuery.isError ? <div className={ui.error}>{(inspectionQuery.error as Error).message}</div> : null}
        {inspectionQuery.isLoading ? <p className={s.muted}>Загрузка...</p> : null}
        {inspection ? (
          <>
            <div className={s.metaGrid}>
              <div className={s.metaCard}>
                <span className={s.metaLabel}>Дата осмотра</span>
                <strong>{formatDateTime(asText(inspection.date), "—")}</strong>
              </div>
              <div className={s.metaCard}>
                <span className={s.metaLabel}>Заключение</span>
                <strong>{formatConclusion(normalizeConclusion(inspection.conclusion))}</strong>
              </div>
              <div className={s.metaCard}>
                <span className={s.metaLabel}>Пациент</span>
                <strong>{toDisplayText(inspection.patient)}</strong>
              </div>
              <div className={s.metaCard}>
                <span className={s.metaLabel}>Врач</span>
                <strong>{toDisplayText(inspection.doctor)}</strong>
              </div>
              <div className={s.metaCard}>
                <span className={s.metaLabel}>Следующий визит</span>
                <strong>{formatDateTime(asText(inspection.nextVisitDate), "—")}</strong>
              </div>
              <div className={s.metaCard}>
                <span className={s.metaLabel}>Дата смерти</span>
                <strong>{formatDateTime(asText(inspection.deathDate), "—")}</strong>
              </div>
            </div>

            <section className={s.section}>
              <h2 className={s.sectionTitle}>Текстовые поля</h2>
              <div className={s.textGrid}>
                <div className={s.textCard}>
                  <span className={s.metaLabel}>Анамнез</span>
                  <p>{toDisplayText(inspection.anamnesis)}</p>
                </div>
                <div className={s.textCard}>
                  <span className={s.metaLabel}>Жалобы</span>
                  <p>{toDisplayText(inspection.complaints)}</p>
                </div>
                <div className={s.textCard}>
                  <span className={s.metaLabel}>Лечение</span>
                  <p>{toDisplayText(inspection.treatment)}</p>
                </div>
              </div>
            </section>

            <section className={s.section}>
              <h2 className={s.sectionTitle}>Диагнозы</h2>
              {diagnoses.length ? (
                <div className={s.list}>
                  {diagnoses.map((diagnosis, index) => (
                    <div className={s.listCard} key={diagnosisKey(diagnosis, index)}>
                      <p className={s.listTitle}>
                        {toDisplayText(diagnosis.name, "Диагноз")} ({toDisplayText(diagnosis.code)})
                      </p>
                      <p className={s.muted}>Тип: {diagnosis.type}</p>
                      <p>{toDisplayText(diagnosis.description, "Описание отсутствует.")}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={s.muted}>Диагнозы отсутствуют.</p>
              )}
            </section>

            <section className={s.section}>
              <h2 className={s.sectionTitle}>Консультации</h2>
              <ConsultationSection
                consultations={consultations}
                inspectionDoctorId={asText(inspection.doctorId)}
                inspectionDoctorName={asText(inspection.doctor)}
                currentDoctor={currentDoctor}
                onChanged={() => queryClient.invalidateQueries({ queryKey: ["inspection", inspectionId] })}
              />
            </section>
          </>
        ) : null}
      </div>

      {isEditOpen && inspection && canEditInspection ? (
        <div className={s.modalOverlay} role="presentation" onClick={() => !updateMutation.isPending && setIsEditOpen(false)}>
          <div className={s.modal} role="dialog" aria-modal="true" aria-labelledby="inspection-edit-title" onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h2 className={s.modalTitle} id="inspection-edit-title">
                Редактирование осмотра
              </h2>
              <button
                className={s.closeButton}
                type="button"
                onClick={() => setIsEditOpen(false)}
                disabled={updateMutation.isPending}
              >
                Закрыть
              </button>
            </div>

            <form
              className={ui.form}
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitAttempted(true);
                if (validationErrors.length || updateMutation.isPending) return;
                updateMutation.mutate();
              }}
            >
              <label className={ui.label}>
                <span>Анамнез</span>
                <textarea
                  className={s.textarea}
                  value={form.anamnesis}
                  onChange={(e) => updateFormField("anamnesis", e.target.value)}
                />
              </label>

              <label className={ui.label}>
                <span>Жалобы</span>
                <textarea
                  className={s.textarea}
                  value={form.complaints}
                  onChange={(e) => updateFormField("complaints", e.target.value)}
                />
              </label>

              <label className={ui.label}>
                <span>Рекомендации по лечению</span>
                <textarea
                  className={s.textarea}
                  value={form.treatment}
                  onChange={(e) => updateFormField("treatment", e.target.value)}
                />
              </label>

              <div className={s.modalGrid}>
                <label className={ui.label}>
                  <span>Заключение</span>
                  <select
                    className={ui.select}
                    value={form.conclusion}
                    onChange={(e) => updateFormField("conclusion", e.target.value as InspectionConclusion)}
                  >
                    {conclusionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={ui.label}>
                  <span>Следующий визит</span>
                  <input
                    className={ui.input}
                    type="datetime-local"
                    value={form.nextVisitDate}
                    onChange={(e) => updateFormField("nextVisitDate", e.target.value)}
                    disabled={form.conclusion !== "Disease"}
                  />
                </label>

                <label className={ui.label}>
                  <span>Дата смерти</span>
                  <input
                    className={ui.input}
                    type="datetime-local"
                    value={form.deathDate}
                    onChange={(e) => updateFormField("deathDate", e.target.value)}
                    disabled={form.conclusion !== "Death"}
                  />
                </label>
              </div>

              <div className={s.modalSection}>
                <div className={s.modalSectionHeader}>
                  <h3 className={s.modalSectionTitle}>Диагнозы</h3>
                  <button
                    className={`${ui.button} ${ui.buttonSecondary}`}
                    type="button"
                    onClick={addDiagnosis}
                  >
                    + Добавить диагноз
                  </button>
                </div>

                {form.diagnoses.map((diagnosis, index) => (
                  <div className={s.diagnosisCard} key={`${diagnosis.icdDiagnosisId}-${diagnosis.type}-${index}`}>
                    <div className={s.modalGrid}>
                      <label className={ui.label}>
                        <span>Болезнь (МКБ-10)</span>
                        <select
                          className={ui.select}
                          value={diagnosis.icdDiagnosisId}
                          onChange={(e) => updateDiagnosisAt(index, (item) => ({ ...item, icdDiagnosisId: e.target.value }))}
                          disabled={icdRootsQuery.isLoading}
                        >
                          <option value="">{icdRootsQuery.isLoading ? "Загрузка..." : "Выбрать"}</option>
                          {(icdRootsQuery.data ?? []).map((root) => (
                            <option key={root.id} value={root.id}>
                              {root.code} — {root.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className={ui.label}>
                        <span>Тип</span>
                        <select
                          className={ui.select}
                          value={diagnosis.type}
                          onChange={(e) =>
                            updateDiagnosisAt(index, (item) => ({
                              ...item,
                              type: e.target.value as InspectionFormState["diagnoses"][number]["type"],
                            }))
                          }
                        >
                          <option value="Main">Основной</option>
                          <option value="Concomitant">Сопутствующий</option>
                          <option value="Complication">Осложнение</option>
                        </select>
                      </label>
                    </div>

                    <label className={ui.label}>
                      <span>Описание</span>
                      <textarea
                        className={s.textarea}
                        value={diagnosis.description}
                        onChange={(e) => updateDiagnosisAt(index, (item) => ({ ...item, description: e.target.value }))}
                      />
                    </label>

                    <button
                      className={`${ui.button} ${ui.buttonSecondary}`}
                      type="button"
                      onClick={() => removeDiagnosisAt(index)}
                      disabled={form.diagnoses.length <= 1}
                    >
                      Удалить диагноз
                    </button>
                  </div>
                ))}
              </div>

              {shouldShowValidationErrors ? (
                <div className={ui.error}>
                  {validationErrors.map((error) => (
                    <div key={error}>{error}</div>
                  ))}
                </div>
              ) : null}
              {updateMutation.isError ? <div className={ui.error}>{(updateMutation.error as Error).message}</div> : null}
              {icdRootsQuery.isError ? <div className={ui.error}>{(icdRootsQuery.error as Error).message}</div> : null}

              <div className={s.modalFooter}>
                <button
                  className={`${ui.button} ${ui.buttonSecondary}`}
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  disabled={updateMutation.isPending}
                >
                  Отмена
                </button>
                <button className={ui.button} type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
