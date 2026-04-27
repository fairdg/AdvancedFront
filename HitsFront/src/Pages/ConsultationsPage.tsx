import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getConsultationInspections } from "../api/consultation";
import { getIcd10Roots } from "../api/dictionary";
import ui from "../controls.module.css";
import { useServerPagination } from "../hooks/useServerPagination";
import { formatDate } from "../shared/date";
import { buildRenderedChainItems, rootFromIcd, toggleExpandedChainItem } from "../shared/inspectionChain";
import { buildSearch, parseIntOr } from "../shared/urlSearch";
import s from "./ConsultationsPage.module.css";

export function ConsultationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const page = parseIntOr(searchParams.get("page"), 1);
  const pageSize = parseIntOr(searchParams.get("pageSize"), 6);
  const icdRootId = (searchParams.get("icdRoot") ?? "").trim();
  const grouped = searchParams.get("grouped") === "1";

  const rootsQuery = useQuery({
    queryKey: ["icd10Roots"],
    queryFn: () => getIcd10Roots(),
    retry: 0,
  });

  const selectedRoot = icdRootId ? (rootsQuery.data ?? []).find((item) => item.id === icdRootId) ?? null : null;
  const selectedRootLetter = rootFromIcd(selectedRoot?.code);

  const consultationsQuery = useQuery({
    queryKey: ["consultationInspections", page, pageSize, icdRootId, grouped],
    queryFn: () =>
      getConsultationInspections({
        page,
        pageSize,
        icdRoots: selectedRoot?.id ? [selectedRoot.id] : undefined,
      }),
    retry: 0,
  });

  const pagination = consultationsQuery.data?.pagination;
  const { totalPages, safePage, pageLinks } = useServerPagination({
    pagination,
    page,
    searchParams,
    setSearchParams,
  });

  const filteredInspections = useMemo(() => {
    const inspections = consultationsQuery.data?.inspections ?? [];
    if (!selectedRootLetter) return inspections;
    return inspections.filter((inspection) => rootFromIcd(inspection.diagnosis?.code) === selectedRootLetter);
  }, [consultationsQuery.data?.inspections, selectedRootLetter]);

  const inspectionsToRender = useMemo(
    () => buildRenderedChainItems(filteredInspections, grouped, expanded),
    [expanded, filteredInspections, grouped]
  );

  return (
    <div className={s.container}>
      <div className={s.inner}>
        <div className={s.headerRow}>
          <h1 className={s.title}>Консультации</h1>
        </div>

        {consultationsQuery.isError ? <p className={ui.error}>{(consultationsQuery.error as Error).message}</p> : null}
        {rootsQuery.isError ? <p className={ui.error}>{(rootsQuery.error as Error).message}</p> : null}

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
                {(rootsQuery.data ?? []).map((root) => (
                  <option key={root.id} value={root.id}>
                    {root.code} — {root.name}
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
                {[6, 10, 20].map((size) => (
                  <option key={size} value={String(size)}>
                    {size}
                  </option>
                ))}
              </select>
            </label>

            <div className={s.checks}>
              <label className={s.check}>
                <input
                  type="radio"
                  name="consultationGrouped"
                  checked={grouped}
                  onChange={() => setSearchParams(buildSearch(searchParams, { grouped: "1", page: "1" }))}
                />
                Сгруппировать по повторным
              </label>
              <label className={s.check}>
                <input
                  type="radio"
                  name="consultationGrouped"
                  checked={!grouped}
                  onChange={() => setSearchParams(buildSearch(searchParams, { grouped: null, page: "1" }))}
                />
                Показать все
              </label>
            </div>
          </div>
        </div>

        <div className={`${s.list}${grouped ? ` ${s.listSingle}` : ""}`}>
          {inspectionsToRender.map(({ item: inspection, level, canExpand }) => {
            const isExpanded = expanded.has(inspection.id);
            return (
              <div
                key={inspection.id}
                className={`${s.card}${level > 0 ? ` ${s.cardNested}` : ""}`}
                style={{ ["--level" as never]: level }}
                onClick={() => navigate(`/inspection/${inspection.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") navigate(`/inspection/${inspection.id}`);
                }}
              >
                <div className={s.cardHeader}>
                  <div className={s.cardTitleWrap}>
                    {grouped && canExpand ? (
                      <button
                        className={s.chainToggle}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpanded((prev) => toggleExpandedChainItem(prev, inspection.id));
                        }}
                      >
                        {isExpanded ? "−" : "+"}
                      </button>
                    ) : null}
                    <span className={s.datePill}>{formatDate(inspection.date)}</span>
                    <div>
                      <p className={s.cardTitle}>Амбулаторный осмотр</p>
                      <p className={s.cardMeta}>Пациент: {inspection.patient}</p>
                    </div>
                  </div>
                </div>

                <p className={s.cardMeta}>Основной диагноз: <b>{inspection.diagnosis?.name}</b> ({inspection.diagnosis?.code})</p>
                <p className={s.cardMeta}>Врач: {inspection.doctor}</p>
              </div>
            );
          })}
        </div>

        {!consultationsQuery.isLoading && inspectionsToRender.length === 0 ? (
          <div className={s.emptyState}>Подходящих консультаций пока нет.</div>
        ) : null}

        <div className={s.pager}>
          <div className={s.pagerLinks}>
            {pageLinks.map((current) => (
              <button
                key={current}
                className={`${s.pageLink}${current === safePage ? ` ${s.pageLinkActive}` : ""}`}
                type="button"
                onClick={() => setSearchParams(buildSearch(searchParams, { page: String(current) }))}
              >
                {current}
              </button>
            ))}
          </div>
          <div className={s.pagerInfo}>
            Стр. {safePage} / {totalPages}
          </div>
        </div>
      </div>
    </div>
  );
}
