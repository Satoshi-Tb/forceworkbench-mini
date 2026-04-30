import { apiFetch, ensureOk } from "./client";

export type UserInfo = {
  email: string;
  name: string;
  organizationId: string;
  userId: string;
};

export async function login(
  email: string,
  password: string,
): Promise<UserInfo> {
  const res = await apiFetch("/api/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  await ensureOk(res);
  return res.json();
}

export async function logout(): Promise<void> {
  const res = await apiFetch("/api/logout", { method: "POST" });
  await ensureOk(res);
}

export async function me(): Promise<UserInfo | null> {
  const res = await apiFetch("/api/me");
  if (res.status === 401) return null;
  await ensureOk(res);
  return res.json();
}
