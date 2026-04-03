import { createContext, useContext } from "react";

export type AuthUser = {
  name?: string;
  email?: string;
};

export type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  displayName: string | null;
  setToken: (token: string | null, opts?: { email?: string }) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider />");
  return ctx;
}

