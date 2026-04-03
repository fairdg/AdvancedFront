import { useMemo, useState, type ReactNode } from "react";
import { AuthContext, type AuthContextValue, type AuthUser } from "./authContext";

function decodeJwtPayload(token: string): unknown | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const base64Url = parts[1] ?? "";
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64Url.length / 4) * 4, "=");
    const json = globalThis.atob(base64);
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}

function deriveUser(token: string | null, hintEmail?: string): AuthUser | null {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload !== "object") return hintEmail ? { email: hintEmail } : null;

  const p = payload as Record<string, unknown>;

  const name =
    (typeof p.name === "string" ? p.name : undefined) ??
    (typeof p.preferred_username === "string" ? p.preferred_username : undefined) ??
    (typeof p.unique_name === "string" ? p.unique_name : undefined);

  const email =
    (typeof p.email === "string" ? p.email : undefined) ??
    (typeof p.upn === "string" ? p.upn : undefined) ??
    hintEmail;

  if (!name && !email) return null;
  return { name, email };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem("accessToken"));
  const [hintEmail, setHintEmail] = useState<string | undefined>(undefined);

  const value = useMemo<AuthContextValue>(() => {
    const user = deriveUser(token, hintEmail);
    const displayName = user?.name?.trim() ? user.name : user?.email?.trim() ? user.email : null;

    return {
      token,
      user,
      displayName,
      setToken: (nextToken, opts) => {
        setHintEmail(opts?.email);
        const normalized = nextToken?.trim().toLowerCase().startsWith("bearer ")
          ? nextToken.trim().slice("bearer ".length).trim()
          : nextToken?.trim() ?? null;
        if (normalized) localStorage.setItem("accessToken", normalized);
        else localStorage.removeItem("accessToken");
        setTokenState(normalized);
      },
    };
  }, [hintEmail, token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
