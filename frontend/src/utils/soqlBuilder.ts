import type { Field } from "../api/describe";

export type QueryCondition = {
  id: string;
  field: string;
  operator: string;
  value: string;
};

export type QueryOrder = {
  id: string;
  field: string;
  direction: "ASC" | "DESC";
  nullsOrder: "FIRST" | "LAST";
};

export type QueryBuilderState = {
  objectName: string;
  fields: string[];
  orders: QueryOrder[];
  limit: string;
  conditions: QueryCondition[];
};

export const queryOperators = [
  "=",
  "!=",
  "<",
  "<=",
  ">",
  ">=",
  "starts",
  "ends",
  "contains",
  "IN",
  "NOT IN",
  "INCLUDES",
  "EXCLUDES",
] as const;

export const COUNT_SELECT_FIELD = "COUNT()";
export const FIELDS_ALL_SELECT_FIELD = "FIELDS(ALL)";
export const FIELDS_ALL_DEFAULT_LIMIT = "200";
export const specialSelectFields = [
  COUNT_SELECT_FIELD,
  FIELDS_ALL_SELECT_FIELD,
] as const;

export type SpecialSelectField = (typeof specialSelectFields)[number];

export function isSpecialSelectField(
  fieldName: string,
): fieldName is SpecialSelectField {
  return specialSelectFields.includes(fieldName as SpecialSelectField);
}

export function hasSpecialSelectField(fieldNames: string[]): boolean {
  return fieldNames.some(isSpecialSelectField);
}

export function canSelectField(
  selectedFieldNames: string[],
  candidateFieldName: string,
): boolean {
  if (selectedFieldNames.length === 0) return true;
  if (isSpecialSelectField(candidateFieldName)) return false;
  return !hasSpecialSelectField(selectedFieldNames);
}

export function createInitialQueryBuilderState(): QueryBuilderState {
  return {
    objectName: "",
    fields: [],
    orders: [],
    limit: "",
    conditions: [],
  };
}

export function buildSoql(
  state: QueryBuilderState,
  availableFields: Field[],
): string {
  if (!state.objectName || state.fields.length === 0) return "";

  const fieldByName = new Map(
    availableFields.map((field) => [field.name, field]),
  );
  const lines = [
    `SELECT ${state.fields.join(", ")}`,
    `FROM ${state.objectName}`,
  ];
  const conditions = state.conditions
    .map((condition) =>
      formatCondition(condition, fieldByName.get(condition.field)),
    )
    .filter((condition): condition is string => Boolean(condition));

  if (conditions.length > 0) {
    lines.push(`WHERE ${conditions[0]}`);
    lines.push(...conditions.slice(1).map((condition) => `AND ${condition}`));
  }

  const orders = state.orders
    .filter((order) => order.field)
    .map(
      (order) => `${order.field} ${order.direction} NULLS ${order.nullsOrder}`,
    );
  if (orders.length > 0) {
    lines.push(`ORDER BY ${orders.join(", ")}`);
  }

  const limit =
    state.fields.includes(FIELDS_ALL_SELECT_FIELD) && state.limit === ""
      ? FIELDS_ALL_DEFAULT_LIMIT
      : state.limit;

  if (/^[1-9]\d*$/.test(limit)) {
    lines.push(`LIMIT ${limit}`);
  }

  return lines.join("\n");
}

function formatCondition(
  condition: QueryCondition,
  field: Field | undefined,
): string | null {
  const value = condition.value.trim();
  if (!condition.field || !condition.operator || !value) return null;

  if (condition.operator === "starts") {
    return `${condition.field} LIKE '${escapeSoqlString(value)}%'`;
  }
  if (condition.operator === "ends") {
    return `${condition.field} LIKE '%${escapeSoqlString(value)}'`;
  }
  if (condition.operator === "contains") {
    return `${condition.field} LIKE '%${escapeSoqlString(value)}%'`;
  }
  if (isListOperator(condition.operator)) {
    const listValue = formatListValue(value, field?.type);
    if (!listValue) return null;
    return `${condition.field} ${condition.operator} (${listValue})`;
  }

  return `${condition.field} ${condition.operator} ${formatValue(value, field?.type)}`;
}

function isListOperator(operator: string): boolean {
  return ["IN", "NOT IN", "INCLUDES", "EXCLUDES"].includes(operator);
}

function formatValue(value: string, fieldType: string | undefined): string {
  if (value === "null") return value;
  if (fieldType && shouldKeepUnquoted(fieldType)) return value;
  return `'${escapeSoqlString(value)}'`;
}

function formatListValue(value: string, fieldType: string | undefined): string {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item)
    .map((item) => formatValue(unquoteListItem(item), fieldType))
    .join(", ");
}

function unquoteListItem(value: string): string {
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  return value;
}

function shouldKeepUnquoted(fieldType: string): boolean {
  return [
    "date",
    "datetime",
    "currency",
    "percent",
    "double",
    "int",
    "boolean",
  ].includes(fieldType);
}

function escapeSoqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
