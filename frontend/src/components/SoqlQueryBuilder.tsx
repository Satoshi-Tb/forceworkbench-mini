import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { DescribeSObject, Field, SObjectSummary } from "../api/describe";
import {
  FIELDS_ALL_SELECT_FIELD,
  canSelectField,
  isSpecialSelectField,
  queryOperators,
  specialSelectFields,
  type QueryBuilderState,
  type QueryCondition,
  type QueryOrder,
} from "../utils/soqlBuilder";
import { isValidLimitInput } from "../utils/soqlValidation";

type SelectFieldOption = {
  name: string;
  label: string;
  special?: boolean;
};

type SoqlQueryBuilderProps = {
  state: QueryBuilderState;
  objects: SObjectSummary[];
  objectsLoading: boolean;
  describe: DescribeSObject | undefined;
  describeLoading: boolean;
  onChange: (next: QueryBuilderState) => void;
};

export function SoqlQueryBuilder({
  state,
  objects,
  objectsLoading,
  describe,
  describeLoading,
  onChange,
}: SoqlQueryBuilderProps) {
  const selectedObject =
    objects.find((object) => object.name === state.objectName) ?? null;
  const fields = describe?.fields ?? [];
  const selectFieldOptions: SelectFieldOption[] = [
    ...specialSelectFields.map((fieldName) => ({
      name: fieldName,
      label: fieldName,
      special: true,
    })),
    ...fields,
  ];
  const selectedFields = state.fields
    .map((fieldName) =>
      selectFieldOptions.find((field) => field.name === fieldName),
    )
    .filter((field): field is SelectFieldOption => Boolean(field));
  const sortableFields = fields.filter((field) => field.sortable);
  const filterableFields = fields.filter((field) => field.filterable);
  const fieldsDisabled = !state.objectName || describeLoading || !describe;
  const limitInvalid = !isValidLimitInput(state.limit);
  const fieldsAllSelected = state.fields.includes(FIELDS_ALL_SELECT_FIELD);

  const updateCondition = (id: string, patch: Partial<QueryCondition>) => {
    onChange({
      ...state,
      conditions: state.conditions.map((condition) =>
        condition.id === id ? { ...condition, ...patch } : condition,
      ),
    });
  };
  const updateOrder = (id: string, patch: Partial<QueryOrder>) => {
    onChange({
      ...state,
      orders: state.orders.map((order) =>
        order.id === id ? { ...order, ...patch } : order,
      ),
    });
  };
  const moveOrder = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= state.orders.length) return;
    const orders = [...state.orders];
    const current = orders[index];
    orders[index] = orders[nextIndex];
    orders[nextIndex] = current;
    onChange({ ...state, orders });
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h6" component="h2">
          クエリビルダー
        </Typography>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              md: "minmax(280px, 0.9fr) minmax(0, 1.4fr)",
            },
          }}
        >
          <Stack spacing={2}>
            <Autocomplete
              options={objects}
              value={selectedObject}
              loading={objectsLoading}
              getOptionLabel={(option) =>
                option.label === option.name
                  ? option.name
                  : `${option.label} (${option.name})`
              }
              isOptionEqualToValue={(option, value) =>
                option.name === value.name
              }
              onChange={(_, nextObject) =>
                onChange({
                  ...state,
                  objectName: nextObject?.name ?? "",
                  fields: [],
                  orders: [],
                  conditions: [],
                })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="オブジェクト"
                  slotProps={{
                    input: {
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {objectsLoading && <CircularProgress size={18} />}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    },
                  }}
                />
              )}
            />
            <Autocomplete
              multiple
              disableCloseOnSelect
              options={selectFieldOptions}
              value={selectedFields}
              disabled={fieldsDisabled}
              getOptionLabel={formatSelectFieldLabel}
              isOptionEqualToValue={(option, value) =>
                option.name === value.name
              }
              getOptionDisabled={(option) =>
                !state.fields.includes(option.name) &&
                !canSelectField(state.fields, option.name)
              }
              onChange={(_, nextFields) => {
                const fieldNames = nextFields.map((field) => field.name);
                const specialFieldName = fieldNames.find(isSpecialSelectField);
                const nextSelectedFields = specialFieldName
                  ? [specialFieldName]
                  : fieldNames;
                onChange({
                  ...state,
                  fields: nextSelectedFields,
                  limit: nextSelectedFields.includes(FIELDS_ALL_SELECT_FIELD)
                    ? limitFieldsAll(state.limit)
                    : state.limit,
                });
              }}
              renderOption={(props, option, { selected }) => (
                <li {...props}>
                  <Checkbox checked={selected} />
                  <ListItemText
                    primary={option.label}
                    secondary={option.special ? undefined : option.name}
                  />
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="フィールド"
                  helperText={describeLoading ? "項目を取得中です" : " "}
                />
              )}
            />
            <TextField
              label="LIMIT"
              type="number"
              value={state.limit}
              error={limitInvalid}
              helperText={limitInvalid ? "正の整数のみ有効です" : " "}
              sx={{ width: { xs: "100%", sm: 160 } }}
              onChange={(event) =>
                onChange({
                  ...state,
                  limit: fieldsAllSelected
                    ? limitFieldsAll(event.target.value)
                    : event.target.value,
                })
              }
            />
          </Stack>

          <Stack spacing={2}>
            <Stack spacing={1.5}>
              <Stack direction="row" justifyContent="space-between" gap={1}>
                <Typography variant="subtitle1">ソート</Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() =>
                    onChange({
                      ...state,
                      orders: [
                        ...state.orders,
                        createEmptyOrder(state.orders.length),
                      ],
                    })
                  }
                  disabled={fieldsDisabled}
                >
                  ソートを追加
                </Button>
              </Stack>
              {state.orders.length === 0 && (
                <Typography color="text.secondary" variant="body2">
                  ソートは設定されていません。
                </Typography>
              )}
              {state.orders.map((order, index) => (
                <SortOrderRow
                  key={order.id}
                  order={order}
                  fields={sortableFields}
                  disabled={fieldsDisabled}
                  disableMoveUp={index === 0}
                  disableMoveDown={index === state.orders.length - 1}
                  onChange={(patch) => updateOrder(order.id, patch)}
                  onMoveUp={() => moveOrder(index, -1)}
                  onMoveDown={() => moveOrder(index, 1)}
                  onDelete={() =>
                    onChange({
                      ...state,
                      orders: state.orders.filter(
                        (item) => item.id !== order.id,
                      ),
                    })
                  }
                />
              ))}
            </Stack>

            <Stack spacing={1.5}>
              <Stack direction="row" justifyContent="space-between" gap={1}>
                <Typography variant="subtitle1">条件</Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() =>
                    onChange({
                      ...state,
                      conditions: [
                        ...state.conditions,
                        createEmptyCondition(state.conditions.length),
                      ],
                    })
                  }
                  disabled={fieldsDisabled}
                >
                  条件を追加
                </Button>
              </Stack>
              {state.conditions.length === 0 && (
                <Typography color="text.secondary" variant="body2">
                  条件は設定されていません。
                </Typography>
              )}
              {state.conditions.map((condition) => (
                <ConditionRow
                  key={condition.id}
                  condition={condition}
                  fields={filterableFields}
                  disabled={fieldsDisabled}
                  onChange={(patch) => updateCondition(condition.id, patch)}
                  onDelete={() =>
                    onChange({
                      ...state,
                      conditions: state.conditions.filter(
                        (item) => item.id !== condition.id,
                      ),
                    })
                  }
                />
              ))}
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}

