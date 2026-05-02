# 【ドラフト】SOQL クエリビルダー UI 実装プラン

## 前提

- 本仕様はドラフトであり、`docs/specs/003-frontend-library-updates/spec.md` のライブラリアップデート完了後に再検証する。
- 本仕様は `docs/specs/003-soql-ui/soql-query-redesign.md` と `soql-query-builder.jpg` をもとに、新バージョンの SOQL 画面へクエリビルダーを移植するための実装計画である。
- 今回の主対象は `frontend/src/routes/query.tsx` 周辺のクエリ入力 UI であり、クエリ結果グリッド `frontend/src/components/ResultGrid.tsx` は変更しない。
- Salesforce へのクエリ実行 API、ページング API、CSV ダウンロード API は既存実装をそのまま使う。
- オブジェクト・項目メタデータは既存の Describe API と hooks を使う。
  - `useDescribeGlobal`
  - `useDescribeSObject`
- UI ライブラリはライブラリアップデート後の MUI v7 / MUI X v8 を前提に再確認する。
- React 19、MUI v7、MUI X v8、Vite 8、Zod 導入後に、型定義、MUI props、DataGrid props、Describe API 型の影響を再検証する。
- 新規依存は追加しない。ただし `docs/specs/003-frontend-library-updates/spec.md` で導入済みとなる依存は利用してよい。
- 移植元 Workbench の matrix 表示、QueryAll、Bulk CSV/XML、URL 共有などは今回の移植対象に含めない。

## 成功基準

- `/query` 画面の見出しは `SOQL` のまま、既存 SOQL テキストエリアの上にクエリビルダー領域が表示される。
- クエリビルダーで次を設定できる。
  - オブジェクト選択
  - 複数フィールド選択
  - ソート項目、ASC/DESC、NULLS FIRST/LAST
  - LIMIT
  - AND 連結の複数条件
- ビルダーの入力変更に応じて SOQL テキストエリアへ文字列が反映される。
- SOQL テキストエリアはユーザーが直接編集でき、既存の `実行`、`次のページ`、`CSV` の動作は維持される。
- `ResultGrid` の UI、列定義、表示スタイル、呼び出し条件を変更しない。
- `npm run lint` と `npm run build` が通る。

## 現状調査メモ

### 新バージョン

- SOQL 画面は `frontend/src/routes/query.tsx` に実装されている。
- 現在の状態は以下の最小構成。
  - `soql` state: 初期値 `SELECT Id, Name FROM Account LIMIT 10`
  - `result` state
  - `error` state
  - `useRunSoql()` による実行
  - `nextQueryPage()` による次ページ取得
  - `downloadCsv()` による CSV ダウンロード
  - `ResultGrid` による結果表示
- Describe 系の型と API は `frontend/src/api/describe.ts` にある。
  - `DescribeGlobal.sobjects`
  - `DescribeSObject.fields`
  - `Field.type`
  - `Field.filterable`
  - `Field.sortable`
- MUI は導入済みで、`Paper`、`Stack`、`TextField`、`Select`、`Checkbox`、`Button` などを使える。

### 移植元 Workbench

- 対象ファイル:
  - `work/reference/workbench/query.php`
  - `work/reference/workbench/static/script/query.js`
  - `work/reference/workbench/shared.php`
- `query.js` の `buildQuery()` が SOQL 組み立ての中心。
- 移植元の主な組み立て規則:
  - 選択フィールドがある場合のみ `SELECT fields FROM object` を生成する。
  - 条件は入力済み行を `AND` で連結する。
  - `starts`、`ends`、`contains` は `LIKE` に変換し、値に `%` を付ける。
  - `IN`、`NOT IN`、`INCLUDES`、`EXCLUDES` は値を `(...)` で囲む。
  - `null`、`date`、`datetime`、数値系、`boolean` はクォートしない。
  - その他の値はシングルクォートで囲む。
  - ソート項目がある場合のみ `ORDER BY field direction NULLS order` を生成する。
  - LIMIT 入力がある場合のみ `LIMIT value` を生成する。
