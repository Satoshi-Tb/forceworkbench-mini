# 008-workbench-layout 実装レビュー

対象ブランチ: `codex/issue-24-workbench-layout`
対象コミット: `24a219f ワークベンチのタブ式レイアウトを実装`
レビュー基準: [spec.md](./spec.md) / [ADR-0001 Jotai atom の利用方針](../../adr/0001-jotai-atom-usage.md) / `AGENTS.md`

---

## 全体評価

仕様の主要構造（`/workbench` ルート / 左ペイン+右ペイン / タブ重複ルール / ハイブリッド render / 旧ルート削除）はすべて満たしている。品質ゲート (`npm run lint` / `npm run build` / `npm run format -- --check`) もクリーン。
ただし atom 設計が spec / ADR の指針から外れている点が最大の論点。

### 仕様適合チェック

| 項目                                                               | spec 記述             | 実装                                                           | 判定 |
| ------------------------------------------------------------------ | --------------------- | -------------------------------------------------------------- | ---- |
| `/workbench` 新規ルート                                            | line 24, 98, 184      | `routes/workbench.tsx` + `main.tsx` に登録                     | ✅   |
| 旧 `/query`・`/describe` 廃止                                      | line 25, 195-199      | 物理削除 + `main.tsx` から参照除去                             | ✅   |
| `/` リダイレクト先変更                                             | line 26, 150          | `routes/index.tsx:8` で `/workbench`                           | ✅   |
| ログイン成功時遷移先変更                                           | line 26, 151          | `routes/login.tsx:34` で `/workbench`                          | ✅   |
| AppBar リンク整理                                                  | line 149              | 「ワークベンチ」+「ログアウト」のみ                            | ✅   |
| 左ペイン (ObjectTreePane)                                          | line 13, 96           | `components/workbench/ObjectTreePane.tsx`                      | ✅   |
| 右ペイン (TabbedContentPane)                                       | line 14, 97           | `components/workbench/TabbedContentPane.tsx`                   | ✅   |
| ダブルクリックで定義タブ追加 / 既存タブがあればフォーカス          | line 15, 64, 117      | `ObjectTreePane.tsx:81,89` + `addDescribeTabAtom` 内で重複判定 | ✅   |
| 「+ 新規SOQL」ボタン                                               | line 16, 64-65        | `TabbedContentPane.tsx:100-108`                                | ✅   |
| タブ × アイコン + 隣接タブへのフォーカス制御                       | line 119, 158         | `closeTabAtom` で `Math.min(closingIndex, nextTabs.length-1)`  | ✅   |
| describe = アクティブのみ render                                   | line 70-77            | `TabbedContentPane.tsx:127`                                    | ✅   |
| soql = 常時 render + `display:none`                                | line 70-79            | `TabbedContentPane.tsx:129-138`                                | ✅   |
| タブ別 state 独立 (sub tab / selectedFieldName / builderState ...) | line 30-49            | `tabsAtom` の各要素に保持                                      | ✅   |
| タブタイトル `{label} ({name})` 動的更新                           | line 130              | `DescribeTabContent.tsx:42-52`                                 | ✅   |
| SOQL タブタイトル `SOQL #N`                                        | line 142              | `addSoqlTabAtom` で連番採番                                    | ✅   |
| セッション中のみのタブ状態                                         | line 17               | `Provider key` 切替で実現 (後述)                               | ✅   |
| 旧ファイル削除                                                     | line 152-156, 195-199 | 全て削除済み (`git ls-files` で確認済)                         | ✅   |
| `npm run lint` / `build` / `format`                                | line 269              | すべてクリーン                                                 | ✅   |

---

## 仕様との乖離（要対応）

### 1. atomFamily / focusAtom を使っていない（主要乖離）

**該当箇所**: `frontend/src/state/workbenchAtoms.ts`

spec.md:53-57 と ADR-0001 で次のように明言されている:

> - `describeTabStateFamily`, `soqlTabStateFamily` — タブ ID 別 state を `atomFamily` で生成し、各フィールド (`selectedFieldName` 等) は focusAtom (`.prop()`) で部分購読

しかし実装は `tabsAtom: PrimitiveAtom<WorkbenchTab[]>` 1本で配列を保持し、`updateWorkbenchTab` (workbenchAtoms.ts:109-115) で配列全体を spread コピーする方式になっている。

**影響**: タブの state を1個でも変更すると `tabsAtom` を購読する全コンポーネント (`TabbedContentPane` / 各 `SoqlTabContent` / `DescribeTabContent`) が再レンダリングされる。想定タブ数 ≦ 20 では機能上の問題は出ないが、ADR で明示的に置いた設計指針 (ADR-0001:42「キー間で意図しない再レンダリングが伝播するため atomFamily を採用」) からの逸脱。

**対応案**:

- atomFamily + focusAtom で再実装する
- もしくは spec / ADR を更新して「単一 array atom 方式」を正当化する

意図的な簡略化であれば、判断根拠を PR 説明か spec 補記に残すべき。

### 2. `lastRunSoql` がデッドフィールド

**該当箇所**: `workbenchAtoms.ts:19,80` / `SoqlTabContent.tsx:88`

- 書き込み: `SoqlTabContent.tsx:88` の `updateState({ lastRunSoql: soql })` のみ
- 読み出し: なし

AGENTS.md「デッドコード・未使用コードを放置しない」に抵触。spec.md:41 の型定義はあるが、利用箇所が明示されていない。

**対応案**: 型定義・初期値・書き込み箇所を削除。

