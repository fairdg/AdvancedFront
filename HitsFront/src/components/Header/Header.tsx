import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "../../auth/authContext";
import { getDoctorProfile, logoutDoctor } from "../../api/doctor";
import s from "./Header.module.css";

export function Header() {
  const navigate = useNavigate();
  const { token, displayName, setToken } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRootRef = useRef<HTMLDivElement | null>(null);

  const profileQuery = useQuery({
    queryKey: ["doctorProfile"],
    queryFn: () => getDoctorProfile(),
    enabled: Boolean(token),
    retry: 0,
  });

  const logoutMutation = useMutation({
    mutationFn: () => logoutDoctor(),
    onSettled: () => {
      setToken(null);
      setIsMenuOpen(false);
      navigate("/login", { replace: true });
    },
  });

  useEffect(() => {
    if (!isMenuOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!menuRootRef.current) return;
      if (e.target instanceof Node && !menuRootRef.current.contains(e.target)) setIsMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <header className={s.root}>
      <div className={s.inner}>
        <Link className={s.brand} to={token ? "/patients" : "/login"}>
          HitsFront
        </Link>

        {token ? (
          <nav className={s.nav}>
            <NavLink
              className={({ isActive }) => `${s.navLink}${isActive ? ` ${s.navLinkActive}` : ""}`}
              to="/patients"
            >
              Пациенты
            </NavLink>
            <span className={`${s.navLink} ${s.navLinkDisabled}`}>
              Консультации
            </span>
            <span className={`${s.navLink} ${s.navLinkDisabled}`}>
              Отчеты и статистика
            </span>
          </nav>
        ) : (
          <div />
        )}

        <div className={s.right}>
          {!token ? (
            <Link className={s.action} to="/login">
              Вход
            </Link>
          ) : (
            <div className={s.menuWrap} ref={menuRootRef}>
              <button
                className={`${s.action} ${s.userAction}`}
                type="button"
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
                onClick={() => setIsMenuOpen((v) => !v)}
              >
                {profileQuery.data?.name?.trim()
                  ? profileQuery.data.name
                  : profileQuery.data?.email?.trim()
                    ? profileQuery.data.email
                    : displayName ?? "Профиль"}
              </button>

              {isMenuOpen ? (
                <div className={s.menu} role="menu">
                  <Link className={s.menuItem} role="menuitem" to="/profile" onClick={() => setIsMenuOpen(false)}>
                    Профиль
                  </Link>
                  <button
                    className={s.menuItem}
                    role="menuitem"
                    type="button"
                    disabled={logoutMutation.isPending}
                    onClick={() => {
                      if (logoutMutation.isPending) return;
                      logoutMutation.mutate();
                    }}
                  >
                    {logoutMutation.isPending ? "Выход..." : "Выйти"}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
