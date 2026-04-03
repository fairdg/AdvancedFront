import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/authContext";
import { getDoctorProfile, type DoctorProfileUpdateRequest, updateDoctorProfile } from "../api/doctor";
import ui from "../controls.module.css";
import page from "./ProfilePage.module.css";

function toDateValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toIsoFromDate(value: string) {
  return new Date(value).toISOString();
}

export function ProfilePage() {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["doctorProfile"],
    queryFn: () => getDoctorProfile(),
    enabled: Boolean(token),
    retry: 0,
  });

  const initialForm = useMemo<DoctorProfileUpdateRequest | null>(() => {
    const data = profileQuery.data;
    if (data) {
      return {
        email: data.email,
        name: data.name,
        phone: data.phone,
        gender: data.gender,
        birthday: data.birthday,
      };
    }
    if (user?.email || user?.name) {
      return {
        email: user.email ?? "",
        name: user.name ?? "",
        phone: "",
        gender: "Male",
        birthday: new Date().toISOString(),
      };
    }
    return null;
  }, [profileQuery.data, user?.email, user?.name]);

  const [form, setForm] = useState<DoctorProfileUpdateRequest | null>(initialForm);

  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  const updateMutation = useMutation({
    mutationFn: (body: DoctorProfileUpdateRequest) => updateDoctorProfile(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctorProfile"] });
    },
  });

  if (profileQuery.isLoading || !form) {
    return (
      <div className={page.container}>
        <div className={page.card}>
          <div className={page.headerRow}>
            <h1 className={page.title}>Профиль</h1>
          </div>
          <p className={`${ui.muted} ${page.note}`}>Загрузка профиля...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={page.container}>
      <div className={page.card}>
        <div className={page.headerRow}>
          <h1 className={page.title}>Профиль</h1>
        </div>

        <form
          className={ui.form}
          onSubmit={(e) => {
            e.preventDefault();
            if (updateMutation.isPending) return;
            updateMutation.mutate(form);
          }}
        >
          <label className={ui.label}>
            <span>ФИО</span>
            <input
              className={ui.input}
              value={form.name}
              onChange={(e) => setForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
              placeholder="Иван Иванов"
            />
          </label>

          <div className={page.grid2}>
            <label className={ui.label}>
              <span>Пол</span>
              <select
                className={ui.select}
                value={form.gender}
                onChange={(e) =>
                  setForm((prev) => (prev ? { ...prev, gender: e.target.value as DoctorProfileUpdateRequest["gender"] } : prev))
                }
              >
                <option value="Male">Мужской</option>
                <option value="Female">Женский</option>
              </select>
            </label>

            <label className={ui.label}>
              <span>Дата рождения</span>
              <input
                className={ui.input}
                type="date"
                value={form.birthday ? toDateValue(form.birthday) : ""}
                onChange={(e) => setForm((prev) => (prev ? { ...prev, birthday: toIsoFromDate(e.target.value) } : prev))}
              />
            </label>
          </div>

          <label className={ui.label}>
            <span>Телефон</span>
            <input
              className={ui.input}
              value={form.phone}
              onChange={(e) => setForm((prev) => (prev ? { ...prev, phone: e.target.value } : prev))}
              placeholder="+7..."
            />
          </label>

          <label className={ui.label}>
            <span>Email</span>
            <input
              className={ui.input}
              value={form.email}
              onChange={(e) => setForm((prev) => (prev ? { ...prev, email: e.target.value } : prev))}
              placeholder="user@example.com"
              inputMode="email"
            />
          </label>

          {updateMutation.isError ? <div className={ui.error}>{(updateMutation.error as Error).message}</div> : null}

          <div className={page.submitRow}>
            <button className={`${ui.button} ${ui.buttonBlock}`} type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Сохранение..." : "Сохранить изменения"}
            </button>
          </div>
        </form>

        {profileQuery.isError ? (
          <p className={`${ui.muted} ${page.note}`}>Профиль не загрузился: {(profileQuery.error as Error).message}</p>
        ) : null}
      </div>
    </div>
  );
}
