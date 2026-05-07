import { z } from "zod";
import { apiFetch, ensureOk, parseApiResponse } from "./client";

const userInfoSchema = z.object({
  email: z.string(),
  name: z.string(),
  organizationId: z.string(),
  userId: z.string(),
});

export type UserInfo = z.infer<typeof userInfoSchema>;

export async function login(
  email: string,
  password: string,
): Promise<UserInfo> {
  const res = await apiFetch("/api/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  await ensureOk(res);
  const body: unknown = await res.json();
  return parseApiResponse(userInfoSchema, body);
}

export async function logout(): Promise<void> {
  const res = await apiFetch("/api/logout", { method: "POST" });
  await ensureOk(res);
}

export async function me(): Promise<UserInfo | null> {
  const res = await apiFetch("/api/me");
  if (res.status === 401) return null;
  await ensureOk(res);
  const body: unknown = await res.json();
  return parseApiResponse(userInfoSchema, body);
}
