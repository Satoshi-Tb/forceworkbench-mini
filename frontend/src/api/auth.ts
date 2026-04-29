import { apiFetch } from "./client";

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
  if (!res.ok) {
    throw new Error(`login failed: ${res.status}`);
  }
  return res.json();
}

export async function logout(): Promise<void> {
  const res = await apiFetch("/api/logout", { method: "POST" });
  if (!res.ok) {
    throw new Error(`logout failed: ${res.status}`);
  }
}

export async function me(): Promise<UserInfo | null> {
  const res = await apiFetch("/api/me");
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(`me failed: ${res.status}`);
  }
  return res.json();
}