### 3. `addSoqlTabAtom` の初期 SOQL がハードコード

**該当箇所**: `workbenchAtoms.ts:79`

```ts
manualSoqlOverride: "SELECT Id, Name FROM Account LIMIT 10",
```

spec 設計 (line 138-139) は「ビルダー由来の derived SOQL を `manualSoqlOverride` で上書き可能」というモデルで、初期値は `null` でビルダー連動が自然。フェーズ2の固定 SOQL 実装 (`SELECT Id FROM Account`) が残った可能性が高い。

**対応案**: `manualSoqlOverride: null` に変更し、初期表示はビルダー由来の derived SOQL に任せる。

### 4. atom 定義ファイルの構成

**該当箇所**: `frontend/src/state/workbenchAtoms.ts`

現状は 1 ファイルに「型定義 / PrimitiveAtom / action atom / 純粋ユーティリティ関数」が同居している。今回規模では実害は小さいが、扱う状態が増えると責務の混在で読みにくくなるため、責務別へ分割しておくのが望ましい。

**対応案**: 役割別ファイル分割（`index.ts` なし）へ再配置。

```
state/workbench/
  types.ts    # DescribeSubTab / DescribeTabState / SoqlTabState / WorkbenchTab
  atoms.ts    # tabsAtom / activeTabIdAtom / treeSelectedSObjectAtom /
              # nextSoqlTabNumberAtom / updateWorkbenchTab (純粋関数)
  actions.ts  # addDescribeTabAtom / addSoqlTabAtom /
              # activateTabAtom / closeTabAtom
```

- import 元はファイル単位で指定 (`from "@/state/workbench/actions"` 等)。`index.ts` を介さない
- 他案（機能ドメイン別フォルダ / カスタムフック層 / バレル `index.ts`）の比較・採否理由は ADR-0001 に追記済み
- 指摘 1 (atomFamily / focusAtom 移行) と同タイミングで実施するとファイル割り直しが 1 度で済む

---

## 軽微な指摘

### 5. Tab 内の IconButton 入れ子

**該当箇所**: `TabbedContentPane.tsx:62-97`

MUI `<Tab>` の `label` プロップ内に `<IconButton>` をネスト。`<Tab>` は内部的に `<button>` をレンダリングするので button-in-button の入れ子。`event.stopPropagation()` で動作はするが厳密には HTML 仕様違反 (ネストした interactive 要素)。

**対応案**: 必須ではないが、MUI 公式のクローズアブルタブパターン (label を `<span>` で包んで横に IconButton を並べる等) に寄せると堅い。

### 6. `selectedFieldName` の自動補正

**該当箇所**: `DescribeTabContent.tsx:204-214`

行集合が変わったら先頭行を自動選択する補正処理。spec のシナリオには明記なし（「行クリックで右側に項目詳細」のみ）。旧 `DescribeWorkspace` 由来の挙動と推測されるが、要件か否か要確認。

### 7. `calc(100vh - Npx)` のマジックナンバー散在

**該当箇所**:

- `WorkbenchLayout.tsx:16` — `calc(100vh - 112px)`
- `TabbedContentPane.tsx:117` — `calc(100vh - 220px)`
- `DescribeTabContent.tsx:154, 235, 260` — `calc(100vh - 335px)`
- `DescribeTabContent.tsx:357, 402` — `calc(100vh - 430px)`

AppBar や Tab の高さを変えたとき全部追従する必要があり、保守性に難。flexbox で組むか、constants にまとめるのが望ましい。スコープ外として許容も可。

---

## 評価できる点

### Provider key によるタブリセット

**該当箇所**: `routes/__root.tsx:75`

```tsx
<Provider key={user?.userId ?? "anonymous"}>
```

ログアウトで `anonymous` に切り替わって atom Provider が再マウントされ、atom 全体がリセットされる。シナリオE「再ログインしても以前のタブは消えている」を Jotai Provider の再マウントで素直に実現していて綺麗。

### `closeTabAtom` の隣接タブフォーカス

**該当箇所**: `workbenchAtoms.ts:94-107`

閉じたタブがアクティブだった場合に `Math.min(closingIndex, nextTabs.length - 1)` で隣接タブをアクティブ化、最後の1枚なら `null`。シナリオD通り。

### 旧ファイル削除の徹底

`query.tsx` / `describe/index.tsx` / `DescribeWorkspace.tsx` / `ObjectPicker.tsx` / `uiStateAtoms.ts` はすべて削除済みで、grep でも参照が残っていない。spec の削除リスト (line 152-156, 195-199) を完全に消化。

---

## まとめ

機能要件は spec を満たしており、品質ゲートも全パス。ただし以下の対応を推奨:

| 優先度 | 項目                           | 対応の方向性                                            |
| ------ | ------------------------------ | ------------------------------------------------------- |
| 高     | atomFamily / focusAtom 不使用  | 再実装、または spec / ADR を更新                        |
| 中     | `lastRunSoql` デッドフィールド | 削除                                                    |
| 中     | SOQL タブ初期値ハードコード    | `manualSoqlOverride: null` に変更                       |
| 中     | atom 定義ファイルの構成        | 役割別 3 ファイルに分割 (`types` / `atoms` / `actions`) |
| 低     | Tab 内 IconButton 入れ子       | 余裕があれば改善                                        |
| 低     | `selectedFieldName` 自動補正   | 要件確認                                                |
| 低     | `calc(100vh - Npx)` 散在       | 別タスクで整理                                          |
