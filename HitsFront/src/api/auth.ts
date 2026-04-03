export type LoginRequest = { email: string; password: string };
export type LoginResponse = { accessToken?: string; token?: string };

import { api } from "./client";

export async function login(body: LoginRequest): Promise<LoginResponse> {
  return api<LoginResponse>("/api/doctor/login", { method: "POST", json: body });
}
