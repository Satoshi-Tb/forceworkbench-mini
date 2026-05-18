import {
  Box,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import {
  DataGrid,
  type GridColDef,
  type GridRowSelectionModel,
} from "@mui/x-data-grid";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import type {
  ChildRelationship,
  DescribeSObject,
  Field,
  PicklistValue,
} from "../../api/describe";
import { useDescribeSObject } from "../../hooks/useDescribeSObject";
import {
  describeActiveSubTabAtomFamily,
  describeSelectedFieldNameAtomFamily,
  describeSObjectNameAtomFamily,
  tabsAtom,
  updateWorkbenchTab,
  type DescribeSubTab,
  type WorkbenchTab,
} from "../../state/workbenchAtoms";

type DescribeTab = Extract<WorkbenchTab, { kind: "describe" }>;

export function DescribeTabContent({ tab }: { tab: DescribeTab }) {
  const setTabs = useSetAtom(tabsAtom);
  const sobjectName = useAtomValue(describeSObjectNameAtomFamily(tab.id));
  const [activeSubTab, setActiveSubTab] = useAtom(
    describeActiveSubTabAtomFamily(tab.id),
  );
  const { data: describe, isLoading } = useDescribeSObject(sobjectName);

  useEffect(() => {
    if (!describe) return;
    const title =
      describe.label === describe.name
        ? describe.name
        : `${describe.label} (${describe.name})`;
    setTabs((tabs) =>
      updateWorkbenchTab(tabs, tab.id, (current) =>
        current.kind === "describe" ? { ...current, title } : current,
      ),
    );
  }, [describe, setTabs, tab.id]);

  return (
    <Paper variant="outlined">
      <Box sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Typography variant="h5" component="h2">
            {describe?.label ?? sobjectName}
          </Typography>
          {describe && (
            <Chip
              size="small"
              label={
                describe.custom ? "カスタムオブジェクト" : "標準オブジェクト"
              }
              color={describe.custom ? "secondary" : "primary"}
              variant="outlined"
            />
          )}
        </Stack>
        {describe && describe.label !== describe.name && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {describe.name}
          </Typography>
        )}
      </Box>
      <Divider />
      <Tabs
        value={activeSubTab}
        onChange={(_, value: DescribeSubTab) => setActiveSubTab(value)}
      >
        <Tab value="overview" label="概要" />
        <Tab value="fields" label="項目" />
        <Tab value="relationships" label="リレーション" />
      </Tabs>
      <Divider />
      <Box sx={{ p: 2.5 }}>
        {isLoading && <CircularProgress size={24} />}
        {!isLoading && activeSubTab === "overview" && describe && (
          <OverviewTab describe={describe} />
        )}
        {!isLoading && activeSubTab === "fields" && describe && (
          <FieldsTab tabId={tab.id} describe={describe} />
        )}
        {!isLoading && activeSubTab === "relationships" && describe && (
          <RelationshipsTab describe={describe} />
        )}
      </Box>
    </Paper>
  );
}

type ChildRelationshipRow = ChildRelationship & {
  id: string;
};

const childRelationshipColumns: GridColDef<ChildRelationshipRow>[] = [
  {
    field: "childSObject",
    headerName: "子オブジェクト",
    flex: 1,
    minWidth: 180,
  },
  { field: "field", headerName: "項目", flex: 1, minWidth: 180 },
  {
    field: "relationshipName",
    headerName: "リレーション名",
    flex: 1,
    minWidth: 180,
  },
];

function RelationshipsTab({ describe }: { describe: DescribeSObject }) {
  const rows = useMemo<ChildRelationshipRow[]>(
    () =>
      describe.childRelationships.map((relationship, index) => ({
        ...relationship,
        id: `${relationship.childSObject}-${relationship.field}-${index}`,
      })),
    [describe.childRelationships],
  );

  return (
    <Stack spacing={1.5}>
      <Typography variant="h6">子リレーション</Typography>
      <Box
        sx={{ height: "calc(100vh - 335px)", minHeight: 560, width: "100%" }}
      >
        <DataGrid
          rows={rows}
          columns={childRelationshipColumns}
          hideFooter
          disableColumnMenu
          disableRowSelectionOnClick
          sx={{ borderColor: "divider" }}
        />
      </Box>
    </Stack>
  );
}

