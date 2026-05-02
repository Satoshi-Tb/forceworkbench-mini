import type { z } from "zod";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function apiFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const method = init?.method?.toUpperCase() ?? "GET";
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (method !== "GET" && method !== "HEAD") {
    const csrfToken = getCookie("XSRF-TOKEN");
    if (csrfToken) {
      headers.set("X-XSRF-TOKEN", csrfToken);
    }
  }

  const response = await fetch(input, {
    ...init,
    credentials: "include",
    headers,
  });

  if (
    response.status === 401 &&
    window.location.pathname !== "/login" &&
    input !== "/api/me"
  ) {
    window.location.assign("/login");
  }
  return response;
}

export async function ensureOk(res: Response): Promise<Response> {
  if (res.ok) return res;
  let code = "UNKNOWN";
  let message = `request failed: ${res.status}`;
  try {
    const body = await res.clone().json();
    if (typeof body?.code === "string") code = body.code;
    if (typeof body?.message === "string") message = body.message;
  } catch {
    // 非 JSON レスポンス → 既定値のまま
  }
  throw new ApiError(code, message, res.status);
}

export function parseApiResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new ApiError("INVALID_RESPONSE", "APIレスポンスの形式が不正です", 500);
}

function getCookie(name: string): string | null {
  const prefix = `${name}=`;
  const part = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(prefix));
  if (!part) return null;
  return decodeURIComponent(part.slice(prefix.length));
}
