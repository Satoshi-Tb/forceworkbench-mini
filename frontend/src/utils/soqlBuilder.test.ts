import { describe, expect, it } from "vitest";
import type { Field } from "../api/describe";
import {
  COUNT_SELECT_FIELD,
  FIELDS_ALL_SELECT_FIELD,
  buildSoql,
  canSelectField,
  type QueryBuilderState,
} from "./soqlBuilder";

const fields = [
  field("Name", "string"),
  field("CreatedDate", "datetime"),
  field("Amount", "currency"),
  field("IsActive", "boolean"),
];

describe("SOQL生成", () => {
  it("オブジェクトとフィールドが選択されるまでは空文字を返す", () => {
    expect(buildSoql(state({ objectName: "" }), fields)).toBe("");
    expect(buildSoql(state({ fields: [] }), fields)).toBe("");
  });

  it("基本的な SELECT 文を生成する", () => {
    expect(buildSoql(state({ fields: ["Id", "Name"] }), fields)).toBe(
      ["SELECT Id, Name", "FROM Account"].join("\n"),
    );
  });

  it("文字列条件をエスケープして整形する", () => {
    const soql = buildSoql(
      state({
        conditions: [
          {
            id: "condition-1",
            field: "Name",
            operator: "=",
            value: "O'Hara\\Tokyo",
          },
        ],
      }),
      fields,
    );

    expect(soql).toContain("WHERE Name = 'O\\'Hara\\\\Tokyo'");
  });

  it("LIKE 系演算子を整形する", () => {
    const soql = buildSoql(
      state({
        conditions: [
          { id: "condition-1", field: "Name", operator: "starts", value: "A" },
          { id: "condition-2", field: "Name", operator: "ends", value: "Z" },
          {
            id: "condition-3",
            field: "Name",
            operator: "contains",
            value: "mid",
          },
        ],
      }),
      fields,
    );

    expect(soql).toContain("WHERE Name LIKE 'A%'");
    expect(soql).toContain("AND Name LIKE '%Z'");
    expect(soql).toContain("AND Name LIKE '%mid%'");
  });

  it("リスト系演算子を整形する", () => {
    const soql = buildSoql(
      state({
        conditions: [
          {
            id: "condition-1",
            field: "Name",
            operator: "IN",
            value: "Acme, 'Edge Communications'",
          },
        ],
      }),
      fields,
    );

    expect(soql).toContain("WHERE Name IN ('Acme', 'Edge Communications')");
  });

  it("型付きのスカラー値はクォートしない", () => {
    const soql = buildSoql(
      state({
        conditions: [
          {
            id: "condition-1",
            field: "CreatedDate",
            operator: ">=",
            value: "2024-01-01T00:00:00Z",
          },
          {
            id: "condition-2",
            field: "Amount",
            operator: ">",
            value: "100",
          },
          {
            id: "condition-3",
            field: "IsActive",
            operator: "=",
            value: "true",
          },
        ],
      }),
      fields,
    );

    expect(soql).toContain("WHERE CreatedDate >= 2024-01-01T00:00:00Z");
    expect(soql).toContain("AND Amount > 100");
    expect(soql).toContain("AND IsActive = true");
  });

  it("未完成の条件とソートは出力しない", () => {
    const soql = buildSoql(
      state({
        conditions: [
          { id: "condition-1", field: "", operator: "=", value: "Acme" },
        ],
        orders: [
          {
            id: "order-1",
            field: "",
            direction: "ASC",
            nullsOrder: "LAST",
          },
        ],
      }),
      fields,
    );

    expect(soql).not.toContain("WHERE");
    expect(soql).not.toContain("ORDER BY");
  });

  it("ソートと正の整数 LIMIT を追加する", () => {
    const soql = buildSoql(
      state({
        limit: "25",
        orders: [
          {
            id: "order-1",
            field: "Name",
            direction: "ASC",
            nullsOrder: "LAST",
          },
        ],
      }),
      fields,
    );

    expect(soql).toContain("ORDER BY Name ASC NULLS LAST");
    expect(soql).toContain("LIMIT 25");
  });

  it("不正な LIMIT 値は追加しない", () => {
    expect(buildSoql(state({ limit: "0" }), fields)).not.toContain("LIMIT");
  });
});

describe("フィールド選択可否", () => {
  const cases: Array<[string[], string, boolean]> = [
    [[], COUNT_SELECT_FIELD, true],
    [[COUNT_SELECT_FIELD], "Name", false],
    [["Name"], COUNT_SELECT_FIELD, false],
    [["Name"], FIELDS_ALL_SELECT_FIELD, false],
    [["Name"], "CreatedDate", true],
  ];

  it.each(cases)(
    "選択済みフィールド %s と候補 %s の選択可否を %s と判定する",
    (selectedFieldNames, candidateFieldName, expected) => {
      expect(canSelectField(selectedFieldNames, candidateFieldName)).toBe(
        expected,
      );
    },
  );
});

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

function field(name: string, type: string): Field {
  return {
    name,
    label: name,
    type,
    referenceTo: [],
    relationshipName: null,
    soapType: "xsd:string",
    length: 0,
    byteLength: 0,
    digits: 0,
    precision: 0,
    scale: 0,
    nillable: true,
    createable: true,
    updateable: true,
    defaultedOnCreate: false,
    calculated: false,
    autoNumber: false,
    aiPredictionField: false,
    aggregatable: true,
    groupable: true,
    filterable: true,
    sortable: true,
    caseSensitive: false,
    searchPrefilterable: false,
    idLookup: false,
    nameField: false,
    namePointing: false,
    polymorphicForeignKey: false,
    custom: false,
    deprecatedAndHidden: false,
    restrictedPicklist: false,
    permissionable: true,
    unique: false,
    picklistValues: [],
  };
}