function formatSelectFieldLabel(option: SelectFieldOption): string {
  return option.special ? option.name : `${option.label} (${option.name})`;
}

function limitFieldsAll(limit: string): string {
  return /^[1-9]\d*$/.test(limit) && Number(limit) <= 200 ? limit : "200";
}

function SortOrderRow({
  order,
  fields,
  disabled,
  disableMoveUp,
  disableMoveDown,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  order: QueryOrder;
  fields: Field[];
  disabled: boolean;
  disableMoveUp: boolean;
  disableMoveDown: boolean;
  onChange: (patch: Partial<QueryOrder>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  return (
    <Box
      sx={{
        alignItems: "center",
        display: "grid",
        gap: 1,
        gridTemplateColumns: {
          sm: "minmax(180px, 1fr) 120px 140px auto auto auto",
        },
      }}
    >
      <FormControl disabled={disabled} fullWidth>
        <InputLabel id={`${order.id}-field-label`}>ソート項目</InputLabel>
        <Select
          labelId={`${order.id}-field-label`}
          value={order.field}
          label="ソート項目"
          onChange={(event) => onChange({ field: event.target.value })}
        >
          {fields.map((field) => (
            <MenuItem key={field.name} value={field.name}>
              {field.label} ({field.name})
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl disabled={disabled} fullWidth>
        <InputLabel id={`${order.id}-direction-label`}>方向</InputLabel>
        <Select
          labelId={`${order.id}-direction-label`}
          value={order.direction}
          label="方向"
          onChange={(event) =>
            onChange({ direction: event.target.value as "ASC" | "DESC" })
          }
        >
          <MenuItem value="ASC">A to Z</MenuItem>
          <MenuItem value="DESC">Z to A</MenuItem>
        </Select>
      </FormControl>
      <FormControl disabled={disabled} fullWidth>
        <InputLabel id={`${order.id}-nulls-order-label`}>Null 順</InputLabel>
        <Select
          labelId={`${order.id}-nulls-order-label`}
          value={order.nullsOrder}
          label="Null 順"
          onChange={(event) =>
            onChange({ nullsOrder: event.target.value as "FIRST" | "LAST" })
          }
        >
          <MenuItem value="FIRST">Nulls First</MenuItem>
          <MenuItem value="LAST">Nulls Last</MenuItem>
        </Select>
      </FormControl>
      <IconButton
        aria-label="ソート優先度を上げる"
        disabled={disabled || disableMoveUp}
        onClick={onMoveUp}
      >
        <ArrowUpwardIcon fontSize="small" />
      </IconButton>
      <IconButton
        aria-label="ソート優先度を下げる"
        disabled={disabled || disableMoveDown}
        onClick={onMoveDown}
      >
        <ArrowDownwardIcon fontSize="small" />
      </IconButton>
      <IconButton aria-label="ソートを削除" color="error" onClick={onDelete}>
        <RemoveCircleOutlineIcon />
      </IconButton>
    </Box>
  );
}

function ConditionRow({
  condition,
  fields,
  disabled,
  onChange,
  onDelete,
}: {
  condition: QueryCondition;
  fields: Field[];
  disabled: boolean;
  onChange: (patch: Partial<QueryCondition>) => void;
  onDelete: () => void;
}) {
  return (
    <Box
      sx={{
        alignItems: "center",
        display: "grid",
        gap: 1,
        gridTemplateColumns: {
          sm: "minmax(180px, 1fr) 130px minmax(160px, 1fr) auto",
        },
      }}
    >
      <FormControl disabled={disabled} fullWidth>
        <InputLabel id={`${condition.id}-field-label`}>項目</InputLabel>
        <Select
          labelId={`${condition.id}-field-label`}
          value={condition.field}
          label="項目"
          onChange={(event) => onChange({ field: event.target.value })}
        >
          {fields.map((field) => (
            <MenuItem key={field.name} value={field.name}>
              {field.label} ({field.name})
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl disabled={disabled} fullWidth>
        <InputLabel id={`${condition.id}-operator-label`}>演算子</InputLabel>
        <Select
          labelId={`${condition.id}-operator-label`}
          value={condition.operator}
          label="演算子"
          onChange={(event) => onChange({ operator: event.target.value })}
        >
          {queryOperators.map((operator) => (
            <MenuItem key={operator} value={operator}>
              {operator}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        label="値"
        value={condition.value}
        disabled={disabled}
        onChange={(event) => onChange({ value: event.target.value })}
      />
      <IconButton aria-label="条件を削除" color="error" onClick={onDelete}>
        <RemoveCircleOutlineIcon />
      </IconButton>
    </Box>
  );
}

function createEmptyOrder(index: number): QueryOrder {
  return {
    id: `order-${Date.now()}-${index}`,
    field: "",
    direction: "ASC",
    nullsOrder: "LAST",
  };
}

function createEmptyCondition(index: number): QueryCondition {
  return {
    id: `condition-${Date.now()}-${index}`,
    field: "",
    operator: "=",
    value: "",
  };
}
