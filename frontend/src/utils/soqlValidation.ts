import { z } from "zod";
import {
  COUNT_SELECT_FIELD,
  FIELDS_ALL_SELECT_FIELD,
  queryOperators,
  type QueryBuilderState,
} from "./soqlBuilder";

const queryConditionSchema = z.object({
  id: z.string().min(1),
  field: z.string().min(1, "条件の項目を選択してください"),
  operator: z.enum(queryOperators),
  value: z.string().trim().min(1, "条件の値を入力してください"),
});

const queryOrderSchema = z.object({
  id: z.string().min(1),
  field: z.string().min(1, "ソート項目を選択してください"),
  direction: z.enum(["ASC", "DESC"]),
  nullsOrder: z.enum(["FIRST", "LAST"]),
});

export const queryBuilderStateSchema = z
  .object({
    objectName: z.string().trim().min(1, "オブジェクトを選択してください"),
    fields: z.array(z.string().min(1)).min(1, "フィールドを選択してください"),
    orders: z.array(queryOrderSchema),
    limit: z
      .string()
      .refine(
        (value) => value === "" || /^[1-9]\d*$/.test(value),
        "LIMIT は正の整数で入力してください",
      ),
    conditions: z.array(queryConditionSchema),
  })
  .superRefine((state, ctx) => {
    const selectedSpecialFields = state.fields.filter(
      (field) =>
        field === COUNT_SELECT_FIELD || field === FIELDS_ALL_SELECT_FIELD,
    );

    if (selectedSpecialFields.length > 1) {
      ctx.addIssue({
        code: "custom",
        path: ["fields"],
        message: "COUNT() と FIELDS(ALL) は同時に選択できません",
      });
    }

    if (selectedSpecialFields.length === 1 && state.fields.length > 1) {
      ctx.addIssue({
        code: "custom",
        path: ["fields"],
        message: "COUNT() / FIELDS(ALL) は他のフィールドと同時に選択できません",
      });
    }

    if (
      state.fields.includes(FIELDS_ALL_SELECT_FIELD) &&
      state.limit !== "" &&
      Number(state.limit) > 200
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["limit"],
        message: "FIELDS(ALL) の LIMIT は 200 以下にしてください",
      });
    }
  });

export type QueryBuilderInput = z.input<typeof queryBuilderStateSchema>;
export type QueryBuilderValues = z.infer<typeof queryBuilderStateSchema>;

export function validateQueryBuilderState(state: QueryBuilderState) {
  return queryBuilderStateSchema.safeParse(state);
}

export function getQueryBuilderValidationMessage(
  state: QueryBuilderState,
): string | null {
  const result = validateQueryBuilderState(state);
  if (result.success) return null;
  return result.error.issues[0]?.message ?? "クエリ条件を確認してください";
}

export function isValidLimitInput(limit: string): boolean {
  return limit === "" || /^[1-9]\d*$/.test(limit);
}
