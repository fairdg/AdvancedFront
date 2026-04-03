import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
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
import s from "./CreateInspectionPage.module.css";

function toIso(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

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

const conclusionOptions: Array<{ value: InspectionConclusion; label: string }> = [
  { value: "Recovery", label: "Выздоровление" },
  { value: "Disease", label: "Болезнь" },
  { value: "Death", label: "Смерть" },
];

export function CreateInspectionPage() {
  const { id } = useParams();
  const patientId = id ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [date, setDate] = useState(() => nowLocalDatetime());
  const [anamnesis, setAnamnesis] = useState("");
  const [complaints, setComplaints] = useState("");
  const [treatment, setTreatment] = useState("");
  const [conclusion, setConclusion] = useState<InspectionConclusion>("Disease");
  const [nextVisitDate, setNextVisitDate] = useState("");
  const [deathDate, setDeathDate] = useState("");
  const [previousInspectionId, setPreviousInspectionId] = useState<string>("");
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [diagnoses, setDiagnoses] = useState<CreateInspectionDiagnosis[]>([
    { icdDiagnosisId: "", description: "", type: "Main" },
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

  const isDead = useMemo(() => {
    const list = inspectionsQuery.data?.inspections ?? [];
    return list.some((x) => x.conclusion === "Death");
  }, [inspectionsQuery.data?.inspections]);

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

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!patientId) errors.push("Нет id пациента.");
    if (isDead) errors.push("Осмотр с заключением “Смерть” уже есть — дальнейшие осмотры невозможны.");

    const isoDate = toIso(date);
    if (!isoDate) {
      errors.push("Укажи корректную дату осмотра.");
    } else {
      const inspectionTs = new Date(isoDate).getTime();
      if (!Number.isNaN(inspectionTs) && inspectionTs > Date.now()  ) {
        errors.push("Нельзя создавать осмотр в будущем.");
      }

      if (previousInspectionId.trim()) {
        const prev = (inspectionsQuery.data?.inspections ?? []).find((x) => x.id === previousInspectionId.trim());
        if (!prev?.date) {
          errors.push("Не удалось проверить дату предыдущего осмотра.");
        } else {
          const prevTs = new Date(prev.date).getTime();
          if (!Number.isNaN(prevTs) && !Number.isNaN(inspectionTs) && inspectionTs < prevTs) {
            errors.push("Дата осмотра не может быть раньше предыдущего осмотра в цепочке.");
          }
        }
      }
    }

    if (!anamnesis.trim()) errors.push("Заполни анамнез.");
    if (!complaints.trim()) errors.push("Заполни жалобы.");
    if (!treatment.trim()) errors.push("Заполни лечение.");

    if (conclusion === "Disease" && !toIso(nextVisitDate)) {
      errors.push("Для заключения “Болезнь” нужно указать дату следующего визита.");
    }
    if (conclusion === "Death" && !toIso(deathDate)) {
      errors.push("Для заключения “Смерть” нужно указать дату смерти.");
    }

    const trimmed = diagnoses.map((d) => ({
      icdDiagnosisId: d.icdDiagnosisId.trim(),
      description: d.description.trim(),
      type: d.type,
    }));

    if (trimmed.length === 0) errors.push("Добавь хотя бы один диагноз.");
    if (trimmed.some((d) => !d.icdDiagnosisId)) errors.push("В каждом диагнозе должен быть указан `icdDiagnosisId`.");
    const mainCount = trimmed.filter((d) => d.type === "Main").length;
    if (mainCount !== 1) errors.push("Должен быть ровно один основной диагноз (Main).");

    const consTrimmed = consultations.map((c) => ({
      specialityId: c.specialityId.trim(),
      content: c.comment.content.trim(),
    }));
    if (consTrimmed.some((c) => !c.specialityId)) errors.push("В каждой консультации должна быть выбрана специальность.");
    if (consTrimmed.some((c) => !c.content)) errors.push("В каждой консультации должен быть комментарий.");

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
    inspectionsQuery.data?.inspections,
    isDead,
    nextVisitDate,
    patientId,
    previousInspectionId,
    treatment,
  ]);

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
                {(inspectionsQuery.data?.inspections ?? []).map((it) => (
                  <option key={it.id} value={it.id}>
                    {new Date(it.date).toLocaleString("ru-RU")} • {it.doctor} • {it.diagnosis?.code ? it.diagnosis.code : "МКБ?"}
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
                    onChange={(e) =>
                      setDiagnoses((prev) => prev.map((x, i) => (i === idx ? { ...x, icdDiagnosisId: e.target.value } : x)))
                    }
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
                    onChange={(e) =>
                      setDiagnoses((prev) => prev.map((x, i) => (i === idx ? { ...x, type: e.target.value as CreateInspectionDiagnosis["type"] } : x)))
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
                <input
                  className={ui.input}
                  value={d.description}
                  onChange={(e) =>
                    setDiagnoses((prev) => prev.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))
                  }
                  placeholder="..."
                />
              </label>

              <div className={s.row}>
                <button
                  className={`${ui.button} ${ui.buttonSecondary}`}
                  type="button"
                  onClick={() =>
                    setDiagnoses((prev) => prev.filter((_, i) => i !== idx).length ? prev.filter((_, i) => i !== idx) : prev)
                  }
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
            onClick={() => setDiagnoses((prev) => [...prev, { icdDiagnosisId: "", description: "", type: "Concomitant" }])}
          >
            + Добавить диагноз
          </button>

          <h3 className={s.sectionTitle}>Консультации</h3>
          <p className={s.muted}>Опционально: добавь консультации других специалистов.</p>

          {consultations.map((c, idx) => (
            <div className={s.itemCard} key={idx}>
              <div className={s.grid2}>
                <label className={ui.label}>
                  <span>Специальность</span>
                  <select
                    className={ui.select}
                    value={c.specialityId}
                    onChange={(e) =>
                      setConsultations((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, specialityId: e.target.value } : x))
                      )
                    }
                    disabled={specialitiesQuery.isLoading}
                  >
                    <option value="">Выбрать</option>
                    {(specialitiesQuery.data ?? []).map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.name?.trim() ? sp.name : sp.id}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={ui.label}>
                  <span>Комментарий</span>
                  <input
                    className={ui.input}
                    value={c.comment.content}
                    onChange={(e) =>
                      setConsultations((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, comment: { content: e.target.value } } : x))
                      )
                    }
                    placeholder="..."
                  />
                </label>
              </div>

              <button
                className={`${ui.button} ${ui.buttonSecondary}`}
                type="button"
                onClick={() => setConsultations((prev) => prev.filter((_, i) => i !== idx))}
              >
                Удалить консультацию
              </button>
            </div>
          ))}

          <button
            className={`${ui.button} ${ui.buttonSecondary}`}
            type="button"
            onClick={() => setConsultations((prev) => [...prev, { specialityId: "", comment: { content: "" } }])}
          >
            + Добавить консультацию
          </button>

          <div className={s.footerRow}>
            {/* <Link to={`/patient/${patientId}`}>Вернуться без сохранения</Link> */}
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
