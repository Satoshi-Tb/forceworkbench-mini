import {
  Alert,
  Box,
  Button,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { createRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ApiError } from "../api/client";
import { downloadCsv, type QueryResult } from "../api/query";
import { ResultGrid } from "../components/ResultGrid";
import { SoqlQueryBuilder } from "../components/SoqlQueryBuilder";
import { useDescribeGlobal } from "../hooks/useDescribeGlobal";
import { useDescribeSObject } from "../hooks/useDescribeSObject";
import { useRunSoql } from "../hooks/useRunSoql";
import {
  buildSoql,
  createInitialQueryBuilderState,
  type QueryBuilderState,
} from "../utils/soqlBuilder";
import { rootRoute } from "./__root";

export const queryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/query",
  component: QueryPage,
});

function QueryPage() {
  const [builderState, setBuilderState] = useState<QueryBuilderState>(() =>
    createInitialQueryBuilderState(),
  );
  const [manualSoqlOverride, setManualSoqlOverride] = useState<string | null>(
    "SELECT Id, Name FROM Account LIMIT 10",
  );
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runSoql = useRunSoql();
  const {
    data: globalData,
    isLoading: objectsLoading,
    error: objectsError,
  } = useDescribeGlobal();
  const {
    data: describe,
    isLoading: describeLoading,
    error: describeError,
  } = useDescribeSObject(builderState.objectName || undefined);
  const objects = useMemo(
    () =>
      [...(globalData?.sobjects ?? [])]
        .filter((object) => object.queryable)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [globalData?.sobjects],
  );
  const derivedSoql = useMemo(
    () => buildSoql(builderState, describe?.fields ?? []),
    [builderState, describe?.fields],
  );
  const soql = manualSoqlOverride ?? derivedSoql;

  const handleBuilderChange = (next: QueryBuilderState) => {
    setBuilderState(next);
    setManualSoqlOverride(null);
  };

  const handleRun = async () => {
    setError(null);
    setResult(null);
    try {
      const next = await runSoql.mutateAsync(soql);
      setResult(withFallbackColumns(next, soql));
    } catch (e) {
      setResult(null);
      setError(e instanceof ApiError ? e.message : "SOQL実行に失敗しました");
    }
  };

  const handleCsv = async () => {
    setError(null);
    try {
      const blob = await downloadCsv(soql);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "query.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "CSVダウンロードに失敗しました",
      );
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h5" component="h1">
        SOQL
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {objectsError && (
        <Alert severity="error">オブジェクト情報の取得に失敗しました</Alert>
      )}
      {describeError && (
        <Alert severity="error">項目情報の取得に失敗しました</Alert>
      )}
      <SoqlQueryBuilder
        state={builderState}
        objects={objects}
        objectsLoading={objectsLoading}
        describe={describe}
        describeLoading={describeLoading}
        onChange={handleBuilderChange}
      />
      <TextField
        label="SOQL"
        value={soql}
        onChange={(event) => setManualSoqlOverride(event.target.value)}
        multiline
        minRows={4}
        fullWidth
      />
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button
          variant="contained"
          onClick={handleRun}
          disabled={runSoql.isPending}
        >
          実行
        </Button>
        <Button variant="outlined" onClick={handleCsv}>
          CSV
        </Button>
      </Box>
      {result?.limitExceeded && (
        <Alert severity="warning">
          取得結果が 2,000
          件で打ち切られました。検索条件を絞り込んで再実行してください。
        </Alert>
      )}
      {result && <ResultGrid result={result} />}
    </Stack>
  );
}

function withFallbackColumns(result: QueryResult, soql: string): QueryResult {
  if (result.columns.length > 0 || result.rows.length > 0) return result;
  // Salesforce の query 結果が 0 件の場合、レスポンスだけでは列情報を復元できない。
  // DataGrid が "No columns" ではなく "No rows" を表示できるよう、SELECT 句から列名を補完する。
  const columns = extractSelectedColumns(soql);
  return columns.length > 0 ? { ...result, columns } : result;
}

function extractSelectedColumns(soql: string): string[] {
  const match = soql.match(/^\s*select\s+([\s\S]+?)\s+from\s+/i);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((column) => column.trim())
    .filter((column) => column);
}
