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
import { useSetAtom } from "jotai";
import { useMemo, useState } from "react";
import type { QueryResult } from "../../api/query";
import { ResultGrid } from "../ResultGrid";
import { SoqlQueryBuilder } from "../SoqlQueryBuilder";
import { getApiErrorMessage } from "../../hooks/apiErrorMessage";
import { useDescribeGlobal } from "../../hooks/useDescribeGlobal";
import { useDescribeSObject } from "../../hooks/useDescribeSObject";
import { useExportCsv, type CsvEncoding } from "../../hooks/useExportCsv";
import { useRunSoql } from "../../hooks/useRunSoql";
import {
  tabsAtom,
  updateWorkbenchTab,
  type SoqlTabState,
  type WorkbenchTab,
} from "../../state/workbenchAtoms";
import { buildSoql, type QueryBuilderState } from "../../utils/soqlBuilder";

type SoqlTab = Extract<WorkbenchTab, { kind: "soql" }>;

export function SoqlTabContent({ tab }: { tab: SoqlTab }) {
  const setTabs = useSetAtom(tabsAtom);
  const [result, setResult] = useState<QueryResult | null>(null);
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
  } = useDescribeSObject(tab.state.builderState.objectName || undefined);
  const objects = useMemo(
    () =>
      [...(globalData?.sobjects ?? [])]
        .filter((object) => object.queryable)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [globalData?.sobjects],
  );
  const derivedSoql = useMemo(
    () => buildSoql(tab.state.builderState, describe?.fields ?? []),
    [tab.state.builderState, describe?.fields],
  );
  const soql = tab.state.manualSoqlOverride ?? derivedSoql;
  const queryError = runSoql.error
    ? getApiErrorMessage(runSoql.error, "SOQL実行に失敗しました")
    : null;
  const csvError = exportCsv.error
    ? getApiErrorMessage(exportCsv.error, "CSVダウンロードに失敗しました")
    : null;
  const error = csvError ?? queryError;

  const updateState = (patch: Partial<SoqlTabState>) => {
    setTabs((tabs) =>
      updateWorkbenchTab(tabs, tab.id, (current) =>
        current.kind === "soql"
          ? { ...current, state: { ...current.state, ...patch } }
          : current,
      ),
    );
  };

  const handleBuilderChange = (builderState: QueryBuilderState) => {
    updateState({ builderState, manualSoqlOverride: null });
  };

  const handleRun = () => {
    exportCsv.reset();
    runSoql.reset();
    runSoql.mutate(soql, {
      onSuccess: (data) => {
        setResult(data);
        updateState({ lastRunSoql: soql });
      },
    });
  };

  const handleCsv = () => {
    exportCsv.reset();
    exportCsv.mutate({
      soql,
      encoding: tab.state.csvEncoding,
      filename: `query_${formatJstTimestamp(new Date())}.csv`,
    });
  };

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      {objectsError && (
        <Alert severity="error">オブジェクト情報の取得に失敗しました</Alert>
      )}
      {describeError && (
        <Alert severity="error">項目情報の取得に失敗しました</Alert>
      )}
      <SoqlQueryBuilder
        state={tab.state.builderState}
        objects={objects}
        objectsLoading={objectsLoading}
        describe={describe}
        describeLoading={describeLoading}
        onChange={handleBuilderChange}
      />
      <TextField
        label="SOQL"
        value={soql}
        onChange={(event) =>
          updateState({ manualSoqlOverride: event.target.value })
        }
        multiline
        minRows={4}
        fullWidth
      />
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        <Button
          variant="contained"
          onClick={handleRun}
          disabled={runSoql.isPending || !soql.trim()}
        >
          実行
        </Button>
        <Button
          variant="outlined"
          onClick={handleCsv}
          disabled={exportCsv.isPending || !soql.trim()}
        >
          CSV
        </Button>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id={`${tab.id}-csv-encoding-label`}>
            CSV文字コード
          </InputLabel>
          <Select
            labelId={`${tab.id}-csv-encoding-label`}
            value={tab.state.csvEncoding}
            label="CSV文字コード"
            onChange={(event) =>
              updateState({ csvEncoding: event.target.value as CsvEncoding })
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
