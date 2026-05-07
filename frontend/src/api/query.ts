import { z } from "zod";
import { apiFetch, ensureOk, parseApiResponse } from "./client";

const queryResultSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.string())),
  limitExceeded: z.boolean(),
});

export type QueryResult = z.infer<typeof queryResultSchema>;

export type CsvEncoding = "utf-8" | "shift_jis";

export async function runQuery(soql: string): Promise<QueryResult> {
  const res = await apiFetch("/api/query", {
    method: "POST",
    body: JSON.stringify({ soql }),
  });
  await ensureOk(res);
  const body: unknown = await res.json();
  return parseApiResponse(queryResultSchema, body);
}

export async function downloadCsv(
  soql: string,
  encoding: CsvEncoding,
): Promise<Blob> {
  const res = await apiFetch(`/api/query/csv?encoding=${encoding}`, {
    method: "POST",
    body: JSON.stringify({ soql }),
  });
  await ensureOk(res);
  return res.blob();
}
