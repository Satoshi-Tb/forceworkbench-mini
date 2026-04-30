import {
  Box,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useState } from "react";
import type { DescribeSObject, SObjectSummary } from "../api/describe";
import { useDescribeGlobal } from "../hooks/useDescribeGlobal";
import { useDescribeSObject } from "../hooks/useDescribeSObject";
import { ObjectPicker } from "./ObjectPicker";

export function DescribeWorkspace({ sobject }: { sobject?: string }) {
  const { data: globalData, isLoading: loadingObjects } = useDescribeGlobal();
  const { data: describe, isLoading: loadingDescribe } = useDescribeSObject(sobject);
  const [tab, setTab] = useState("overview");

  const objects = globalData?.sobjects ?? [];
  const selectedSummary = objects.find((object) => object.name === sobject);

  return (
    <Stack spacing={2}>
      <Typography variant="h5" component="h1">
        参照情報
      </Typography>
      <Grid container spacing={2} alignItems="stretch">
        <Grid item xs={12} md={4}>
          <ObjectPicker
            objects={objects}
            loading={loadingObjects}
            selectedObject={sobject}
          />
        </Grid>
        <Grid item xs={12} md={8}>
          <ObjectDetailPanel
            describe={describe}
            loading={Boolean(sobject) && loadingDescribe}
            selectedSummary={selectedSummary}
            tab={tab}
            onTabChange={setTab}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}

function ObjectDetailPanel({
  describe,
  loading,
  selectedSummary,
  tab,
  onTabChange,
}: {
  describe: DescribeSObject | undefined;
  loading: boolean;
  selectedSummary: SObjectSummary | undefined;
  tab: string;
  onTabChange: (tab: string) => void;
}) {
  if (!selectedSummary && !describe) {
    return (
      <Paper variant="outlined" sx={{ p: 3, minHeight: 360 }}>
        <Typography color="text.secondary">
          オブジェクトを選択してください。
        </Typography>
      </Paper>
    );
  }

  const label = describe?.label ?? selectedSummary?.label ?? "";
  const name = describe?.name ?? selectedSummary?.name ?? "";
  const custom = describe?.custom ?? selectedSummary?.custom ?? false;

  return (
    <Paper variant="outlined" sx={{ minHeight: 520 }}>
      <Box sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Typography variant="h5" component="h2">
            {label || name}
          </Typography>
          <Chip
            size="small"
            label={custom ? "カスタムオブジェクト" : "標準オブジェクト"}
            color={custom ? "secondary" : "primary"}
            variant="outlined"
          />
        </Stack>
        {label && label !== name && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {name}
          </Typography>
        )}
      </Box>
      <Divider />
      <Tabs value={tab} onChange={(_, value: string) => onTabChange(value)}>
        <Tab value="overview" label="概要" />
        <Tab value="fields" label="項目" />
        <Tab value="relationships" label="リレーション" />
      </Tabs>
      <Divider />
      <Box sx={{ p: 2.5 }}>
        {loading && <CircularProgress size={24} />}
        {!loading && tab === "overview" && describe && (
          <OverviewTab describe={describe} />
        )}
        {!loading && tab === "fields" && (
          <Typography color="text.secondary">
            項目タブは次の実装ステップで更新します。
          </Typography>
        )}
        {!loading && tab === "relationships" && (
          <Typography color="text.secondary">
            リレーションタブは次の実装ステップで更新します。
          </Typography>
        )}
      </Box>
    </Paper>
  );
}

function OverviewTab({ describe }: { describe: DescribeSObject }) {
  const rows = [
    ["API 参照名", describe.name],
    ["ラベル", describe.label],
    ["カスタム", formatBoolean(describe.custom)],
    ["検索で使用可能", formatBoolean(describe.searchable)],
    ["レポートで使用可能", formatBoolean(describe.layoutable)],
    ["取得可能", formatBoolean(describe.retrieveable)],
    ["作成可能", formatBoolean(describe.createable)],
    ["更新可能", formatBoolean(describe.updateable)],
    ["削除可能", formatBoolean(describe.deletable)],
    ["マージ可能", formatBoolean(describe.mergeable)],
    ["クエリ可能", formatBoolean(describe.queryable)],
    ["トリガー可能", formatBoolean(describe.triggerable)],
    ["名前空間プレフィックス", describe.keyPrefix || "なし"],
  ];

  return (
    <Stack spacing={2}>
      <Typography variant="h6">基本情報</Typography>
      <Box
        component="dl"
        sx={{
          display: "grid",
          gridTemplateColumns: "minmax(180px, 240px) 1fr",
          m: 0,
          rowGap: 1.25,
        }}
      >
        {rows.map(([label, value]) => (
          <Box key={label} sx={{ display: "contents" }}>
            <Typography component="dt" color="text.secondary">
              {label}
            </Typography>
            <Typography component="dd" sx={{ m: 0 }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Stack>
  );
}

function formatBoolean(value: boolean) {
  return value ? "はい" : "いいえ";
}
