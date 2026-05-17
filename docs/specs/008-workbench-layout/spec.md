# ツリー + マルチタブ式メイン画面への UI 刷新

## Context

forceworkbench-mini は現在 `/query` (SOQL実行) と `/describe` (オブジェクト定義) を AppBar リンクで切り替える独立ルート構成で、以下の制約がある:

- 複数オブジェクトの定義を **同時参照できない** (`selectedSObjectAtom` がグローバル単一値)
- SOQL 実行画面と定義参照画面を **横断的に作業できない** (画面遷移で片方の状態が見えなくなる)
- 業務現場で馴染みのある「左ツリー + 右マルチタブ」UX が無い

達成したいこと:

1. 左ペインに SObject 一覧ツリー (標準/カスタム分類は既存 `ObjectPicker` を流用)
2. 右ペインに **複数共存可能な** タブ式コンテンツ領域 (オブジェクト定義タブ / SOQL実行タブ)
3. ツリーのオブジェクトを **ダブルクリック** で定義タブを開く / 既タブがあればフォーカス
4. 右ペイン上部の **「+ 新規SOQL」** ボタンで空の SOQL タブを生成
5. タブ状態は **セッション中のみ** (Jotai atom 管理、ブラウザリロードで消える)
6. 既存の認証ガード、バックエンド API、ResultGrid・SoqlQueryBuilder 等の資産は最大限再利用

## 設計方針サマリ

### ルーティング

- 新規ルート: `/workbench` (タブ式統合画面)
- `/query` / `/describe` ルートは廃止 (機能はタブ内に内包)
- `/` のリダイレクト先と `/login` 成功後の遷移先を `/workbench` に変更

### タブモデル

```ts
type TabKind = "describe" | "soql";

type DescribeTabState = {
  sobjectName: string;
  activeSubTab: "overview" | "fields" | "relationships";
  selectedFieldName: string;
};

type SoqlTabState = {
  builderState: QueryBuilderState;
  manualSoqlOverride: string | null;
  lastRunSoql: string | null;
  csvEncoding: "utf-8" | "shift_jis";
};

type WorkbenchTab =
  | { id: string; kind: "describe"; title: string; state: DescribeTabState }
  | { id: string; kind: "soql"; title: string; state: SoqlTabState };
```

### Atom 設計 (既存単一 atom は廃止)

本プロジェクトの Jotai atom 利用方針は [ADR-0001 Jotai atom の利用方針](../../adr/0001-jotai-atom-usage.md) に準拠する (派生 atom 禁止 / focusAtom は構造アクセス optic 限定 / action atom は業務ロジックを伴う複数 atom 更新のみ)。

- `tabsAtom: PrimitiveAtom<WorkbenchTab[]>` — タブ配列 (順序保持)
- `activeTabIdAtom: PrimitiveAtom<string | null>` — フォーカス中タブID
- `describeTabStateFamily`, `soqlTabStateFamily` — タブ ID 別 state を `atomFamily` で生成し、各フィールド (`selectedFieldName` 等) は focusAtom (`.prop()`) で部分購読
- `treeSelectedSObjectAtom: PrimitiveAtom<string | null>` — ツリー上のシングルクリック選択 (タブと独立)
- action atoms (業務ロジックを伴う複数 atom 更新): `addDescribeTabAtom`, `addSoqlTabAtom`, `closeTabAtom`, `activateTabAtom`

### タブ重複ルール