- 比較演算子:
  - `=`
  - `!=`
  - `<`
  - `<=`
  - `>`
  - `>=`
  - `starts`
  - `ends`
  - `contains`
  - `IN`
  - `NOT IN`
  - `INCLUDES`
  - `EXCLUDES`

## 実装方針

### 変更対象

- 主変更:
  - `frontend/src/routes/query.tsx`
- 必要に応じて追加:
  - `frontend/src/components/SoqlQueryBuilder.tsx`
  - `frontend/src/components/soqlQueryBuilder.ts` または `frontend/src/utils/soqlBuilder.ts`

`query.tsx` にすべて詰め込むと状態と UI が大きくなるため、ビルダー UI と SOQL 組み立て関数は分離する。ただし、過剰な抽象化は避け、今回の画面で使う最小限の型と関数に留める。

### コンポーネント構成

```text
QueryPage
  ├─ SoqlQueryBuilder
  ├─ SOQL TextField
  ├─ 実行 / 次のページ / CSV ボタン
  └─ ResultGrid
```

`QueryPage` は既存のクエリ実行責務を維持する。`SoqlQueryBuilder` はビルダー state と入力 UI を持ち、生成した SOQL を `onSoqlChange(nextSoql)` で親へ渡す。

### ビルダー state

```ts
type QueryCondition = {
  id: string;
  field: string;
  operator: string;
  value: string;
};

type QueryBuilderState = {
  objectName: string;
  fields: string[];
  orderByField: string;
  orderDirection: "ASC" | "DESC";
  nullsOrder: "FIRST" | "LAST";
  limit: string;
  conditions: QueryCondition[];
};
```

- `limit` は入力中の空文字を扱うため string で保持する。
- `condition.id` は React の key 用。`crypto.randomUUID()` ではなく、単純な連番または `Date.now()` 由来のローカル生成で足りる。
- 初期状態は選択なしを基本にする。
- サンプル状態を表示するかどうかは実装前に決める必要がある。実運用画面では自動で `Account` を選ぶと意図しない SOQL 上書きが起きやすいため、デフォルトは選択なしを推奨する。

## UI 仕様

### 全体レイアウト

- `QueryPage` の `Stack spacing={2}` は維持する。
- 見出し `SOQL` の下、エラー表示の下、SOQL テキストエリアの上に `Paper variant="outlined"` のビルダー領域を置く。
- ビルダー領域内は `Box` の CSS grid でレスポンシブに並べる。
  - desktop: オブジェクト/項目を左、ソート/条件/LIMIT を右寄りに自然に配置
  - mobile: 1 カラム
- 色や装飾は MUI 標準の白背景、`divider` 境界線、`spacing` に寄せる。

### オブジェクト選択

- `useDescribeGlobal()` で取得した `sobjects` を `name` 昇順で表示する。
- `Select` または `Autocomplete` を使う。
- `queryable` は global summary には現状ないため、一覧は `sobjects` をそのまま使う。queryable 判定は選択後の describe に含まれるため、必要なら非 queryable の注意表示だけに留める。
- オブジェクト変更時:
  - `objectName` を更新する。
  - `fields`、`orderByField`、`conditions` をクリアする。
  - `limit`、`orderDirection`、`nullsOrder` は維持してよい。
  - `useDescribeSObject(objectName)` で項目を取得する。

### フィールド選択

- MUI の multiple `Select` + `Checkbox` を使う。
- 選択済件数の表示は不要。
- 表示対象は `describe.fields`。
- 初期実装では全項目を表示する。必要なら後続で `deprecatedAndHidden` を除外するが、今回の必須範囲には含めない。
- 選択順はユーザーが選んだ順を維持し、SOQL の `SELECT` もその順にする。
- オブジェクト未選択または describe 未取得時は disabled にする。

### ソート設定

