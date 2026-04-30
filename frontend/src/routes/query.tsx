import {
  Alert,
  Box,
  Button,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { createRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ApiError } from "../api/client";
import { downloadCsv, nextQueryPage, type QueryResult } from "../api/query";
import { ResultGrid } from "../components/ResultGrid";
import { useRunSoql } from "../hooks/useRunSoql";
import { rootRoute } from "./__root";

export const queryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/query",
  component: QueryPage,
});

function QueryPage() {
  const [soql, setSoql] = useState("SELECT Id, Name FROM Account LIMIT 10");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runSoql = useRunSoql();

  const handleRun = async () => {
    setError(null);
    try {
      const next = await runSoql.mutateAsync(soql);
      setResult(next);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "SOQL実行に失敗しました");
    }
  };

  const handleNext = async () => {
    if (!result?.queryRunId) return;
    setError(null);
    try {
      setResult(await nextQueryPage(result.queryRunId));
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "次のページの取得に失敗しました",
      );
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
      <TextField
        label="SOQL"
        value={soql}
        onChange={(event) => setSoql(event.target.value)}
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
        <Button
          variant="outlined"
          onClick={handleNext}
          disabled={result?.done ?? true}
        >
          次のページ
        </Button>
        <Button variant="outlined" onClick={handleCsv}>
          CSV
        </Button>
      </Box>
      {result && <ResultGrid result={result} />}
    </Stack>
  );
}
