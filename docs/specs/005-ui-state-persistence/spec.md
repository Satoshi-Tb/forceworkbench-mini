# ページ間 UI 状態保持: Jotai 導入によるグローバルステート化

## 背景・目的

現状、`/query` (クエリ) と `/describe` (参照情報) のページは画面ごとに `useState` でローカルに UI 状態を持っている。ナビゲーションタブで画面を行き来すると、コンポーネントがアンマウントされ、入力中だったクエリビルダーの状態や選択中オブジェクトなどが失われる。ユーザーが「クエリ画面で組み立てた条件のまま参照情報を確認しに行き、戻ってきて続きを実行する」といった行き来をするケースで作業が中断される。

これを改善するため、画面間で保持したい UI 状態を Jotai のグローバルステートに移管する。リフトアップ (親ルートに `useState` を集約する) は採らない。状態の利用箇所が散らばっており、Props drilling と再描画の影響範囲が広がるため。

## 成功基準

- `/query` でクエリビルダー入力・SOQL 手動編集を行った後、`/describe` に遷移して戻っても入力内容が保持されている。
- `/describe` でオブジェクト・タブ・項目行を選択した後、`/query` に遷移して戻っても選択状態が保持されている。
- ログアウト → 別ユーザーログインで、上記すべての状態が初期値にリセットされている。
- F5 リロードで状態が消える (本案ではリロード耐性は要件外)。
- `/describe/$sobject` ルートが廃止され、`/describe` に統一されている。
- `cd frontend && npm run lint && npm run format && npm run build` が通る。

## 方針

| 項目 | 内容 |
|---|---|
| 状態管理ライブラリ | Jotai (`jotai` 本体のみ。`jotai/utils` は使わない) |
| 永続化 | なし (メモリ atom のみ。`atomWithStorage` は使わない) |
| URL 反映 | しない (`/describe/$sobject` ルートを廃止し、`/describe` 単一ルートに統一) |
| ユーザー切替時のリセット | `<Provider key={user?.id}>` で全 atom を初期化 |
| TanStack Query との分担 | サーバ取得結果 (SOQL 実行結果・error) は Query 側で管理し、Jotai に乗せない |

## 移管対象の最終リスト

### Jotai 化する状態

| 画面 | atom 名 | 型 | 移管元 |
|---|---|---|---|
| query | `builderStateAtom` | `QueryBuilderState` | `query.tsx` の `useState` |
| query | `manualSoqlOverrideAtom` | `string \| null` | `query.tsx` の `useState` |
| describe | `selectedSObjectAtom` | `string \| null` | URL パスパラメータ `$sobject` |
| describe | `describeTabAtom` | `"overview" \| "fields" \| "relationships"` | `DescribeWorkspace` の `useState<string>` |
| describe | `selectedFieldNameAtom` | `string` | `FieldsTab` 内の `useState` |

### TanStack Query に寄せる状態 (Jotai 化しない)

- `query.tsx` の `result: QueryResult \| null` → `useRunSoql` mutation の `data` を直接参照する
- `query.tsx` の `error: string \| null` → `useRunSoql` mutation の `error` から導出する

### ローカル `useState` のまま残すもの

- `FieldDetailPanel` 内の `tab` (詳細/選択リスト)
- `ObjectPicker` 内の検索文字列 `query` および `ObjectSection` の `expanded`

## 影響ファイル

### フロントエンド (新規)

- `frontend/src/state/uiStateAtoms.ts`
  - 上記 5 つの atom を定義
  - `QueryBuilderState` の初期値は既存の `createInitialQueryBuilderState()` を使用
  - `manualSoqlOverrideAtom` の初期値は `"SELECT Id, Name FROM Account LIMIT 10"` (現状の初期値を踏襲)
  - `describeTabAtom` の初期値は `"overview"`
  - `selectedSObjectAtom` の初期値は `null`
  - `selectedFieldNameAtom` の初期値は `""`

### フロントエンド (修正)

- `frontend/package.json`
  - `dependencies` に `jotai` を追加 (バージョンは導入時点の最新安定版)

- `frontend/src/routes/__root.tsx`
  - `jotai` の `Provider` を import
  - `RootLayout` の `<Container>` 配下で `<Outlet />` を `<Provider key={user?.id ?? "anonymous"}>` で囲む
  - ログアウトハンドラ自体には変更不要 (`Provider` の `key` 切替で全 atom が初期化される)

- `frontend/src/routes/query.tsx`
  - `useState<QueryBuilderState>` を `useAtom(builderStateAtom)` に置換
  - `useState<string | null>(... LIMIT 10)` を `useAtom(manualSoqlOverrideAtom)` に置換
  - `useState<QueryResult | null>(null)` および `useState<string | null>(null)` (error) を削除
  - `result` は `runSoql.data ? withFallbackColumns(runSoql.data, soql) : null` のように mutation の `data` から導出
  - `error` は `runSoql.error` を `ApiError` 判定して文字列化
  - CSV ダウンロード時の error 表示が必要なため、CSV 専用の `csvError` のみ `useState` で残すか、共通の error 表示を Jotai 化するかは実装時に決定 (`runSoql.error` と CSV エラーは別系統)

- `frontend/src/routes/describe/index.tsx`
  - `selectedSObjectAtom` を読み、`<DescribeWorkspace sobject={...} />` に渡す形は廃止
  - `DescribeWorkspace` の Props から `sobject` を削除し、内部で atom 参照に変更するため、本ファイルは `<DescribeWorkspace />` を返すだけに簡素化

- `frontend/src/routes/describe/$sobject.tsx`
  - ファイルごと削除

- `frontend/src/main.tsx`
  - `describeSObjectRoute` の import と `routeTree` への登録を削除

