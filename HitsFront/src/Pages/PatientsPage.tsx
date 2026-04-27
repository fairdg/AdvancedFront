import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import ui from "../controls.module.css";
import { createPatient, getPatients, type InspectionConclusion } from "../api/patient";
import { useServerPagination } from "../hooks/useServerPagination";
import { formatDate, toIsoFromDate } from "../shared/date";
import { formatGender } from "../shared/medicalFormat";
import { buildSearch, firstParam, parseIntOr } from "../shared/urlSearch";
import s from "./PatientsPage.module.css";

function parseConclusion(value: string | null): "" | InspectionConclusion {
  return value === "Recovery" || value === "Disease" || value === "Death" ? value : "";
}

function buildPatientsPageLink(searchParams: URLSearchParams, page: number) {
  return { pathname: "/patients", search: buildSearch(searchParams, { page: String(page) }).toString() };
}

function createEmptyPatientForm() {
  return {
    name: "",
    birthday: "",
    gender: "Male" as "Male" | "Female",
  };
}

function normalizePatientsSearchParams(current: URLSearchParams) {
  const page = parseIntOr(firstParam(current, ["page", "current"]), 1);
  const pageSize = parseIntOr(firstParam(current, ["pageSize", "size"]), 5);
  const name = current.get("name") ?? "";
  const conclusion = parseConclusion(firstParam(current, ["conclusion", "conclusions"]));
  const sort = firstParam(current, ["sorting", "sort"]) ?? "NameAsc";
  const hasPlannedVisits = current.get("hasPlannedVisits") === "true" || current.get("planned") === "1";
  const onlyMine = current.get("onlyMine") === "true" || current.get("mine") === "1";

  const sp = new URLSearchParams(current);
  for (const k of ["page", "current", "pageSize", "size", "conclusions", "conclusion", "sorting", "sort", "hasPlannedVisits", "planned", "onlyMine", "mine"]) {
    sp.delete(k);
  }

  if (name.trim()) sp.set("name", name);
  if (conclusion) {
    sp.set("conclusion", conclusion);
    sp.set("conclusions", conclusion);
  }
  if (hasPlannedVisits) sp.set("hasPlannedVisits", "true");
  if (onlyMine) sp.set("onlyMine", "true");
  if (sort && sort !== "NameAsc") sp.set("sorting", sort);
  if (page !== 1) sp.set("page", String(page));
  if (pageSize !== 5) sp.set("pageSize", String(pageSize));

  return sp;
}

const conclusionOptions: Array<{ value: "" | InspectionConclusion; label: string }> = [
  { value: "", label: "Любое" },
  { value: "Recovery", label: "Выздоровление" },
  { value: "Disease", label: "Болезнь" },
  { value: "Death", label: "Смерть" },
];

const sortOptions: Array<{ value: string; label: string }> = [
  { value: "NameAsc", label: "Имя (А-Я)" },
  { value: "NameDesc", label: "Имя (Я-А)" },
  { value: "CreateDesc", label: "Создание (новые)" },
  { value: "CreateAsc", label: "Создание (старые)" },
  { value: "InspectionDesc", label: "Осмотры (новые)" },
  { value: "InspectionAsc", label: "Осмотры (старые)" },
];

