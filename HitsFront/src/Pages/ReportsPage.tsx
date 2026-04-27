import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getIcd10Roots, type Icd10Root } from "../api/dictionary";
import { getIcdRootsReport, type IcdRootsReportQuery } from "../api/report";
import ui from "../controls.module.css";
import { formatDate } from "../shared/date";
import { formatGender } from "../shared/medicalFormat";
import s from "./ReportsPage.module.css";

function todayDateValue() {
  const date = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toDateStartIso(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toDateEndIso(value: string) {
  const date = new Date(`${value}T23:59:59.999`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function rootLabel(rootId: string, roots: Icd10Root[]) {
  const root = roots.find((item) => item.id === rootId);
  if (!root) return { code: rootId, name: "" };
  return { code: root.code, name: root.name };
}

function compareRootIds(a: string, b: string, roots: Icd10Root[]) {
  const left = rootLabel(a, roots);
  const right = rootLabel(b, roots);
  return left.code.localeCompare(right.code, "ru");
}

function toggleRootSelection(selectedRootIds: string[], rootId: string) {
  return selectedRootIds.includes(rootId)
    ? selectedRootIds.filter((item) => item !== rootId)
    : [...selectedRootIds, rootId];
}

export function ReportsPage() {
  const [startDate, setStartDate] = useState(() => todayDateValue());
  const [endDate, setEndDate] = useState(() => todayDateValue());
  const [selectedRootIds, setSelectedRootIds] = useState<string[]>([]);
  const [submittedFilters, setSubmittedFilters] = useState<IcdRootsReportQuery | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isRootsOpen, setIsRootsOpen] = useState(false);

  const rootsQuery = useQuery({
    queryKey: ["icd10Roots"],
    queryFn: () => getIcd10Roots(),
    retry: 0,
  });

  const sortedRoots = [...(rootsQuery.data ?? [])].sort((a, b) => a.code.localeCompare(b.code, "ru"));

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    const startIso = toDateStartIso(startDate);
    const endIso = toDateEndIso(endDate);

    if (!startDate) errors.push("Укажи дату начала периода.");
    if (!endDate) errors.push("Укажи дату конца периода.");
    if (startDate && !startIso) errors.push("Дата начала периода указана некорректно.");
    if (endDate && !endIso) errors.push("Дата конца периода указана некорректно.");
    if (startIso && endIso && new Date(startIso).getTime() > new Date(endIso).getTime()) {
      errors.push("Дата начала не может быть позже даты конца.");
    }

    return errors;
  }, [endDate, startDate]);

  const reportQuery = useQuery({
    queryKey: ["icdRootsReport", submittedFilters],
    queryFn: () => getIcdRootsReport(submittedFilters!),
    enabled: Boolean(submittedFilters),
    retry: 0,
  });

  const sortedColumnIds = useMemo(() => {
    const roots = rootsQuery.data ?? [];
    const summaryKeys = Object.keys(reportQuery.data?.summaryByRoot ?? {});
    const selectedKeys = reportQuery.data?.filters.icdRoots ?? submittedFilters?.icdRoots ?? [];
    const recordKeys = (reportQuery.data?.records ?? []).flatMap((record) => Object.keys(record.visitsByRoot ?? {}));
    return Array.from(new Set([...summaryKeys, ...selectedKeys, ...recordKeys])).sort((a, b) => compareRootIds(a, b, roots));
  }, [reportQuery.data?.filters.icdRoots, reportQuery.data?.records, reportQuery.data?.summaryByRoot, rootsQuery.data, submittedFilters?.icdRoots]);

  const hasResults = Boolean(reportQuery.data);
  const isGenerating = Boolean(submittedFilters) && reportQuery.isFetching;
  const selectedRootsCount = selectedRootIds.length;

  const submitFilters = () => {
    setSubmittedFilters({
      start: toDateStartIso(startDate)!,
      end: toDateEndIso(endDate)!,
      icdRoots: selectedRootIds,
    });
  };

  return (
    <div className={s.container}>
      <div className={s.inner}>
        <div className={s.headerRow}>
          <div>
            <h1 className={s.title}>Отчеты и статистика</h1>
            <p className={s.subtitle}>Статистика осмотров по пациентам и корням МКБ-10.</p>
          </div>
        </div>

        <section className={s.panel}>
          <form
            className={ui.form}
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitAttempted(true);
              if (validationErrors.length) return;
              submitFilters();
            }}
          >
            <div className={s.formGrid}>
              <label className={ui.label}>
                <span>Начало периода</span>
                <input className={ui.input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>

              <label className={ui.label}>
                <span>Конец периода</span>
                <input className={ui.input} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </label>
            </div>

            <div className={s.rootsBlock}>
              <p className={s.rootsLabel}>Корни МКБ-10</p>
              <div className={s.rootsCompact}>
                <div className={s.dropdown}>
                  <button
                    className={`${ui.button} ${ui.buttonSecondary} ${s.dropdownButton}`}
                    type="button"
                    onClick={() => setIsRootsOpen((value) => !value)}
                    disabled={rootsQuery.isLoading}
                  >
                    {selectedRootsCount ? `Выбрано корней: ${selectedRootsCount}` : "Все корни МКБ-10"}
                  </button>

                  {isRootsOpen ? (
                    <div className={s.dropdownPanel}>
                      {sortedRoots.map((root) => {
                        const checked = selectedRootIds.includes(root.id);
                        return (
                          <label className={s.rootOption} key={root.id}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setSelectedRootIds((prev) => toggleRootSelection(prev, root.id))}
                            />
                            <span>
                              <span className={s.rootCode}>{root.code}</span> {root.name}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                {!rootsQuery.isLoading && !sortedRoots.length ? (
                  <p className={ui.muted}>Корни МКБ-10 не загрузились.</p>
                ) : null}
                <div className={s.compactMeta}>
                  <span className={s.selectionBadge}>
                    Выбрано: {selectedRootsCount ? selectedRootsCount : "все"}
                  </span>
                  {selectedRootsCount ? (
                    <button
                      className={`${ui.button} ${ui.buttonSecondary}`}
                      type="button"
                      onClick={() => setSelectedRootIds([])}
                    >
                      Сбросить выбор
                    </button>
                  ) : null}
                </div>
              </div>
              <p className={ui.muted}>Если ничего не выбрать, отчет будет построен по всем корням МКБ-10.</p>
            </div>

            {submitAttempted && validationErrors.length ? (
              <div className={ui.error}>
                {validationErrors.map((error) => (
                  <div key={error}>{error}</div>
                ))}
              </div>
            ) : null}
            {rootsQuery.isError ? <div className={ui.error}>{(rootsQuery.error as Error).message}</div> : null}
            {reportQuery.isError ? <div className={ui.error}>{(reportQuery.error as Error).message}</div> : null}

            <div className={s.actions}>
              <button className={ui.button} type="submit" disabled={isGenerating}>
                {isGenerating ? "Формирование..." : "Сформировать отчет"}
              </button>
            </div>
          </form>
        </section>

        {hasResults ? (
          <section className={s.panel}>
            <div className={s.resultHeader}>
              <h2 className={s.resultTitle}>Результат</h2>
              <div className={s.chips}>
                <span className={s.chip}>Период: {formatDate(reportQuery.data!.filters.start)} - {formatDate(reportQuery.data!.filters.end)}</span>
                <span className={s.chip}>
                  Корни: {reportQuery.data!.filters.icdRoots.length ? reportQuery.data!.filters.icdRoots.length : "все"}
                </span>
              </div>
            </div>

            {reportQuery.data!.records.length === 0 ? (
              <div className={s.emptyState}>Нет данных</div>
            ) : (
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Пациент</th>
                      {sortedColumnIds.map((rootId) => {
                        const root = rootLabel(rootId, rootsQuery.data ?? []);
                        return (
                          <th key={rootId}>
                            {root.code}
                            {root.name ? ` ${root.name}` : ""}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {reportQuery.data!.records.map((record) => (
                      <tr key={`${record.patientName}-${record.patientBirthdate}`}>
                        <td className={s.patientCell}>
                          <p className={s.patientName}>{record.patientName || "Без имени"}</p>
                          <p className={s.patientMeta}>
                            {formatDate(record.patientBirthdate)} • {formatGender(record.gender)}
                          </p>
                        </td>
                        {sortedColumnIds.map((rootId) => (
                          <td className={s.countCell} key={rootId}>
                            {record.visitsByRoot?.[rootId] ?? 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className={s.summaryRow}>
                      <td>Итого</td>
                      {sortedColumnIds.map((rootId) => (
                        <td className={s.countCell} key={rootId}>
                          {reportQuery.data!.summaryByRoot?.[rootId] ?? 0}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
