import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import ui from "../controls.module.css";
import { getIcd10Roots } from "../api/dictionary";
import { getPatient, getPatientInspections, type Inspection, type InspectionConclusion } from "../api/patient";
import s from "./PatientPage.module.css";

function parseIntOr(value: string | null, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function buildSearch(current: URLSearchParams, next: Record<string, string | null | undefined>) {
  const sp = new URLSearchParams(current);
  for (const [k, v] of Object.entries(next)) {
    if (v == null || v === "") sp.delete(k);
    else sp.set(k, v);
  }
  return sp;
}

function formatDate(value: string | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU");
}

function formatConclusion(value: InspectionConclusion) {
  if (value === "Recovery") return "Выздоровление";
  if (value === "Disease") return "Болезнь";
  if (value === "Death") return "Смерть";
  return value;
}

function rootFromIcd(code: string | undefined) {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  if (!c) return null;
  const m = c.match(/^[A-Z]/);
  return m ? m[0] : null;
}

function buildNextByPrevious(inspections: Inspection[]) {
  const map = new Map<string, Inspection[]>();
  for (const it of inspections) {
    if (!it.previousId) continue;
    const arr = map.get(it.previousId) ?? [];
    arr.push(it);
    map.set(it.previousId, arr);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  }
  return map;
}

export function PatientPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const patientId = id ?? "";
  const page = parseIntOr(searchParams.get("page"), 1);
  const pageSize = parseIntOr(searchParams.get("pageSize"), 5);
  const icdRootId = (searchParams.get("icdRoot") ?? "").trim();
  const grouped = searchParams.get("grouped") === "1";

  const rootsQuery = useQuery({
    queryKey: ["icd10Roots"],
    queryFn: () => getIcd10Roots(),
    retry: 0,
  });

  const selectedRoot = useMemo(() => {
    if (!icdRootId) return null;
    return (rootsQuery.data ?? []).find((r) => r.id === icdRootId) ?? null;
  }, [icdRootId, rootsQuery.data]);

  const selectedRootLetter = useMemo(() => {
    const code = selectedRoot?.code;
    if (!code) return null;
    return rootFromIcd(code);
  }, [selectedRoot?.code]);

  const patientQuery = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => getPatient(patientId),
    enabled: Boolean(patientId),
    retry: 0,
  });

  const inspectionsQuery = useQuery({
    queryKey: ["patientInspections", patientId, page, pageSize, icdRootId, grouped],
    queryFn: () =>
      getPatientInspections(patientId, {
        page,
        pageSize,
        icdRoots: selectedRoot?.id ? [selectedRoot.id] : undefined,
        grouped,
      }),
    enabled: Boolean(patientId),
    retry: 0,
  });

  const pagination = inspectionsQuery.data?.pagination;
  const totalPages = useMemo(() => {
    if (!pagination) return 1;
    const n = Number(pagination.count);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  }, [pagination]);

  const serverPage = useMemo(() => {
    if (!pagination) return null;
    const current = pagination.current;
    if (current >= 1 && current <= totalPages) return current;
    if (current >= 0 && current < totalPages) return current + 1;
    return null;
  }, [pagination, totalPages]);

  const safePage = clamp(serverPage ?? page, 1, totalPages);
  const pageLinks = useMemo(() => {
    const start = Math.max(1, safePage - 2);
    const end = Math.min(totalPages, safePage + 2);
    const pages: number[] = [];
    for (let p = start; p <= end; p += 1) pages.push(p);
    return pages;
  }, [safePage, totalPages]);

  useEffect(() => {
    if (!pagination) return;
    if (serverPage == null) return;
    if (serverPage === page) return;
    setSearchParams(buildSearch(searchParams, { page: String(serverPage) }), { replace: true });
  }, [page, pagination, searchParams, serverPage, setSearchParams]);

  const rawInspections = useMemo(() => inspectionsQuery.data?.inspections ?? [], [inspectionsQuery.data?.inspections]);
  const filteredInspections = useMemo(() => {
    if (!selectedRootLetter) return rawInspections;
    return rawInspections.filter((it) => rootFromIcd(it.diagnosis?.code) === selectedRootLetter);
  }, [rawInspections, selectedRootLetter]);

  const nextByPrev = useMemo(() => buildNextByPrevious(filteredInspections), [filteredInspections]);
  const inspectionsToRender = useMemo(() => {
    if (!grouped) {
      return filteredInspections.map((it) => ({ it, level: 0, canExpand: false }));
    }

    const byId = new Map(filteredInspections.map((x) => [x.id, x]));
    const roots = filteredInspections.filter((x) => !x.previousId || !byId.has(x.previousId));
    roots.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    const out: Array<{ it: Inspection; level: number; canExpand: boolean }> = [];

    const pushChain = (root: Inspection) => {
      out.push({ it: root, level: 0, canExpand: Boolean(nextByPrev.get(root.id)?.length) || root.hasChain });
      let current = root;
      let level = 1;
      while (expanded.has(current.id)) {
        const next = nextByPrev.get(current.id)?.[0];
        if (!next) break;
        out.push({ it: next, level, canExpand: Boolean(nextByPrev.get(next.id)?.length) || next.hasChain });
        current = next;
        level += 1;
        if (level > 50) break;
      }
    };

    for (const r of roots) pushChain(r);
    return out;
  }, [expanded, filteredInspections, grouped, nextByPrev]);

  const isDead = useMemo(() => {
    return rawInspections.some((x) => x.conclusion === "Death");
  }, [rawInspections]);

  if (!patientId) return <div className={s.container}>Нет id пациента</div>;

  const patient = patientQuery.data;
  const genderMark = patient?.gender === "Female" ? "♀" : patient?.gender === "Male" ? "♂" : "•";
  const genderBadgeClass =
    patient?.gender === "Female" ? s.genderFemale : patient?.gender === "Male" ? s.genderMale : "";

  return (
    <div className={s.container}>
      <div className={s.inner}>
        <div className={s.headerRow}>
          <h1 className={s.pageTitle}>Медицинская карта пациента</h1>
          <div className={s.topActions}>
            <Link
              to={`/patient/${patientId}/inspections/create`}
              className={ui.button}
              aria-disabled={isDead}
              onClick={(e) => {
                if (isDead) e.preventDefault();
              }}
            >
              Добавить осмотр
            </Link>
          </div>
        </div>

        <div className={s.subHeaderRow}>
          <div className={s.titleWrap}>
            <span className={`${s.genderBadge}${genderBadgeClass ? ` ${genderBadgeClass}` : ""}`} aria-label={patient?.gender ?? "Gender"}>
              {genderMark}
            </span>
            <h2 className={s.title}>{patient?.name ?? "Пациент"}</h2>
          </div>
          <div className={s.topActions}>
            <div className={s.birth}>Дата рождения: {formatDate(patient?.birthday)}</div>
          </div>
        </div>

        {patientQuery.isError ? <p className={ui.error}>{(patientQuery.error as Error).message}</p> : null}
        {rootsQuery.isError ? <p className={ui.error}>{(rootsQuery.error as Error).message}</p> : null}
        {isDead ? <p className={ui.error}>Осмотр с заключением “Смерть” уже есть — дальнейшие осмотры невозможны.</p> : null}

        <div className={s.filters}>
          <div className={s.filtersGrid}>
            <label className={ui.label}>
              <span>МКБ-10</span>
              <select
                className={ui.select}
                value={icdRootId}
                onChange={(e) => setSearchParams(buildSearch(searchParams, { icdRoot: e.target.value || null, page: "1" }))}
                disabled={rootsQuery.isLoading}
              >
                <option value="">Выбрать</option>
                {(rootsQuery.data ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} — {r.name}
                  </option>
                ))}
              </select>
            </label>

            <label className={ui.label}>
              <span>Число осмотров на странице</span>
              <select
                className={ui.select}
                value={String(pageSize)}
                onChange={(e) => setSearchParams(buildSearch(searchParams, { pageSize: e.target.value, page: "1" }))}
              >
                {[5, 10, 20].map((n) => (
                  <option key={n} value={String(n)}>
                    {n}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <div className={s.checks}>
                <label className={s.check}>
                  <input
                    type="radio"
                    name="groupMode"
                    checked={grouped}
                    onChange={() => setSearchParams(buildSearch(searchParams, { grouped: "1", page: "1" }))}
                  />
                  Сгруппировать по повторным
                </label>
                <label className={s.check}>
                  <input
                    type="radio"
                    name="groupMode"
                    checked={!grouped}
                    onChange={() => setSearchParams(buildSearch(searchParams, { grouped: null, page: "1" }))}
                  />
                  Показать все
                </label>
              </div>
            </div>

            <div className={s.filtersRight}>
              <button
                className={`${ui.button} ${s.searchButton}`}
                type="button"
                onClick={() => setSearchParams(buildSearch(searchParams, { page: "1" }))}
              >
                Поиск
              </button>
            </div>
          </div>
        </div>

        {inspectionsQuery.isError ? <p className={ui.error}>{(inspectionsQuery.error as Error).message}</p> : null}

        <div className={`${s.list}${grouped ? ` ${s.listSingle}` : ""}`}>
          {inspectionsToRender.map(({ it, level, canExpand }) => {
            const isDeath = it.conclusion === "Death";
            return (
              <div
                key={it.id}
                className={`${s.inspectionCard}${isDeath ? ` ${s.inspectionDeath}` : ""}`}
                style={{ ["--level" as never]: level }}
              >
                <div className={s.inspectionHeader}>
                  <div className={s.inspectionTitleWrap}>
                    <span className={s.datePill}>{formatDate(it.date)}</span>
                    <p className={s.inspectionTitle}>Амбулаторный осмотр</p>
                  </div>
                  <div className={s.inspectionActions}>
                    <button className={s.inspectionAction} type="button" disabled>
                      Детали осмотра
                    </button>
                    <button className={s.inspectionAction} type="button" disabled={isDead}>
                      Добавить осмотр
                    </button>
                  </div>
                </div>

                <p className={s.inspectionMeta}>
                  Заключение: <b>{formatConclusion(it.conclusion)}</b>
                </p>
                <p className={s.inspectionMeta}>
                  Основной диагноз: <b>{it.diagnosis?.name}</b> ({it.diagnosis?.code})
                </p>
                <p className={s.inspectionMeta}>Медицинский работник: {it.doctor}</p>

                {grouped && canExpand ? (
                  <div className={s.chainButtonRow}>
                    <button
                      className={`${ui.button} ${ui.buttonSecondary}`}
                      type="button"
                      onClick={() => {
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          next.add(it.id);
                          return next;
                        });
                      }}
                      disabled={expanded.has(it.id)}
                    >
                      {expanded.has(it.id) ? "Показано" : "Показать следующий"}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className={s.pager}>
          <div className={s.pagerLinks}>
            <Link
              className={`${s.pageLink}${safePage <= 1 ? ` ${s.pageLinkDisabled}` : ""}`}
              to={{ pathname: `/patient/${patientId}`, search: buildSearch(searchParams, { page: String(Math.max(1, safePage - 1)) }).toString() }}
              aria-disabled={safePage <= 1}
            >
              Назад
            </Link>

            {pageLinks.map((p) => {
              const isActive = p === safePage;
              const to = { pathname: `/patient/${patientId}`, search: buildSearch(searchParams, { page: String(p) }).toString() };
              return (
                <Link key={p} className={`${s.pageLink} ${isActive ? s.pageLinkActive : ""}`} to={to}>
                  {p}
                </Link>
              );
            })}

            <Link
              className={`${s.pageLink}${safePage >= totalPages ? ` ${s.pageLinkDisabled}` : ""}`}
              to={{
                pathname: `/patient/${patientId}`,
                search: buildSearch(searchParams, { page: String(Math.min(totalPages, safePage + 1)) }).toString(),
              }}
              aria-disabled={safePage >= totalPages}
            >
              Вперёд
            </Link>
          </div>
          <div className={s.pagerInfo}>
            Стр. {safePage} / {totalPages} (pageSize {pageSize})
          </div>
        </div>
      </div>
    </div>
  );
}