- describe タブ: 同じ `sobjectName` のタブがあれば新規追加せずアクティブ化
- soql タブ: 常に新規追加 (「SOQL #1」「SOQL #2」連番)

### タブレンダリング方針 (ハイブリッド)

タブ種別ごとにマウント戦略を分ける。

| タブ種別 | レンダリング方式          | 非アクティブ時           | 状態保持の仕組み                                                                                   |
| -------- | ------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------- |
| describe | アクティブタブのみ render | アンマウント             | `describeTabStateFamily(tabId)` の atom + React Query キャッシュ (`["describe", name]`) で完全復元 |
| soql     | 全タブを常時 render       | `display: none` で非表示 | コンポーネントがマウントされ続けるので `useRunSoql` の mutation 結果を `useState` のまま保持可能   |

**理由:**

- describe タブは state がすべて atom + React Query キャッシュに乗っているため、アンマウントしても完全復元可能。DOM ノード/メモリを節約できる。DataGrid の列幅・スクロール位置は再マウントで初期化されるが許容範囲。
- SOQL タブの `useRunSoql` mutation 結果を atom 化するには loading/error/CSV エクスポート状態などまで含めた同期コードが必要で実装コストが高い。常時マウントすれば素朴な `useState` のまま保持できる
- 想定タブ数 (describe ≦ 10 枚 / soql ≦ 10 枚) の規模では SOQL タブが常駐しても性能影響は無視できる
- タブ状態は永続化しないため (リロード/ログアウトで `tabs = []`)、起動時に複数タブのクエリが一斉発火するシナリオは構造的に発生しない

### キャッシュ

`useDescribeSObject(name)` は React Query が `queryKey: ["describe", name]` で共有するため、describe タブを何枚開いてもバックエンド再呼び出しは発生しない (既存挙動を流用)。

---

## フェーズ分け実装プラン

### フェーズ 1: レイアウト基盤雛形

新ルートで「左ペイン + 右ペイン(空タブバー + プレースホルダ)」のシェルだけ動かす。既存 `/query`・`/describe` はこの時点では残し、並行稼働で安全を確保する。

- `frontend/src/state/workbenchAtoms.ts` を **新規作成** — タブモデルと atoms を定義
- `frontend/src/components/WorkbenchLayout.tsx` を **新規作成** — CSS Grid `360px minmax(0,1fr)` で左右分割
- `frontend/src/components/workbench/ObjectTreePane.tsx` を **新規作成** — 既存 `ObjectPicker` のツリー描画を流用、`onSelect`(シングル) と `onDoubleClick` を分離
- `frontend/src/components/workbench/TabbedContentPane.tsx` を **新規作成** — MUI `Tabs` + 「+ 新規SOQL」ボタン + 各タブ × アイコン + ハイブリッド render (describe = アクティブのみ render / soql = 全タブ render + `display:none` 切替)
- `frontend/src/routes/workbench.tsx` を **新規作成** — `/workbench` ルート
- `frontend/src/main.tsx` を **改修** — `workbenchRoute` を `addChildren` に追加

**確認**: `/workbench` を開くと左にオブジェクトツリー、右に空タブバー+プレースホルダ「左のオブジェクトをダブルクリックするか『+ 新規SOQL』を押してください」が表示される。

---

### フェーズ 2: 最小疎通確認

「ダブルクリックで Overview だけ表示」「+ 新規SOQL → 固定SOQL `SELECT Id FROM Account` を実行」までの最小経路を成立させる。

- `frontend/src/components/workbench/DescribeTabContent.tsx` を **新規作成**
  - `useDescribeSObject(state.sobjectName)` で取得
  - Overview セクション (基本情報の dl) のみ既存 `DescribeWorkspace` の `OverviewTab` ロジックを移植
  - サブタブ UI(`項目`/`リレーション`) は配置するが中身は「未実装」プレースホルダ
- `frontend/src/components/workbench/SoqlTabContent.tsx` を **新規作成** (最小版)
  - `TextField` (SOQL 文字列、初期値 `SELECT Id FROM Account`) + 「実行」ボタン + `useRunSoql` + 既存 `ResultGrid`
- `ObjectTreePane` のダブルクリックハンドラを実装
  - 既存タブ (`kind==="describe" && state.sobjectName === name`) があれば `activateTabAtom`
  - なければ新規追加 + アクティブ化
- `TabbedContentPane` の「+ 新規SOQL」ボタンで `addSoqlTabAtom`
- タブの × アイコンで `closeTabAtom` (閉じたタブがアクティブだった場合は隣接タブをアクティブ化)

**確認**: 後述「手動検証手順」のシナリオA〜Dが通る (シナリオC は固定SOQL実行のみ)。

---

### フェーズ 3: Describe タブ機能の完全移植

- `DescribeTabContent.tsx` に Fields サブタブを実装 (既存 `DescribeWorkspace.tsx` の `FieldsTab` + `FieldDetailPanel` + `FieldDetail` + `PicklistValuesTable` をコピー)
- Relationships サブタブを実装 (既存 `RelationshipsTab` をコピー)
- `selectedFieldName` は `describeTabStateFamily(tabId)` の `state.selectedFieldName` で **タブ別独立保持**
- タブタイトルは API 取得後 `{label} ({name})` 形式に動的更新

---

### フェーズ 4: SOQL タブ機能の完全移植

- `SoqlTabContent.tsx` に既存 `routes/query.tsx` の全機能を移植
  - `SoqlQueryBuilder` 配置、`buildSoql` で derived SOQL 生成、`manualSoqlOverride` で上書き
  - 「実行」「CSV」ボタン、CSV エンコーディング Select
  - `useRunSoql` の `data` をタブ別 `useState` でラップ (SOQL タブは `display:none` で常時マウント維持のため `useState` で結果保持可能 — タブレンダリング方針 参照)
  - `objectsError` / `describeError` / `queryError` / `csvError` の Alert
  - 0件結果 / `limitExceeded` Alert
- タブタイトルは連番 `SOQL #1` `SOQL #2` ...

---

### フェーズ 5: 仕上げ・既存ルート廃止

- `routes/__root.tsx` の AppBar から「クエリ」「参照情報」リンクを削除 (タイトルとログアウトのみ残す)
- `routes/index.tsx` のリダイレクト先を `/query` → `/workbench` に変更
- `routes/login.tsx` の成功時遷移先を `/query` → `/workbench` に変更
- 旧ファイル削除:
  - `frontend/src/routes/query.tsx`
  - `frontend/src/routes/describe/index.tsx` (`describe/` フォルダごと)
  - `frontend/src/components/DescribeWorkspace.tsx`
  - `frontend/src/components/ObjectPicker.tsx`
  - `frontend/src/state/uiStateAtoms.ts`
- `main.tsx` から `queryRoute` / `describeRoute` の参照を除去
- 最後のタブを閉じた時にプレースホルダに戻る挙動 / アクティブタブ閉鎖時のフォーカス制御を仕上げる

---

## 対象外 (理由付き)

| 項目                                                                | 理由                                                                    |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **テストコード全般 (ユニット / E2E)**                               | 明示的に対象外。後続検討事項として切り離す。                            |
| **左右ペインのリサイズ機能** (`react-resizable-panels` 等)          | 初期スコープ最小化。固定 360px で動作確認できれば後続イテレーション送り |
| **タブ状態のローカルストレージ永続化**                              | 要件で「セッション中のみ」と確定。Jotai のデフォルトで十分              |
| **タブのドラッグ&ドロップ並べ替え / リネーム / 右クリックメニュー** | スコープ外、× ボタンで十分                                              |
| **固定機能ノード** (保存済みSOQL、実行履歴等)                       | ツリーは「オブジェクトのみ」で要件確定                                  |

---

## 修正/新規/削除ファイル一覧

### 新規 (Create)

- `frontend/src/state/workbenchAtoms.ts`
- `frontend/src/components/WorkbenchLayout.tsx`
- `frontend/src/components/workbench/ObjectTreePane.tsx`
- `frontend/src/components/workbench/TabbedContentPane.tsx`
- `frontend/src/components/workbench/DescribeTabContent.tsx`
- `frontend/src/components/workbench/SoqlTabContent.tsx`
- `frontend/src/routes/workbench.tsx`

### 改修 (Modify)

- `frontend/src/main.tsx` — `workbenchRoute` 追加 / 旧ルート除去
- `frontend/src/routes/__root.tsx` — AppBar リンク整理
- `frontend/src/routes/index.tsx` — リダイレクト先変更
- `frontend/src/routes/login.tsx` — ログイン成功時の遷移先変更

### 削除 (Delete) (フェーズ5で実施)

- `frontend/src/routes/query.tsx`
- `frontend/src/routes/describe/index.tsx` (フォルダごと)
- `frontend/src/components/DescribeWorkspace.tsx`
- `frontend/src/components/ObjectPicker.tsx`
- `frontend/src/state/uiStateAtoms.ts`

### 既存のまま再利用 (No change)

- `frontend/src/components/SoqlQueryBuilder.tsx`
- `frontend/src/components/ResultGrid.tsx`
- `frontend/src/components/FieldTable.tsx`
- `frontend/src/utils/soqlBuilder.ts` (`buildSoql`, `createInitialQueryBuilderState`, `QueryBuilderState`)
- `frontend/src/api/*` (`auth.ts`, `describe.ts`, `query.ts`, `client.ts`)
- `frontend/src/hooks/*` (`useDescribeGlobal`, `useDescribeSObject`, `useRunSoql`, `useExportCsv`, `useLogin`, `useLogout`, `useCurrentUser`, `apiErrorMessage`, `queryKeys`)
- バックエンド API (改修不要)

---

## 再利用する既存関数/コンポーネント

| 名前                                                                                                          | 場所                                                      | 用途                                                             |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| `SoqlQueryBuilder`                                                                                            | `components/SoqlQueryBuilder.tsx`                         | SOQL タブのビルダー UI                                           |
| `ResultGrid`                                                                                                  | `components/ResultGrid.tsx`                               | SOQL タブの結果表示                                              |
| `OverviewTab` / `FieldsTab` / `RelationshipsTab` / `FieldDetailPanel` / `FieldDetail` / `PicklistValuesTable` | `components/DescribeWorkspace.tsx` (削除前にロジック抽出) | `DescribeTabContent.tsx` に移植                                  |
| `ObjectSection` (ツリー描画)                                                                                  | `components/ObjectPicker.tsx`                             | `ObjectTreePane.tsx` に移植して onDoubleClick 追加               |
| `useDescribeGlobal`                                                                                           | `hooks/useDescribeGlobal.ts`                              | ツリーとビルダー両方で使用                                       |
| `useDescribeSObject(name)`                                                                                    | `hooks/useDescribeSObject.ts`                             | describe タブ・SOQLタブから tabId 数だけ呼ばれてもキャッシュ共有 |
| `useRunSoql` / `useExportCsv`                                                                                 | `hooks/useRunSoql.ts`, `hooks/useExportCsv.ts`            | SOQL タブから呼び出し                                            |
| `buildSoql` / `createInitialQueryBuilderState`                                                                | `utils/soqlBuilder.ts`                                    | SOQL タブの derived SOQL 生成・初期 state                        |
| `getApiErrorMessage`                                                                                          | `hooks/apiErrorMessage.ts`                                | エラー Alert 表示                                                |
| `formatJstTimestamp`                                                                                          | `routes/query.tsx` 内 (削除前に抽出)                      | CSV ファイル名 — `frontend/src/utils/datetime.ts` に切り出し推奨 |

---

## 手動検証手順

実施環境: `compose.yaml` でバックエンド起動済み、フロントは `npm run dev` でローカル起動 (Vite)。

### シナリオ A: 認証 → 新ワークベンチ表示

1. `http://localhost:5173/` を開く → 未ログインなので `/login` にリダイレクト
2. メール・パスワード入力 → 「ログイン」押下
3. 期待: `/workbench` に遷移、左にオブジェクトツリー、右は空タブバー + プレースホルダ

### シナリオ B: ダブルクリックで定義タブを開く

4. 左ツリーで「Account」を **シングルクリック** → タブは開かず選択ハイライトのみ
5. 「Account」を **ダブルクリック** → 「Account」タブが追加されアクティブ化、Overview 表示
6. 「Contact」をダブルクリック → 「Contact」タブが追加 (計2タブ)
7. 「Account」をもう一度ダブルクリック → **タブは増えず**、既存「Account」タブにフォーカス
8. 「Account」タブで「項目」サブタブをクリック → DataGrid に項目一覧、行クリックで右側に項目詳細
9. 「Contact」タブに切替えても **Account 側のサブタブ・項目選択は保持** されている (タブ別 state 独立)

### シナリオ C: SOQL タブ追加・実行

10. 「+ 新規SOQL」を押下 → 「SOQL #1」タブが追加されアクティブ化
11. SOQL エディタに `SELECT Id, Name FROM Account LIMIT 5` を入力 → 「実行」押下
12. 下部 DataGrid に結果が表示、`limitExceeded` Alert は出ない
13. 「+ 新規SOQL」を再度押下 → 「SOQL #2」追加 (計4タブ)
14. 「SOQL #1」に戻る → 先ほどの実行結果 DataGrid が **保持されている**
15. 「CSV」ボタンで Shift_JIS を選択しダウンロード → `query_yyyymmddhhmmss.csv` が落ちる

### シナリオ D: タブ閉じる

16. 「Contact」タブの × → タブが消え、隣の「Account」がアクティブ化
17. 全タブを閉じる → 右ペインがプレースホルダ表示に戻る

### シナリオ E: 認証フローの維持

18. AppBar「ログアウト」押下 → `/login` に戻る、再ログインしても **以前のタブは消えている** (セッション中のみ仕様)

### フェーズ完了時の品質ゲート

- `npm run format` / `npm run lint` / `npm run build` がエラーなく通る
- 旧ルート (`/query` / `/describe`) を URL 直打ちしても 404 もしくは `/workbench` リダイレクト (フェーズ5以降)
