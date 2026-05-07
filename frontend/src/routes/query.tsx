import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { createRoute } from "@tanstack/react-router";
import { useAtom } from "jotai";
import { useMemo, useState } from "react";
import { ResultGrid } from "../components/ResultGrid";
import { SoqlQueryBuilder } from "../components/SoqlQueryBuilder";
import { getApiErrorMessage } from "../hooks/apiErrorMessage";
import { useDescribeGlobal } from "../hooks/useDescribeGlobal";
import { useDescribeSObject } from "../hooks/useDescribeSObject";
import { useExportCsv, type CsvEncoding } from "../hooks/useExportCsv";
import { useRunSoql } from "../hooks/useRunSoql";
import {
  builderStateAtom,
  manualSoqlOverrideAtom,
} from "../state/uiStateAtoms";
import { buildSoql, type QueryBuilderState } from "../utils/soqlBuilder";
import { rootRoute } from "./__root";

export const queryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/query",
  component: QueryPage,
});

function QueryPage() {
  const [builderState, setBuilderState] = useAtom(builderStateAtom);
  const [manualSoqlOverride, setManualSoqlOverride] = useAtom(
    manualSoqlOverrideAtom,
  );
  const [csvEncoding, setCsvEncoding] = useState<CsvEncoding>("shift_jis");
  const runSoql = useRunSoql();
  const exportCsv = useExportCsv();
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
  const result = runSoql.data ?? null;
  const queryError = runSoql.error
    ? getApiErrorMessage(runSoql.error, "SOQL実行に失敗しました")
    : null;
  const csvError = exportCsv.error
    ? getApiErrorMessage(exportCsv.error, "CSVダウンロードに失敗しました")
    : null;
  const error = csvError ?? queryError;

  const handleBuilderChange = (next: QueryBuilderState) => {
    setBuilderState(next);
    setManualSoqlOverride(null);
  };

  const handleRun = () => {
    exportCsv.reset();
    runSoql.reset();
    runSoql.mutate(soql);
  };

  const handleCsv = () => {
    exportCsv.reset();
    exportCsv.mutate({
      soql,
      encoding: csvEncoding,
      filename: `query_${formatJstTimestamp(new Date())}.csv`,
    });
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
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        <Button
          variant="contained"
          onClick={handleRun}
          disabled={runSoql.isPending}
        >
          実行
        </Button>
        <Button
          variant="outlined"
          onClick={handleCsv}
          disabled={exportCsv.isPending}
        >
          CSV
        </Button>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="csv-encoding-label">CSV文字コード</InputLabel>
          <Select
            labelId="csv-encoding-label"
            value={csvEncoding}
            label="CSV文字コード"
            onChange={(event) =>
              setCsvEncoding(event.target.value as CsvEncoding)
            }
          >
            <MenuItem value="utf-8">UTF-8</MenuItem>
            <MenuItem value="shift_jis">Shift_JIS</MenuItem>
          </Select>
        </FormControl>
      </Box>
      {result?.limitExceeded && (
        <Alert severity="warning">
          取得結果が 2,000
          件で打ち切られました。検索条件を絞り込んで再実行してください。
        </Alert>
      )}
      {result &&
        (result.rows.length > 0 ? (
          <ResultGrid result={result} />
        ) : (
          <Typography>検索結果は0件です</Typography>
        ))}
    </Stack>
  );
}

function formatJstTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .filter((part) => part.type !== "literal")
    .map((part) => part.value)
    .join("");
}