- 項目選択:
  - `describe.fields.filter((field) => field.sortable)` を候補にする。
  - 空選択を許可する。
- 方向:
  - `ASC` 表示は `A to Z`
  - `DESC` 表示は `Z to A`
- Null 順:
  - `FIRST` 表示は `Nulls First`
  - `LAST` 表示は `Nulls Last`
- ソート項目が空の場合、方向と Null 順は SOQL に出力しない。

### 件数上限

- `TextField type="number"` を使う。
- 空文字を許可する。
- 入力値は正の整数のみを有効とする。
- 無効値の場合は SOQL に `LIMIT` を出さず、必要なら `helperText` で警告する。
- 初期値は空文字を推奨する。サンプル再現時のみ `100` を使う。

### 条件

- 条件行は複数追加できる。
- 各行の項目:
  - 項目選択
  - 演算子選択
  - 値入力
  - 削除ボタン
- 条件項目候補は `describe.fields.filter((field) => field.filterable)` を基本にする。
- `条件を追加` ボタンで空行を追加する。
- 空欄がある条件行は SOQL に出力しない。
- 条件はすべて `AND` で連結する。
- OR、括弧、ネスト条件、サブクエリは今回実装しない。

## SOQL 組み立て仕様

### 出力順

```sql
SELECT {fields}
FROM {objectName}
WHERE {condition1}
AND {condition2}
ORDER BY {orderByField} {ASC|DESC} NULLS {FIRST|LAST}
LIMIT {limit}
```

実際のテキストエリアでは既存 UI に合わせ、1 行または複数行のどちらでもよい。読みやすさを優先するなら複数行を推奨する。

### SELECT

- `objectName` が空、または `fields` が空の場合は SOQL を生成しない。
- `fields` は `, ` で連結する。
- `count()` は今回の redesign 要件に明記されていないため候補に追加しない。

### WHERE

- 条件行は `field`、`operator`、`value` がすべて入力されているものだけ使う。
- 2 件目以降は `AND` で連結する。
- `starts`、`ends`、`contains` は以下へ変換する。
  - `starts`: `LIKE 'value%'`
  - `ends`: `LIKE '%value'`
  - `contains`: `LIKE '%value%'`
- `IN`、`NOT IN`、`INCLUDES`、`EXCLUDES` は入力値を `(...)` で囲む。
- `null` はクォートしない。
- `date`、`datetime`、`currency`、`percent`、`double`、`int`、`boolean` はクォートしない。
- その他の型はシングルクォートで囲む。
- 文字列値内のシングルクォートは `\\'` にエスケープする。

### ORDER BY

- `orderByField` が空の場合は出力しない。
- `orderByField` がある場合のみ、方向と Null 順を続けて出力する。
- デフォルトは `ASC`、`LAST` とする。

### LIMIT

- `limit` が空の場合は出力しない。
- 正の整数の場合のみ出力する。
- 小数、負数、0、数値以外は出力しない。

## SOQL テキストエリアとの連動

- ビルダー入力が有効な SOQL を生成できる場合、`setSoql(generatedSoql)` を呼ぶ。
- ユーザーが SOQL テキストエリアを直接編集した場合も編集を許可する。
- 直接編集した SOQL をビルダー state へ逆解析する処理は実装しない。
- 直接編集後にビルダーを再操作すると、ビルダー state から再生成した SOQL でテキストエリアを更新する。
- この挙動は実装が単純で、既存の実行ロジックを壊しにくい。

## サンプル状態の扱い

`soql-query-redesign.md` にはサンプル状態として `Account`、複数フィールド、条件、ソート、LIMIT が示されている。一方で同文書のオブジェクト選択要件は「デフォルト: 選択なし」である。

実装では次を推奨する。

- 初期状態は選択なし。
- サンプル値はテストケースまたは Story 的な確認観点として扱う。
- もし初期表示でサンプルを入れる必要がある場合は、ユーザー確認後に `Account` を初期選択する。

