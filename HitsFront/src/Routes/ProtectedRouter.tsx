import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

export function ProtectedRouter({ children }: { children: ReactNode }) {
  const token = localStorage.getItem("accessToken");
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