export function PatientsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState(createEmptyPatientForm().name);
  const [newBirthday, setNewBirthday] = useState(createEmptyPatientForm().birthday);
  const [newGender, setNewGender] = useState<"Male" | "Female">(createEmptyPatientForm().gender);
  const isAddOpen = searchParams.get("add") === "1";

  const page = parseIntOr(firstParam(searchParams, ["page", "current"]), 1);
  const pageSize = parseIntOr(firstParam(searchParams, ["pageSize", "size"]), 5);
  const name = searchParams.get("name") ?? "";
  const conclusion = parseConclusion(firstParam(searchParams, ["conclusion", "conclusions"]));
  const hasPlannedVisits = searchParams.get("hasPlannedVisits") === "true" || searchParams.get("planned") === "1";
  const onlyMine = searchParams.get("onlyMine") === "true" || searchParams.get("mine") === "1";
  const sort = firstParam(searchParams, ["sorting", "sort"]) ?? "NameAsc";

  useEffect(() => {
    const normalized = normalizePatientsSearchParams(searchParams);
    if (normalized.toString() === searchParams.toString()) return;
    setSearchParams(normalized, { replace: true });
  }, [searchParams, setSearchParams]);

  const query = useQuery({
    queryKey: ["patients", page, pageSize, name, conclusion, hasPlannedVisits, onlyMine, sort],
    queryFn: () =>
      getPatients({
        page,
        pageSize,
        name: name.trim() || undefined,
        conclusion,
        hasPlannedVisits,
        onlyMine,
        sort,
      }),
    retry: 0,
  });

  const pagination = query.data?.pagination;
  const { totalPages, safePage, pageLinks } = useServerPagination({
    pagination,
    page,
    searchParams,
    setSearchParams,
  });

  const canCreatePatient = newName.trim().length > 0 && newBirthday.length > 0;
  const resetNewPatientForm = () => {
    const emptyPatientForm = createEmptyPatientForm();
    setNewName(emptyPatientForm.name);
    setNewBirthday(emptyPatientForm.birthday);
    setNewGender(emptyPatientForm.gender);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      createPatient({
        name: newName.trim(),
        birthday: toIsoFromDate(newBirthday),
        gender: newGender,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["patients"] });
      setSearchParams(buildSearch(searchParams, { add: null }), { replace: true });
      resetNewPatientForm();
    },
  });

  useEffect(() => {
    if (!isAddOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isAddOpen]);

  const closeAddModal = () => {
    setSearchParams(buildSearch(searchParams, { add: null }), { replace: true });
    createMutation.reset();
    resetNewPatientForm();
  };

  const openAddModal = () => {
    setSearchParams(buildSearch(searchParams, { add: "1" }));
  };

  return (
    <div className={s.container}>
      <div className={s.inner}>
        <div className={s.headerRow}>
          <h1 className={s.title}>Пациенты</h1>
          <button className={`${ui.button} ${ui.buttonSecondary}`} type="button" onClick={openAddModal}>
            + Новый пациент
          </button>
        </div>

        <div className={s.filters}>
          <div className={s.filtersRow}>
            <label className={ui.label}>
              <span>Поиск по имени</span>
              <input
                className={ui.input}
                value={name}
                onChange={(e) => setSearchParams(buildSearch(searchParams, { name: e.target.value, page: "1" }))}
                placeholder="Иван..."
              />
            </label>

            <label className={ui.label}>
              <span>Сортировка</span>
              <select
                className={ui.select}
                value={sort}
                onChange={(e) => setSearchParams(buildSearch(searchParams, { sorting: e.target.value, sort: null, page: "1" }))}
              >
                {sortOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={s.filtersRow} style={{ marginTop: 12 }}>
            <label className={ui.label}>
              <span>Заключение</span>
              <select
                className={ui.select}
                value={conclusion}
                onChange={(e) =>
                  setSearchParams(buildSearch(searchParams, { conclusion: e.target.value, conclusions: e.target.value, page: "1" }))
                }
              >
                {conclusionOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={ui.label}>
              <span>Размер страницы</span>
              <select
                className={ui.select}
                value={String(pageSize)}
                onChange={(e) => setSearchParams(buildSearch(searchParams, { pageSize: e.target.value, size: null, page: "1" }))}
              >
                {[5, 10, 20].map((n) => (
                  <option key={n} value={String(n)}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={s.checks}>
            <label className={s.check}>
              <input
                type="checkbox"
                checked={hasPlannedVisits}
                onChange={(e) =>
                  setSearchParams(
                    buildSearch(searchParams, {
                      hasPlannedVisits: e.target.checked ? "true" : null,
                      planned: null,
                      page: "1",
                    })
                  )
                }
              />
              Есть запланированные визиты
            </label>
            <label className={s.check}>
              <input
                type="checkbox"
                checked={onlyMine}
                onChange={(e) =>
                  setSearchParams(buildSearch(searchParams, { onlyMine: e.target.checked ? "true" : null, mine: null, page: "1" }))
                }
              />
              Мои пациенты
            </label>
          </div>
        </div>

        {query.isError ? <p className={ui.error}>{(query.error as Error).message}</p> : null}

        <div className={s.list}>
          {(query.data?.patients ?? []).map((p) => (
            <Link key={p.id} className={s.cardLink} to={`/patient/${p.id}`}>
              <div className={s.card}>
                <p className={s.cardTitle}>{p.name}</p>
                <p className={s.metaRow}>
                  <span className={s.metaKey}>Email —</span> <span className={s.metaValue}>{p.email?.trim() || "—"}</span>
                </p>
                <p className={s.metaRow}>
                  <span className={s.metaKey}>Пол —</span> <span className={s.metaValue}>{formatGender(p.gender)}</span>
                </p>
                <p className={s.metaRow}>
                  <span className={s.metaKey}>Дата рождения —</span>{" "}
                  <span className={s.metaValue}>{formatDate(p.birthday)}</span>
                </p>
              </div>
            </Link>
          ))}
        </div>

        <div className={s.pager}>
          <div className={s.pagerLinks}>
            <Link
              className={`${s.pageLink}${safePage <= 1 ? ` ${s.pageLinkDisabled}` : ""}`}
              to={buildPatientsPageLink(searchParams, Math.max(1, safePage - 1))}
              aria-disabled={safePage <= 1}
            >
              Назад
            </Link>

            {pageLinks.map((p) => {
              const isActive = p === safePage;
              return (
                <Link key={p} className={`${s.pageLink} ${isActive ? s.pageLinkActive : ""}`} to={buildPatientsPageLink(searchParams, p)}>
                  {p}
                </Link>
              );
            })}

            <Link
              className={`${s.pageLink}${safePage >= totalPages ? ` ${s.pageLinkDisabled}` : ""}`}
              to={buildPatientsPageLink(searchParams, Math.min(totalPages, safePage + 1))}
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

      {isAddOpen ? (
        <div
          className={s.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Новый пациент"
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return;
            closeAddModal();
          }}
        >
          <div className={s.modal}>
            <div className={s.modalHeader}>
              <h2 className={s.modalTitle}>Новый пациент</h2>
            </div>

            <form
              className={ui.form}
              onSubmit={(e) => {
                e.preventDefault();
                if (!canCreatePatient || createMutation.isPending) return;
                createMutation.mutate();
              }}
            >
              <label className={ui.label}>
                <span>ФИО</span>
                <input
                  className={ui.input}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Иванов Иван Иванович"
                />
              </label>

              <label className={ui.label}>
                <span>Пол</span>
                <select
                  className={ui.select}
                  value={newGender}
                  onChange={(e) => setNewGender(e.target.value as "Male" | "Female")}
                >
                  <option value="Male">Мужской</option>
                  <option value="Female">Женский</option>
                </select>
              </label>

              <label className={ui.label}>
                <span>Дата рождения</span>
                <input className={ui.input} type="date" value={newBirthday} onChange={(e) => setNewBirthday(e.target.value)} />
              </label>

              {createMutation.isError ? <div className={ui.error}>{(createMutation.error as Error).message}</div> : null}

              <div className={s.modalActions}>
                <button
                  className={`${ui.button} ${ui.buttonBlock}`}
                  type="submit"
                  disabled={!canCreatePatient || createMutation.isPending}
                >
                  {createMutation.isPending ? "Создание..." : "Добавить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
