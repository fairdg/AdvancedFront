import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import type { Gender } from "../api/doctor";
import { registerDoctor } from "../api/doctor";
import { getSpecialities } from "../api/dictionary";
import ui from "../controls.module.css";
import page from "./RegistrationPage.module.css";

export const RegistrationPage = () => {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthday, setBirthday] = useState("");
  const [gender, setGender] = useState<Gender>("Male");
  const [phone, setPhone] = useState("");
  const [speciality, setSpeciality] = useState("");

  const specialitiesQuery = useQuery({
    queryKey: ["specialities"],
    queryFn: () => getSpecialities({ page: 1, size: 200 }),
  });

  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length > 0 &&
    birthday.length > 0 &&
    phone.trim().length > 0 &&
    speciality.trim().length > 0;

  const mutation = useMutation({
    mutationFn: () =>
      registerDoctor({
        name: name.trim(),
        email: email.trim(),
        password,
        birthday: new Date(birthday).toISOString(),
        gender,
        phone: phone.trim(),
        speciality: speciality.trim(),
      }),
    onSuccess: () => {
      navigate("/login");
    },
  });

  return (
    <div className={page.container}>
      <div className={page.card}>
        <div className={page.headerRow}>
          <h1 className={page.title}>Регистрация</h1>
        </div>

        <form
          className={ui.form}
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit || mutation.isPending) return;
            mutation.mutate();
          }}
        >
          <label className={ui.label}>
            <span>Имя</span>
            <input
              className={ui.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Иван Иванов"
            />
          </label>

          <label className={ui.label}>
            <span>Телефон</span>
            <input className={ui.input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7..." />
          </label>

          <div className={page.grid2}>
            <label className={ui.label}>
              <span>Пол</span>
              <select className={ui.select} value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
                <option value="Male">Мужской</option>
                <option value="Female">Женский</option>
              </select>
            </label>

            <label className={ui.label}>
              <span>Дата рождения</span>
              <input className={ui.input} value={birthday} onChange={(e) => setBirthday(e.target.value)} type="date" />
            </label>
          </div>

          <label className={ui.label}>
            <span>Специальность</span>
            <select
              className={ui.select}
              value={speciality}
              onChange={(e) => setSpeciality(e.target.value)}
              disabled={specialitiesQuery.isLoading}
            >
              <option value="" disabled>
                {specialitiesQuery.isLoading ? "Загрузка..." : "Выбери специальность"}
              </option>
              {(specialitiesQuery.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name?.trim() ? s.name : s.id}
                </option>
              ))}
            </select>
            {specialitiesQuery.isError ? <div className={ui.error}>{(specialitiesQuery.error as Error).message}</div> : null}
          </label>

          <label className={ui.label}>
            <span>Email</span>
            <input
              className={ui.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              inputMode="email"
            />
          </label>

          <label className={ui.label}>
            <span>Пароль</span>
            <input
              className={ui.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
            />
          </label>

          <button className={`${ui.button} ${ui.buttonBlock}`} type="submit" disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending ? "Отправка..." : "Зарегистрироваться"}
          </button>

          {mutation.isError ? <div className={ui.error}>{(mutation.error as Error).message}</div> : null}
        </form>

        <div className={page.footerRow}>
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </div>
      </div>
    </div>
  );
};
