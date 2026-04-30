import { apiFetch, ensureOk } from "./client";

export type QueryResult = {
  queryRunId: string | null;
  columns: string[];
  rows: Record<string, string>[];
  done: boolean;
};

export async function runQuery(soql: string): Promise<QueryResult> {
  const res = await apiFetch("/api/query", {
    method: "POST",
    body: JSON.stringify({ soql }),
  });
  await ensureOk(res);
  return res.json();
}

export async function nextQueryPage(runId: string): Promise<QueryResult> {
  const res = await apiFetch(`/api/query/runs/${runId}/next`);
  await ensureOk(res);
  return res.json();
}

export async function downloadCsv(soql: string): Promise<Blob> {
  const res = await apiFetch("/api/query/csv", {
    method: "POST",
    body: JSON.stringify({ soql }),
  });
  await ensureOk(res);
  return res.blob();
}
