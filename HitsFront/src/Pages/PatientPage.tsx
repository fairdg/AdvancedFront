import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import ui from "../controls.module.css";
import { getIcd10Roots } from "../api/dictionary";
import { getPatient, getPatientInspections } from "../api/patient";
import { useServerPagination } from "../hooks/useServerPagination";
import { formatDate } from "../shared/date";
import {
  buildNextByPrevious,
  buildRenderedChainItems,
  hasChainContinuation,
  rootFromIcd,
  toggleExpandedChainItem,
} from "../shared/inspectionChain";
import { formatConclusion } from "../shared/medicalFormat";
import { buildSearch, parseIntOr } from "../shared/urlSearch";
import s from "./PatientPage.module.css";

function getGenderPresentation(gender: "Male" | "Female" | undefined) {
  if (gender === "Female") return { mark: "♀", badgeClass: s.genderFemale };
  if (gender === "Male") return { mark: "♂", badgeClass: s.genderMale };
  return { mark: "•", badgeClass: "" };
}

function buildPatientPageLink(patientId: string, searchParams: URLSearchParams, nextPage: number) {
  return {
    pathname: `/patient/${patientId}`,
    search: buildSearch(searchParams, { page: String(nextPage) }).toString(),
  };
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

  const selectedRoot = icdRootId ? (rootsQuery.data ?? []).find((r) => r.id === icdRootId) ?? null : null;
  const selectedRootLetter = selectedRoot?.code ? rootFromIcd(selectedRoot.code) : null;

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
      }),
    enabled: Boolean(patientId),
    retry: 0,
  });

  const pagination = inspectionsQuery.data?.pagination;
  const { totalPages, safePage, pageLinks } = useServerPagination({
    pagination,
    page,
    searchParams,
    setSearchParams,
  });

  const filteredInspections = useMemo(() => {
    const inspections = inspectionsQuery.data?.inspections ?? [];
    if (!selectedRootLetter) return inspections;
    return inspections.filter((it) => rootFromIcd(it.diagnosis?.code) === selectedRootLetter);
  }, [inspectionsQuery.data?.inspections, selectedRootLetter]);

  const nextByPrev = useMemo(() => buildNextByPrevious(filteredInspections), [filteredInspections]);
  const inspectionsToRender = useMemo(
    () => buildRenderedChainItems(filteredInspections, grouped, expanded),
    [expanded, filteredInspections, grouped]
  );

  const isDead = (inspectionsQuery.data?.inspections ?? []).some((x) => x.conclusion === "Death");

  if (!patientId) return <div className={s.container}>Нет id пациента</div>;

  const patient = patientQuery.data;
  const { mark: genderMark, badgeClass: genderBadgeClass } = getGenderPresentation(patient?.gender);

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
          {inspectionsToRender.map(({ item: inspection, level, canExpand }) => {
            const isDeath = inspection.conclusion === "Death";
            const isExpanded = expanded.has(inspection.id);
            const hasChild = hasChainContinuation(nextByPrev, inspection);
            return (
              <div
                key={inspection.id}
                className={`${s.inspectionCard}${isDeath ? ` ${s.inspectionDeath}` : ""}${level > 0 ? ` ${s.inspectionNested}` : ""}`}
                style={{ ["--level" as never]: level }}
              >
                <div className={s.inspectionHeader}>
                  <div className={s.inspectionTitleWrap}>
                    {grouped && canExpand ? (
                      <button
                        className={s.chainToggle}
                        type="button"
                        aria-label={isExpanded ? "Скрыть следующий осмотр" : "Показать следующий осмотр"}
                        onClick={() => setExpanded((prev) => toggleExpandedChainItem(prev, inspection.id))}
                      >
                        {isExpanded ? "−" : "+"}
                      </button>
                    ) : null}
                    <span className={s.datePill}>{formatDate(inspection.date)}</span>
                    <p className={s.inspectionTitle}>Амбулаторный осмотр</p>
                  </div>
                  <div className={s.inspectionActions}>
                    <Link className={s.inspectionAction} to={`/inspection/${inspection.id}`}>
                      Детали осмотра
                    </Link>
                    <Link
                      className={`${s.inspectionAction}${isDead || hasChild ? ` ${s.inspectionActionDisabled}` : ""}`}
                      to={`/patient/${patientId}/inspections/create?previousInspectionId=${inspection.id}`}
                      aria-disabled={isDead || hasChild}
                      onClick={(e) => {
                        if (isDead || hasChild) e.preventDefault();
                      }}
                    >
                      Добавить осмотр
                    </Link>
                  </div>
                </div>

                <p className={s.inspectionMeta}>
                  Заключение: <b>{formatConclusion(inspection.conclusion)}</b>
                </p>
                <p className={s.inspectionMeta}>
                  Основной диагноз: <b>{inspection.diagnosis?.name}</b> ({inspection.diagnosis?.code})
                </p>
                <p className={s.inspectionMeta}>Медицинский работник: {inspection.doctor}</p>
              </div>
            );
          })}
        </div>

        <div className={s.pager}>
          <div className={s.pagerLinks}>
            <Link
              className={`${s.pageLink}${safePage <= 1 ? ` ${s.pageLinkDisabled}` : ""}`}
              to={buildPatientPageLink(patientId, searchParams, Math.max(1, safePage - 1))}
              aria-disabled={safePage <= 1}
            >
              Назад
            </Link>

            {pageLinks.map((p) => {
              const isActive = p === safePage;
              return (
                <Link
                  key={p}
                  className={`${s.pageLink} ${isActive ? s.pageLinkActive : ""}`}
                  to={buildPatientPageLink(patientId, searchParams, p)}
                >
                  {p}
                </Link>
              );
            })}

            <Link
              className={`${s.pageLink}${safePage >= totalPages ? ` ${s.pageLinkDisabled}` : ""}`}
              to={buildPatientPageLink(patientId, searchParams, Math.min(totalPages, safePage + 1))}
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
