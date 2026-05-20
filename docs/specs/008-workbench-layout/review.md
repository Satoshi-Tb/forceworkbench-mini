# 008-workbench-layout 実装レビュー

対象ブランチ: `codex/issue-24-workbench-layout`
初回レビュー対象コミット: `24a219f ワークベンチのタブ式レイアウトを実装`
追従レビュー対象コミット: `878888f レビュー指摘に沿ってタブ状態管理を改善` + 役割別ファイル分割の追従コミット
レビュー基準: [spec.md](./spec.md) / [ADR-0001 Jotai atom の利用方針](../../adr/0001-jotai-atom-usage.md) / `AGENTS.md`

最終ステータス: **要対応指摘 (#1〜#4) は全て対応済み**。軽微指摘 (#5〜#7) はユーザ判断で許容 (現状のまま) とする。追従レビューで挙がった #8 は不採用 (理由は本ファイル末尾 #8 節を参照)。

---

## 全体評価

仕様の主要構造（`/workbench` ルート / 左ペイン+右ペイン / タブ重複ルール / ハイブリッド render / 旧ルート削除）はすべて満たしている。品質ゲート (`npm run lint` / `npm run build` / `npm run format -- --check`) も初回・追従ともクリーン。
初回レビュー時は atom 設計が spec / ADR の指針から外れていた点が最大の論点だったが、追従コミットで atomFamily / focusAtom への移行と役割別ファイル分割が完了し解消。

### 仕様適合チェック

| 項目                                                               | spec 記述             | 実装                                                                               | 判定      |
| ------------------------------------------------------------------ | --------------------- | ---------------------------------------------------------------------------------- | --------- |
| `/workbench` 新規ルート                                            | line 24, 98, 184      | `routes/workbench.tsx` + `main.tsx` に登録                                         | ✅        |
| 旧 `/query`・`/describe` 廃止                                      | line 25, 195-199      | 物理削除 + `main.tsx` から参照除去                                                 | ✅        |
| `/` リダイレクト先変更                                             | line 26, 150          | `routes/index.tsx:8` で `/workbench`                                               | ✅        |
| ログイン成功時遷移先変更                                           | line 26, 151          | `routes/login.tsx:34` で `/workbench`                                              | ✅        |
| AppBar リンク整理                                                  | line 149              | 「ワークベンチ」+「ログアウト」のみ                                                | ✅        |
| 左ペイン (ObjectTreePane)                                          | line 13, 96           | `components/workbench/ObjectTreePane.tsx`                                          | ✅        |
| 右ペイン (TabbedContentPane)                                       | line 14, 97           | `components/workbench/TabbedContentPane.tsx`                                       | ✅        |
| ダブルクリックで定義タブ追加 / 既存タブがあればフォーカス          | line 15, 64, 117      | `ObjectTreePane.tsx:81,89` + `addDescribeTabAtom` 内で重複判定                     | ✅        |
| 「+ 新規SOQL」ボタン                                               | line 16, 64-65        | `TabbedContentPane.tsx:100-108`                                                    | ✅        |
| タブ × アイコン + 隣接タブへのフォーカス制御                       | line 119, 158         | `closeTabAtom` で `Math.min(closingIndex, nextTabs.length-1)`                      | ✅        |
| describe = アクティブのみ render                                   | line 70-77            | `TabbedContentPane.tsx:126`                                                        | ✅        |
| soql = 常時 render + `display:none`                                | line 70-79            | `TabbedContentPane.tsx:134-139`                                                    | ✅        |
| タブ別 state 独立 (sub tab / selectedFieldName / builderState ...) | line 30-49            | `describeTabStateFamily` / `soqlTabStateFamily` (atomFamily) + 各 focusAtom family | ✅ (追従) |
| タブタイトル `{label} ({name})` 動的更新                           | line 130              | `DescribeTabContent.tsx:45-56`                                                     | ✅        |
| SOQL タブタイトル `SOQL #N`                                        | line 142              | `addSoqlTabAtom` で連番採番                                                        | ✅        |
| セッション中のみのタブ状態                                         | line 17               | `Provider key` 切替で実現 (後述)                                                   | ✅        |
| 旧ファイル削除                                                     | line 152-156, 195-199 | 全て削除済み (`git ls-files` で確認済)                                             | ✅        |
| `npm run lint` / `build` / `format`                                | line 269              | すべてクリーン                                                                     | ✅        |

---

## 仕様との乖離（要対応） → 全て対応済み

### 1. atomFamily / focusAtom を使っていない（主要乖離） ✅ 対応済

**初回該当箇所**: `frontend/src/state/workbenchAtoms.ts` (削除済)

spec.md:53-57 と ADR-0001 で次のように明言されている:

> - `describeTabStateFamily`, `soqlTabStateFamily` — タブ ID 別 state を `atomFamily` で生成し、各フィールド (`selectedFieldName` 等) は focusAtom (`.prop()`) で部分購読

初回コミット (`24a219f`) では `tabsAtom: PrimitiveAtom<WorkbenchTab[]>` 1本で配列を保持し、配列全体を spread コピーする方式になっており、ADR-0001:42「キー間で意図しない再レンダリングが伝播するため atomFamily を採用」からの逸脱があった。

**追従コミット (`878888f`) で対応**:

- `describeTabStateFamily` / `soqlTabStateFamily` (base) と各フィールド focusAtom family (`describeSObjectNameAtomFamily` / `describeActiveSubTabAtomFamily` / `describeSelectedFieldNameAtomFamily` / `soqlBuilderStateAtomFamily` / `soqlManualSoqlOverrideAtomFamily` / `soqlCsvEncodingAtomFamily`) を導入
- `closeTabAtom` 内で `family.remove(tabId)` を呼び、atomFamily の内部 Map に残ったキャッシュを明示破棄 ([frontend/AGENTS.md](../../../frontend/AGENTS.md) に運用ルールとして追記済)
- `WorkbenchTab` 型から `state` フィールドを除去し、`{ id, kind, title }` のメタ情報のみに縮退

### 2. `lastRunSoql` がデッドフィールド ✅ 対応済

**初回該当箇所**: `workbenchAtoms.ts:19,80` / `SoqlTabContent.tsx:88`

書き込みはあるが読み出しがないデッドフィールドだった (AGENTS.md「デッドコード・未使用コードを放置しない」に抵触)。

**追従コミット (`878888f`) で対応**: `SoqlTabState` 型定義 / 初期値 / `SoqlTabContent.tsx` の `updateState({ lastRunSoql: soql })` 全て削除済み。

### 3. `addSoqlTabAtom` の初期 SOQL がハードコード ✅ 対応済

**初回該当箇所**: `workbenchAtoms.ts:79`

```ts
manualSoqlOverride: "SELECT Id, Name FROM Account LIMIT 10",
```

フェーズ2の固定 SOQL 実装 (`SELECT Id FROM Account`) が残っていた。

**追従コミット (`878888f`) で対応**: `createInitialSoqlTabState()` ヘルパー経由で `manualSoqlOverride: null` 初期化に変更。初期表示はビルダー由来の derived SOQL に任せる。

### 4. atom 定義ファイルの構成 ✅ 対応済

**初回該当箇所**: `frontend/src/state/workbenchAtoms.ts` (削除済)

初回コミットでは 1 ファイルに「型定義 / PrimitiveAtom / action atom / 純粋ユーティリティ関数」が同居していた。

**追従コミットで対応**: 役割別ファイル分割（`index.ts` なし）へ再配置。

```
frontend/src/state/workbench/
  types.ts    # DescribeSubTab / DescribeTabState / SoqlTabState / WorkbenchTab
  atoms.ts    # PrimitiveAtom / atomFamily / focusAtom helper /
              # createInitial*TabState (純粋関数) / updateWorkbenchTab (純粋関数)
  actions.ts  # addDescribeTabAtom / addSoqlTabAtom /
              # activateTabAtom / closeTabAtom
```

- 旧 `workbenchAtoms.ts` は物理削除済
- import 元はファイル単位で指定 (`from "../../state/workbench/actions"` 等)。`index.ts` を介さない
- 依存方向は `types.ts ← atoms.ts ← actions.ts` で循環なし
- 比較・採否理由は [ADR-0001 Decision 6 / Alternatives E〜G](../../adr/0001-jotai-atom-usage.md) を参照

---

## 軽微な指摘（許容・対応不要）

以下 #5〜#7 はユーザ判断で **このまま許容** とする。動作上の影響は小さく、本イシューのスコープ外とする。

### 5. Tab 内の IconButton 入れ子 ⚠️ 許容

**該当箇所**: `TabbedContentPane.tsx:62-97`

MUI `<Tab>` の `label` プロップ内に `<IconButton>` をネスト。`<Tab>` は内部的に `<button>` をレンダリングするので button-in-button の入れ子。`event.stopPropagation()` で動作はするが厳密には HTML 仕様違反 (ネストした interactive 要素)。

**対応方針**: 動作影響なしのため許容。将来、アクセシビリティ要件が上がるなどの動機が生じた時点で MUI 公式のクローズアブルタブパターンに寄せる。

### 6. `selectedFieldName` の自動補正 ⚠️ 許容

**該当箇所**: `DescribeTabContent.tsx:204-214`

行集合が変わったら先頭行を自動選択する補正処理。spec のシナリオには明記なし（「行クリックで右側に項目詳細」のみ）。旧 `DescribeWorkspace` 由来の挙動。

**対応方針**: 既存 UX として違和感がないため許容。明示要件化したくなった時点で spec に追記する。

### 7. `calc(100vh - Npx)` のマジックナンバー散在 ⚠️ 許容

**該当箇所**:

- `WorkbenchLayout.tsx:16` — `calc(100vh - 112px)`
- `TabbedContentPane.tsx:117` — `calc(100vh - 220px)`
- `DescribeTabContent.tsx:154, 235, 260` — `calc(100vh - 335px)`
- `DescribeTabContent.tsx:357, 402` — `calc(100vh - 430px)`

AppBar や Tab の高さを変えたとき全部追従する必要があり、保守性に難。

**対応方針**: 現状レイアウトでは表示崩れがなく許容。AppBar / Tab の構造変更が入る別タスクで flexbox 化 or 定数化を併せて検討する。

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

## 追従レビューで挙がった指摘

### 8. `atomFamily` の import 元 ❌ 不採用

**該当箇所**: `frontend/src/state/workbench/atoms.ts:2`

```ts
import { atomFamily } from "jotai-family";
```

追従レビュー時点で、`atomFamily` は jotai 本体の `jotai/utils` 経由でも取得できるため、新規依存 `jotai-family` を追加せず本体側で済ませる選択肢を提示した。

**対応方針**: ユーザ判断により **`jotai-family` パッケージ採用を維持**。`jotai/utils` 配下のユーティリティは将来的に分離パッケージへ移行する方向で議論されているため、専用パッケージ (`jotai-family` / `jotai-optics`) を採用しておくほうが将来の移行コストを下げられる。`focusAtom` も `jotai-optics` 経由で取っており、import スタイルを「分離パッケージから取る」で統一できる利点もある。
判断根拠は [ADR-0001 Decision 7 / Alternatives H](../../adr/0001-jotai-atom-usage.md) と [frontend/AGENTS.md](../../../frontend/AGENTS.md) の atomFamily ルールに反映済。

---

## まとめ

機能要件は spec を満たしており、品質ゲートも全パス。要対応指摘は全て対応完了。

| 優先度 | 項目                           | 状態                                                            |
| ------ | ------------------------------ | --------------------------------------------------------------- |
| 高     | atomFamily / focusAtom 不使用  | ✅ 対応済 (追従コミット `878888f`)                              |
| 中     | `lastRunSoql` デッドフィールド | ✅ 対応済 (追従コミット `878888f`)                              |
| 中     | SOQL タブ初期値ハードコード    | ✅ 対応済 (追従コミット `878888f`)                              |
| 中     | atom 定義ファイルの構成        | ✅ 対応済 (役割別 3 ファイル分割、`index.ts` なし)              |
| 低     | Tab 内 IconButton 入れ子       | ⚠️ 許容 (現状動作上の影響なし)                                  |
| 低     | `selectedFieldName` 自動補正   | ⚠️ 許容 (既存 UX として違和感なし)                              |
| 低     | `calc(100vh - Npx)` 散在       | ⚠️ 許容 (別タスクで構造変更時に併せて対応)                      |
| —      | `atomFamily` import 元         | ❌ 不採用 (`jotai-family` を維持、ADR-0001 Decision 7 で明文化) |
