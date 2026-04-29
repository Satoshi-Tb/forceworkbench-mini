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

function getCookie(name: string): string | null {
  const prefix = `${name}=`;
  const part = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(prefix));
  if (!part) return null;
  return decodeURIComponent(part.slice(prefix.length));
}