type FieldRow = Field & {
  id: string;
  referenceToText: string;
  requiredText: string;
};

const fieldColumns: GridColDef<FieldRow>[] = [
  { field: "name", headerName: "名前", flex: 1, minWidth: 150 },
  { field: "label", headerName: "ラベル", flex: 1, minWidth: 150 },
  { field: "type", headerName: "型", width: 120 },
  { field: "referenceToText", headerName: "参照先", flex: 1, minWidth: 140 },
  { field: "requiredText", headerName: "必須", width: 90 },
];

function FieldsTab({
  tabId,
  describe,
}: {
  tabId: string;
  describe: DescribeSObject;
}) {
  const [selectedFieldName, setSelectedFieldName] = useAtom(
    describeSelectedFieldNameAtomFamily(tabId),
  );
  const rows = useMemo<FieldRow[]>(
    () =>
      describe.fields.map((field) => ({
        ...field,
        id: field.name,
        referenceToText: field.referenceTo.join(", "),
        requiredText: field.nillable ? "いいえ" : "はい",
      })),
    [describe.fields],
  );

  useEffect(() => {
    if (rows.length === 0) {
      if (selectedFieldName) {
        setSelectedFieldName("");
      }
      return;
    }
    if (!rows.some((row) => row.name === selectedFieldName)) {
      setSelectedFieldName(rows[0].name);
    }
  }, [rows, selectedFieldName, setSelectedFieldName]);

  const selectedField = rows.find((field) => field.name === selectedFieldName);
  const rowSelectionModel = useMemo<GridRowSelectionModel>(
    () => ({
      type: "include",
      ids: selectedFieldName ? new Set([selectedFieldName]) : new Set(),
    }),
    [selectedFieldName],
  );

  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: { lg: "minmax(0, 1.45fr) minmax(360px, 1fr)" },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Box
          sx={{ height: "calc(100vh - 335px)", minHeight: 560, width: "100%" }}
        >
          <DataGrid
            rows={rows}
            columns={fieldColumns}
            hideFooter
            disableColumnMenu
            disableRowSelectionOnClick
            rowSelectionModel={rowSelectionModel}
            onRowClick={(params) => setSelectedFieldName(params.row.name)}
            sx={{
              borderColor: "divider",
              "& .MuiDataGrid-row.Mui-selected": {
                backgroundColor: "action.selected",
              },
            }}
          />
        </Box>
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Paper
          variant="outlined"
          sx={{
            height: "calc(100vh - 335px)",
            minHeight: 560,
            overflow: "hidden",
            p: 2,
          }}
        >
          {selectedField ? (
            <FieldDetailPanel field={selectedField} />
          ) : (
            <Typography color="text.secondary">
              項目を選択してください。
            </Typography>
          )}
        </Paper>
      </Box>
    </Box>
  );
}

function FieldDetailPanel({ field }: { field: FieldRow }) {
  const [tab, setTab] = useState("detail");
  const hasPicklistValues =
    (field.type === "picklist" || field.type === "multipicklist") &&
    field.picklistValues.length > 0;

  useEffect(() => {
    setTab("detail");
  }, [field.name]);

  return (
    <Stack spacing={1.5} sx={{ height: "100%" }}>
      <Tabs
        value={tab}
        onChange={(_, value: string) => setTab(value)}
        sx={{ minHeight: 40 }}
      >
        <Tab value="detail" label="項目詳細" sx={{ minHeight: 40 }} />
        {hasPicklistValues && (
          <Tab value="picklist" label="選択リスト" sx={{ minHeight: 40 }} />
        )}
      </Tabs>
      <Divider />
      {tab === "detail" && <FieldDetail field={field} />}
      {tab === "picklist" && hasPicklistValues && (
        <PicklistValuesTable values={field.picklistValues} />
      )}
    </Stack>
  );
}