サンプル確認用の期待 SOQL:

```sql
SELECT AccountNumber, AccountSource, AnnualRevenue, BillingCity
FROM Account
WHERE OwnerId = '12345'
AND NumberOfLocations__c = 12345
ORDER BY BillingCity ASC NULLS LAST
LIMIT 100
```

注記: redesign 文書のサンプル SOQL は選択フィールド一覧に `BillingCity` がある一方、`SELECT` 例では `BillingCity` が省略されている。ビルダー仕様としては、選択されたフィールドはすべて `SELECT` に含める。

## 実装手順

1. `frontend/src/routes/query.tsx` の既存実行処理を維持したまま、ビルダー挿入位置を決める。
2. `SoqlQueryBuilder` コンポーネントを追加する。
3. Describe hooks を使ってオブジェクト一覧と選択オブジェクトの fields を取得する。
4. オブジェクト選択、複数フィールド選択、ソート、LIMIT、条件行 UI を実装する。
5. SOQL 組み立て関数を追加し、ビルダー state 変更時に `onSoqlChange` する。
6. 既存 SOQL テキストエリア、実行ボタン、次ページボタン、CSV ボタン、`ResultGrid` の動作を変更していないことを確認する。
7. lint/build を実行する。

## テスト・検証観点

- 初期表示:
  - `/query` を開いて `SOQL` 見出し、ビルダー、テキストエリア、ボタンが表示される。
  - オブジェクト未選択時にフィールド・条件・ソートの選択が破綻しない。
- オブジェクト選択:
  - `Account` を選ぶと項目リストが表示される。
  - オブジェクト変更時に前のオブジェクトのフィールド選択や条件が残らない。
- フィールド選択:
  - 複数フィールドを選ぶと `SELECT field1, field2 FROM Account` が生成される。
  - 選択解除が SOQL に反映される。
- 条件:
  - `OwnerId = 12345` は文字列型なら `OwnerId = '12345'` になる。
  - `NumberOfLocations__c = 12345` は数値型ならクォートされない。
  - 複数条件は `AND` で連結される。
  - 条件削除で SOQL から消える。
- LIKE 系:
  - `starts` は `LIKE 'value%'`
  - `ends` は `LIKE '%value'`
  - `contains` は `LIKE '%value%'`
- IN 系:
  - `IN` は `field IN (value)` になる。
- ソート:
  - ソート項目ありで `ORDER BY BillingCity ASC NULLS LAST` が出る。
  - ソート項目なしでは `ORDER BY` が出ない。
- LIMIT:
  - `100` で `LIMIT 100` が出る。
  - 空文字では `LIMIT` が出ない。
  - 無効値では `LIMIT` が出ない。
- 直接編集:
  - テキストエリアへ直接入力した SOQL を実行できる。
  - 直接編集後にビルダーを変更すると、ビルダー生成 SOQL で上書きされる。
- 既存機能:
  - 実行成功時に結果グリッドが表示される。
  - 次ページ取得が既存通り動く。
  - CSV ダウンロードが既存通り動く。
  - `ResultGrid` のコード差分がない。

## 実行するコマンド

```sh
cd frontend
npm run lint
npm run build
```

`package.json` に `format` と `test` は現状定義されていないため、追加しない。必要であれば別タスクで scripts を整備する。

## 確認が必要な事項

- 初期表示は redesign 文書の「デフォルト: 選択なし」を優先するか、画像のように `Account` のサンプル状態を表示するか。
- `count()` をフィールド候補に含めるか。移植元にはあるが、今回の redesign 要件には含まれていないため、初期実装では含めない方針。
- 条件値の型別入力をどこまで行うか。初期実装ではすべてテキスト入力とし、クォート規則だけ型に応じて変える方針。
- `IN` 系の値入力でユーザーに `a,b,c` と入力させるか、`'a','b','c'` まで手入力させるか。移植元に合わせるなら入力値をそのまま `(...)` で囲む。