- `frontend/src/components/DescribeWorkspace.tsx`
  - Props `sobject` を撤廃
  - `selectedSObjectAtom` を `useAtomValue` で参照
  - `useState("overview")` を `useAtom(describeTabAtom)` に置換
  - `FieldsTab` の `useState(rows[0]?.name ?? "")` を `useAtom(selectedFieldNameAtom)` に置換
  - `selectedSObjectAtom` の値が変わった瞬間に `selectedFieldNameAtom` を `""` にリセットする (A 案: 現状の `useEffect` を活かし、`rows` 変更時に先頭行を入れ直す)
    - 実装案: `useEffect` 内で `setSelectedFieldName(rows[0]?.name ?? "")` を維持しつつ、`selectedSObject` が変わったときも反応するよう依存配列を `[rows]` のままで OK (rows は describe の fields から導出されるため、sobject 変化に追随する)

- `frontend/src/components/ObjectPicker.tsx`
  - Props `selectedObject` を撤廃 (`selectedSObjectAtom` を直接 `useAtomValue` で参照)
  - `onSelect` 内の `navigate({ to: "/describe/$sobject", params: { sobject: object.name } })` を `setSelectedSObject(object.name)` (Jotai setter) に置換
  - `useNavigate` の import を削除

## URL ルートの変更まとめ

| 変更前 | 変更後 |
|---|---|
| `/describe` (sobject 未選択) | `/describe` (sobject 未選択 / 選択済みのいずれも兼ねる) |
| `/describe/$sobject` | 廃止 |

ナビゲーションバー (`__root.tsx:62`) のリンク先 `/describe` は変更なし。

## A 案: 選択 sobject 切替時の selectedFieldName 挙動

要件確定: **A 案 (現状維持: sobject 変更時に先頭行を自動選択)** を採用する。

- sobject A の field を選択した状態で sobject B に切り替えると、`useDescribeSObject` が新しい fields を返すため `rows` が更新され、既存の `useEffect(() => setSelectedFieldName(rows[0]?.name ?? ""), [rows])` が発火し、sobject B の先頭行が自動選択される。
- sobject B → sobject A に戻ったとき、A の先頭行が選択される (前回 A で選んでいた行は記憶しない)。
- 「同じ sobject のままページ間遷移して戻った」場合は `rows` が変わらないため、`selectedFieldNameAtom` の値がそのまま保持される (これがページ間保持要件の主目的)。

## 削除されるもの一覧

- `frontend/src/routes/describe/$sobject.tsx` (ファイルごと)
- `frontend/src/main.tsx` の `describeSObjectRoute` 登録
- `DescribeWorkspace` Props の `sobject`
- `ObjectPicker` Props の `selectedObject` および `useNavigate` 依存
- `query.tsx` の `useState<QueryResult | null>` / `useState<string | null>(null)` (error 部分)

## 実装ステップ

1. **基盤導入 (最小疎通確認)**
   - `frontend/package.json` に `jotai` を追加し `npm install`
   - `__root.tsx` に `<Provider key={user?.id}>` を配置
   - 動作確認用に `builderStateAtom` だけ作って `query.tsx` で使い、`/query` ↔ `/describe` を行き来して保持されることを目視確認
2. **query.tsx 移管**
   - `manualSoqlOverrideAtom` も追加
   - `result` / `error` を `useRunSoql` の `data` / `error` ベースに切替
3. **describe ルート再構成**
   - `routes/describe/$sobject.tsx` を削除し、`main.tsx` から登録解除
   - `routes/describe/index.tsx` を `<DescribeWorkspace />` だけに簡素化
4. **DescribeWorkspace / ObjectPicker の atom 化**
   - `selectedSObjectAtom` / `describeTabAtom` / `selectedFieldNameAtom` を移管
   - `ObjectPicker` から `useNavigate` を排除し setter ベースに切替
5. **動作確認**
   - クエリ画面 ⇄ 参照情報 を行き来して全状態が保持されること
   - ログアウト → 別ユーザーログインで全状態が初期値に戻ること
   - F5 で消えること (期待挙動)
   - `npm run lint` / `npm run format` / `npm run build` 通過確認

## テスト・検証観点

### ビルド/リント

- `cd frontend && npm run lint && npm run format && npm run build`

### 動作確認 (mock プロファイル)

- `/query` でクエリビルダーに任意の object/field を選択 → `/describe` へ → `/query` に戻る → 入力が保持されている
- `/query` で SOQL を手動編集 → `/describe` へ → `/query` に戻る → 編集内容が保持されている
- `/describe` で Account を選択 → 項目タブで任意行を選択 → `/query` へ → `/describe` に戻る → 同じオブジェクト・タブ・行が選択された状態で復元
- `/describe` で Account 選択中 → Contact に切替 → 項目タブの先頭行が自動選択される (A 案)
- ログアウト → 別ユーザーログイン → `/query` `/describe` のいずれも初期状態
- F5 リロード → 全状態が初期値に戻る (期待挙動)

### 自動テスト

- 追加しない (プロジェクト方針)

## 実行するコマンド

```sh
cd frontend
npm install
npm run format
npm run lint
npm run build
```

## やらないこと

- `atomWithStorage` を使ったローカルストレージ永続化 (リロード耐性は要件外)
- URL search params / path params への状態反映 (本方針では Jotai 一本化)
- 自動テスト追加 (プロジェクト方針: 明示依頼があるまで作らない)
- `result` / `error` の Jotai 化 (TanStack Query に寄せる)
- `FieldDetailPanel` 内タブや `ObjectPicker` の検索文字列など、ページ間保持が不要なローカル状態の Jotai 化