function FieldDetail({ field }: { field: FieldRow }) {
  const rows: Array<[string, string]> = [
    ["名前", field.name],
    ["ラベル", field.label],
    ["型", field.type],
    ["参照先", field.referenceToText || "なし"],
    ["relationshipName", field.relationshipName || "なし"],
    ["soapType", field.soapType || "なし"],
    ["長さ", String(field.length)],
    ["バイト長", String(field.byteLength)],
    ["桁数", String(field.digits)],
    ["小数点以下桁数", String(field.precision)],
    ["scale", String(field.scale)],
    ["必須", field.requiredText],
    ["nillable", formatBoolean(field.nillable)],
    ["作成可能", formatBoolean(field.createable)],
    ["更新可能", formatBoolean(field.updateable)],
    ["読み取り専用", formatBoolean(!field.createable && !field.updateable)],
    ["デフォルト値", formatBoolean(field.defaultedOnCreate)],
    ["計算項目", formatBoolean(field.calculated)],
    ["自動採番", formatBoolean(field.autoNumber)],
    ["AI 予測項目", formatBoolean(field.aiPredictionField)],
    ["集計可能", formatBoolean(field.aggregatable)],
    ["報告可能", formatBoolean(field.groupable)],
    ["絞り込み可能", formatBoolean(field.filterable)],
    ["ソート可能", formatBoolean(field.sortable)],
    ["ケースセンシティブ", formatBoolean(field.caseSensitive)],
    ["検索プレフィックス", formatBoolean(field.searchPrefilterable)],
    ["ID ルックアップ", formatBoolean(field.idLookup)],
    ["名前項目", formatBoolean(field.nameField)],
    ["名前参照", formatBoolean(field.namePointing)],
    ["ポリモーフィック外部キー", formatBoolean(field.polymorphicForeignKey)],
    ["カスタム項目", formatBoolean(field.custom)],
    ["System 項目", formatBoolean(!field.custom)],
    ["非推奨・非表示", formatBoolean(field.deprecatedAndHidden)],
    ["制限付き選択リスト", formatBoolean(field.restrictedPicklist)],
    ["許可対象", formatBoolean(field.permissionable)],
    ["一意", formatBoolean(field.unique)],
  ];

  return (
    <Box
      component="dl"
      sx={{
        display: "grid",
        gridTemplateColumns: "minmax(150px, 190px) 1fr",
        m: 0,
        maxHeight: "calc(100vh - 430px)",
        overflowY: "auto",
        rowGap: 1,
      }}
    >
      {rows.map(([label, value]) => (
        <Box key={label} sx={{ display: "contents" }}>
          <Typography component="dt" color="text.secondary" variant="body2">
            {label}
          </Typography>
          <Typography component="dd" sx={{ m: 0 }} variant="body2">
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

type PicklistValueRow = PicklistValue & {
  id: string;
  activeText: string;
  defaultText: string;
};

const picklistValueColumns: GridColDef<PicklistValueRow>[] = [
  { field: "value", headerName: "値", flex: 1, minWidth: 160 },
  { field: "label", headerName: "ラベル", flex: 1, minWidth: 160 },
  { field: "activeText", headerName: "有効", width: 90 },
  { field: "defaultText", headerName: "デフォルト", width: 120 },
];

function PicklistValuesTable({ values }: { values: PicklistValue[] }) {
  const rows = useMemo<PicklistValueRow[]>(
    () =>
      values.map((value, index) => ({
        ...value,
        id: `${value.value}-${index}`,
        activeText: formatBoolean(value.active),
        defaultText: formatBoolean(value.defaultValue),
      })),
    [values],
  );

  return (
    <Box sx={{ height: "calc(100vh - 430px)", minHeight: 500, width: "100%" }}>
      <DataGrid
        rows={rows}
        columns={picklistValueColumns}
        hideFooter
        disableColumnMenu
        disableRowSelectionOnClick
        sx={{ borderColor: "divider" }}
      />
    </Box>
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
