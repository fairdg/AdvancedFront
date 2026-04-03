import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { login, type LoginResponse } from "../api/auth";
import { useAuth } from "../auth/authContext";
import ui from "../controls.module.css";
import page from "./StartPage.module.css";

export function StartPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { setToken } = useAuth();

  const mutation = useMutation({
    mutationFn: () => login({ email, password }),
    onSuccess: (data: LoginResponse) => {
      const token = data.accessToken ?? data.token;
      if (!token) {
        throw new Error("Token is missing in login response");
      }
      setToken(token, { email });
      navigate("/patients");
    },
  });

  return (
    <div className={page.container}>
      <div className={page.card}>
        <div className={page.headerRow}>
          <h1 className={page.title}>Вход</h1>
        </div>

        <form
          className={ui.form}
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <label className={ui.label}>
            <span>Email</span>
            <input
              className={ui.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
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

          <button className={`${ui.button} ${ui.buttonBlock}`} type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Вход..." : "Войти"}
          </button>

          {mutation.isError ? <div className={ui.error}>{(mutation.error as Error).message}</div> : null}
        </form>

        <div className={page.footerRow}>
          Нет аккаунта? <Link to="/registration">Зарегистрироваться</Link>
        </div>
      </div>
    </div>
  );
}
