import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import ui from "../controls.module.css";
import { getIcd10Roots, getSpecialities } from "../api/dictionary";
import {
  createPatientInspection,
  getPatient,
  getPatientInspections,
  type CreateInspectionConsultation,
  type CreateInspectionDiagnosis,
  type CreateInspectionRequest,
  type InspectionConclusion,
} from "../api/patient";
import {
  conclusionOptions,
  createEmptyDiagnosis,
  toIso,
  validateInspectionForm,
} from "./inspectionForm";
import s from "./CreateInspectionPage.module.css";

function nowLocalDatetime() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function hasChildInspection(inspectionId: string, inspections: Array<{ id: string; previousId?: string | null; hasChain?: boolean }>) {
  const inspection = inspections.find((item) => item.id === inspectionId);
  if (inspection?.hasChain) return true;
  return inspections.some((item) => item.previousId === inspectionId);
}

export function CreateInspectionPage() {
  const { id } = useParams();
  const patientId = id ?? "";
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [date, setDate] = useState(() => nowLocalDatetime());
  const [anamnesis, setAnamnesis] = useState("");
  const [complaints, setComplaints] = useState("");
  const [treatment, setTreatment] = useState("");
  const [conclusion, setConclusion] = useState<InspectionConclusion>("Disease");
  const [nextVisitDate, setNextVisitDate] = useState("");
  const [deathDate, setDeathDate] = useState("");
  const [previousInspectionId, setPreviousInspectionId] = useState<string>(() => searchParams.get("previousInspectionId") ?? "");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [currentTimestamp] = useState(() => Date.now());

  const [diagnoses, setDiagnoses] = useState<CreateInspectionDiagnosis[]>([
    createEmptyDiagnosis(),
  ]);
  const [consultations, setConsultations] = useState<CreateInspectionConsultation[]>([]);

  const patientQuery = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => getPatient(patientId),
    enabled: Boolean(patientId),
    retry: 0,
  });

  const inspectionsQuery = useQuery({
    queryKey: ["patientInspectionsAll", patientId],
    queryFn: () => getPatientInspections(patientId, { page: 1, pageSize: 200 }),
    enabled: Boolean(patientId),
    retry: 0,
  });

  const isDead = (inspectionsQuery.data?.inspections ?? []).some((x) => x.conclusion === "Death");

  const specialitiesQuery = useQuery({
    queryKey: ["specialities"],
    queryFn: () => getSpecialities({ page: 1, size: 200 }),
    retry: 0,
  });

  const icdRootsQuery = useQuery({
    queryKey: ["icd10Roots"],
    queryFn: () => getIcd10Roots(),
    retry: 0,
  });
  const allInspections = inspectionsQuery.data?.inspections;

  const validationErrors = useMemo(() => {
    const inspections = allInspections ?? [];
    const errors = validateInspectionForm({
      anamnesis,
      complaints,
      treatment,
      conclusion,
      nextVisitDate,
      deathDate,
      diagnoses,
    });
    if (!patientId) errors.push("Нет id пациента.");
    if (isDead) errors.push("Осмотр с заключением “Смерть” уже есть — дальнейшие осмотры невозможны.");

    const isoDate = toIso(date);
    if (!isoDate) {
      errors.push("Укажи корректную дату осмотра.");
    } else {
      const inspectionTs = new Date(isoDate).getTime();
      if (!Number.isNaN(inspectionTs) && inspectionTs > currentTimestamp) {
        errors.push("Нельзя создавать осмотр в будущем.");
      }

      if (previousInspectionId.trim()) {
        const prev = inspections.find((x) => x.id === previousInspectionId.trim());
        if (!prev?.date) {
          errors.push("Не удалось проверить дату предыдущего осмотра.");
        } else {
          const prevTs = new Date(prev.date).getTime();
          if (!Number.isNaN(prevTs) && !Number.isNaN(inspectionTs) && inspectionTs < prevTs) {
            errors.push("Дата осмотра не может быть раньше предыдущего осмотра в цепочке.");
          }
        }
        if (hasChildInspection(previousInspectionId.trim(), inspections)) {
          errors.push("У выбранного осмотра уже есть продолжение в цепочке.");
        }
      }
    }
    const consTrimmed = consultations.map((c) => ({
      specialityId: c.specialityId.trim(),
      content: c.comment.content.trim(),
    }));
    if (consTrimmed.some((c) => !c.specialityId)) errors.push("В каждой консультации должна быть выбрана специальность.");
    if (consTrimmed.some((c) => !c.content)) {
      errors.push("При создании консультации врач-автор осмотра должен указать комментарий, описывающий проблему.");
    }

    const specialityIds = consTrimmed.filter((c) => c.specialityId).map((c) => c.specialityId);
    if (new Set(specialityIds).size !== specialityIds.length) {
      errors.push("Нельзя добавлять несколько консультаций с одинаковой специальностью врача.");
    }

    return errors;
  }, [
    anamnesis,
    complaints,
    conclusion,
    date,
    deathDate,
    diagnoses,
    consultations,
    allInspections,
    isDead,
    nextVisitDate,
    patientId,
    previousInspectionId,
    currentTimestamp,
    treatment,
  ]);

  const updateDiagnosisAt = (
    index: number,
    updater: (diagnosis: CreateInspectionDiagnosis) => CreateInspectionDiagnosis
  ) => {
    setDiagnoses((prev) => prev.map((diagnosis, diagnosisIndex) => (diagnosisIndex === index ? updater(diagnosis) : diagnosis)));
  };

  const addDiagnosis = () => {
    setDiagnoses((prev) => [...prev, createEmptyDiagnosis("Concomitant")]);
  };

  const removeDiagnosisAt = (index: number) => {
    setDiagnoses((prev) => {
      const nextDiagnoses = prev.filter((_, diagnosisIndex) => diagnosisIndex !== index);
      return nextDiagnoses.length ? nextDiagnoses : prev;
    });
  };

  const updateConsultationAt = (
    index: number,
    updater: (consultation: CreateInspectionConsultation) => CreateInspectionConsultation
  ) => {
    setConsultations((prev) =>
      prev.map((consultation, consultationIndex) => (consultationIndex === index ? updater(consultation) : consultation))
    );
  };

  const addConsultation = () => {
    setConsultations((prev) => [...prev, { specialityId: "", comment: { content: "" } }]);
  };

  const removeConsultationAt = (index: number) => {
    setConsultations((prev) => prev.filter((_, consultationIndex) => consultationIndex !== index));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const body: CreateInspectionRequest = {
        date: toIso(date)!,
        anamnesis: anamnesis.trim(),
        complaints: complaints.trim(),
        treatment: treatment.trim(),
        conclusion,
        diagnoses: diagnoses.map((d) => ({
          icdDiagnosisId: d.icdDiagnosisId.trim(),
          description: d.description.trim(),
          type: d.type,
        })),
        consultations: consultations.map((c) => ({
          specialityId: c.specialityId.trim(),
          comment: { content: c.comment.content.trim() },
        })),
      };

      const nextIso = toIso(nextVisitDate);
      const deathIso = toIso(deathDate);
      if (conclusion === "Disease" && nextIso) body.nextVisitDate = nextIso;
      if (conclusion === "Death" && deathIso) body.deathDate = deathIso;
      if (previousInspectionId.trim()) body.previousInspectionId = previousInspectionId.trim();

      return createPatientInspection(patientId, body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["patientInspections", patientId] });
      await queryClient.invalidateQueries({ queryKey: ["patientInspectionsAll", patientId] });
      navigate(`/patient/${patientId}`);
    },
  });

  if (!patientId) return <div className={s.container}>Нет id пациента</div>;

  const patientName = patientQuery.data?.name ?? "Пациент";

  return (
    <div className={s.container}>
      <div className={s.card}>
        <div className={s.headerRow}>
            <h1 className={s.title}>Создание осмотра</h1>
            <h2 className={s.subTitle}>{patientName}</h2>
            {patientQuery.isError ? <div className={ui.error}>{(patientQuery.error as Error).message}</div> : null}
            {inspectionsQuery.isError ? <div className={ui.error}>{(inspectionsQuery.error as Error).message}</div> : null}
            {specialitiesQuery.isError ? <div className={ui.error}>{(specialitiesQuery.error as Error).message}</div> : null}
            {icdRootsQuery.isError ? <div className={ui.error}>{(icdRootsQuery.error as Error).message}</div> : null}
            {submitAttempted && validationErrors.length ? (
              <div className={ui.error}>
                {validationErrors.map((err) => (
                  <div key={err}>{err}</div>
                ))}
              </div>
            ) : null}
            {mutation.isError ? <div className={ui.error}>{(mutation.error as Error).message}</div> : null}
        </div>

        <form
          className={ui.form}
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitAttempted(true);
            if (validationErrors.length || mutation.isPending) return;
            mutation.mutate();
          }}
        >
          <div className={s.grid2}>
            <label className={ui.label}>
              <span>Дата осмотра</span>
              <input className={ui.input} type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>

            <label className={ui.label}>
              <span>Заключение</span>
              <select className={ui.select} value={conclusion} onChange={(e) => setConclusion(e.target.value as InspectionConclusion)}>
                {conclusionOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={s.grid2}>
            <label className={ui.label}>
              <span>Предыдущий осмотр (опционально)</span>
              <select
                className={ui.select}
                value={previousInspectionId}
                onChange={(e) => setPreviousInspectionId(e.target.value)}
                disabled={inspectionsQuery.isLoading}
              >
                <option value="">Нет</option>
                {(allInspections ?? []).map((it) => (
                  <option key={it.id} value={it.id} disabled={hasChildInspection(it.id, allInspections ?? [])}>
                    {new Date(it.date).toLocaleString("ru-RU")} • {it.doctor} • {it.diagnosis?.code ? it.diagnosis.code : "МКБ?"}
                    {hasChildInspection(it.id, allInspections ?? []) ? " • уже есть продолжение" : ""}
                  </option>
                ))}
              </select>
              <p className={s.muted}>Если осмотр является продолжением цепочки — выбери предыдущий.</p>
            </label>

            <div className={s.grid2}>
              <label className={ui.label}>
                <span>Следующий визит (для “Болезнь”)</span>
                <input
                  className={ui.input}
                  type="datetime-local"
                  value={nextVisitDate}
                  onChange={(e) => setNextVisitDate(e.target.value)}
                  disabled={conclusion !== "Disease"}
                />
              </label>

              <label className={ui.label}>
                <span>Дата смерти (для “Смерть”)</span>
                <input
                  className={ui.input}
                  type="datetime-local"
                  value={deathDate}
                  onChange={(e) => setDeathDate(e.target.value)}
                  disabled={conclusion !== "Death"}
                />
              </label>
            </div>
          </div>

          <label className={ui.label}>
            <span>Анамнез</span>
            <input className={ui.input} value={anamnesis} onChange={(e) => setAnamnesis(e.target.value)} placeholder="..." />
          </label>

          <label className={ui.label}>
            <span>Жалобы</span>
            <input className={ui.input} value={complaints} onChange={(e) => setComplaints(e.target.value)} placeholder="..." />
          </label>

          <label className={ui.label}>
            <span>Лечение</span>
            <input className={ui.input} value={treatment} onChange={(e) => setTreatment(e.target.value)} placeholder="..." />
          </label>

          <h3 className={s.sectionTitle}>Диагнозы</h3>
          <p className={s.muted}>Выбери болезнь из справочника (как в фильтре на странице пациента).</p>

          {diagnoses.map((d, idx) => (
            <div className={s.itemCard} key={`${idx}-${d.type}`}>
              <div className={s.grid2}>
                <label className={ui.label}>
                  <span>Болезнь (МКБ-10)</span>
                  <select
                    className={ui.select}
                    value={d.icdDiagnosisId}
                    onChange={(e) => updateDiagnosisAt(idx, (diagnosis) => ({ ...diagnosis, icdDiagnosisId: e.target.value }))}
                    disabled={icdRootsQuery.isLoading}
                  >
                    <option value="">{icdRootsQuery.isLoading ? "Загрузка..." : "Выбрать"}</option>
                    {(icdRootsQuery.data ?? []).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.code} — {r.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={ui.label}>
                  <span>Тип</span>
                  <select
                    className={ui.select}
                    value={d.type}
                    onChange={(e) => updateDiagnosisAt(idx, (diagnosis) => ({ ...diagnosis, type: e.target.value as CreateInspectionDiagnosis["type"] }))}
                  >
                    <option value="Main">Основной</option>
                    <option value="Concomitant">Сопутствующий</option>
                    <option value="Complication">Осложнение</option>
                  </select>
                </label>
              </div>

              <label className={ui.label}>
                <span>Описание</span>
                <input
                  className={ui.input}
                  value={d.description}
                  onChange={(e) => updateDiagnosisAt(idx, (diagnosis) => ({ ...diagnosis, description: e.target.value }))}
                  placeholder="..."
                />
              </label>

              <div className={s.row}>
                <button
                  className={`${ui.button} ${ui.buttonSecondary}`}
                  type="button"
                  onClick={() => removeDiagnosisAt(idx)}
                  disabled={diagnoses.length <= 1}
                >
                  Удалить
                </button>
                <span className={s.muted}>Оставь хотя бы один диагноз. Ровно один должен быть Main.</span>
              </div>
            </div>
          ))}

          <button
            className={`${ui.button} ${ui.buttonSecondary}`}
            type="button"
            onClick={addDiagnosis}
          >
            + Добавить диагноз
          </button>

          <h3 className={s.sectionTitle}>Консультации</h3>
          <p className={s.muted}>Опционально: добавь консультации других специалистов. Повторять одну и ту же специальность нельзя.</p>

          {consultations.map((c, idx) => (
            <div className={s.itemCard} key={idx}>
              <div className={s.grid2}>
                <label className={ui.label}>
                  <span>Специальность</span>
                  <select
                    className={ui.select}
                    value={c.specialityId}
                    onChange={(e) => updateConsultationAt(idx, (consultation) => ({ ...consultation, specialityId: e.target.value }))}
                    disabled={specialitiesQuery.isLoading}
                  >
                    <option value="">Выбрать</option>
                    {(specialitiesQuery.data ?? []).map((sp) => (
                      <option
                        key={sp.id}
                        value={sp.id}
                        disabled={consultations.some((item, itemIdx) => itemIdx !== idx && item.specialityId === sp.id)}
                      >
                        {sp.name?.trim() ? sp.name : sp.id}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={ui.label}>
                  <span>Комментарий врача-автора осмотра</span>
                  <input
                    className={ui.input}
                    value={c.comment.content}
                    onChange={(e) =>
                      updateConsultationAt(idx, (consultation) => ({
                        ...consultation,
                        comment: { content: e.target.value },
                      }))
                    }
                    placeholder="Опиши проблему для специалиста"
                  />
                </label>
              </div>

              <button
                className={`${ui.button} ${ui.buttonSecondary}`}
                type="button"
                onClick={() => removeConsultationAt(idx)}
              >
                Удалить консультацию
              </button>
            </div>
          ))}

          <button
            className={`${ui.button} ${ui.buttonSecondary}`}
            type="button"
            onClick={addConsultation}
          >
            + Добавить консультацию
          </button>

          <div className={s.footerRow}>
            <button
              className={`${ui.button} ${ui.buttonSecondary}`}
              type="button"
              onClick={() => navigate(`/patient/${patientId}`)}
            >
              Отмена
            </button>
            <button className={ui.button} type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Сохранение..." : "Создать осмотр"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
