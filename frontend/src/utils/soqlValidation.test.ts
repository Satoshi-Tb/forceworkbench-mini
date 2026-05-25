import { describe, expect, it } from "vitest";
import {
  COUNT_SELECT_FIELD,
  FIELDS_ALL_SELECT_FIELD,
  type QueryBuilderState,
} from "./soqlBuilder";
import {
  getQueryBuilderValidationMessage,
  isValidLimitInput,
  queryBuilderStateSchema,
} from "./soqlValidation";

describe("SOQLビルダー状態スキーマ", () => {
  it("有効なビルダー状態を受け付ける", () => {
    expect(queryBuilderStateSchema.safeParse(state({})).success).toBe(true);
  });

  it("オブジェクト名を trim する", () => {
    expect(
      queryBuilderStateSchema.parse(state({ objectName: " Account " })),
    ).toMatchObject({ objectName: "Account" });
  });

  it.each([
    [state({ objectName: "" }), "オブジェクトを選択してください"],
    [state({ fields: [] }), "フィールドを選択してください"],
    [state({ limit: "0" }), "LIMIT は正の整数で入力してください"],
  ])("不正な状態を拒否する", (input, expectedMessage) => {
    const result = queryBuilderStateSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(expectedMessage);
    }
  });

  it("COUNT() と FIELDS(ALL) の同時選択を拒否する", () => {
    const result = queryBuilderStateSchema.safeParse(
      state({ fields: [COUNT_SELECT_FIELD, FIELDS_ALL_SELECT_FIELD] }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "COUNT() と FIELDS(ALL) は同時に選択できません",
      );
    }
  });

  it("特殊フィールドと通常フィールドの同時選択を拒否する", () => {
    const result = queryBuilderStateSchema.safeParse(
      state({ fields: [COUNT_SELECT_FIELD, "Name"] }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "COUNT() / FIELDS(ALL) は他のフィールドと同時に選択できません",
      );
    }
  });

  it.each(["", "201"])(
    "FIELDS(ALL) では LIMIT 200 以下を必須にする: %s",
    (limit) => {
      const result = queryBuilderStateSchema.safeParse(
        state({ fields: [FIELDS_ALL_SELECT_FIELD], limit }),
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          "FIELDS(ALL) を使用する場合は LIMIT を 200 以下で入力してください",
        );
      }
    },
  );

  it("FIELDS(ALL) と LIMIT 200 の組み合わせを受け付ける", () => {
    expect(
      queryBuilderStateSchema.safeParse(
        state({ fields: [FIELDS_ALL_SELECT_FIELD], limit: "200" }),
      ).success,
    ).toBe(true);
  });
});

describe("LIMIT入力値判定", () => {
  it.each([
    ["", true],
    ["1", true],
    ["200", true],
    ["0", false],
    ["01", false],
    ["1.5", false],
    ["-1", false],
  ])("LIMIT %s の判定結果として %s を返す", (limit, expected) => {
    expect(isValidLimitInput(limit)).toBe(expected);
  });
});

describe("SOQLビルダー検証メッセージ", () => {
  it("有効な状態では null を返す", () => {
    expect(getQueryBuilderValidationMessage(state({}))).toBeNull();
  });

  it("最初のスキーマエラーメッセージを返す", () => {
    expect(getQueryBuilderValidationMessage(state({ objectName: "" }))).toBe(
      "オブジェクトを選択してください",
    );
  });
});

// QueryBuilderState の標準ケースを作る。各テストでは検証対象の差分だけ patch で上書きする。
function state(patch: Partial<QueryBuilderState>): QueryBuilderState {
  return {
    objectName: "Account",
    fields: ["Name"],
    orders: [],
    limit: "",
    conditions: [],
    ...patch,
  };
}
