# ADR-0001: Jotai atom の利用方針

## Status

Accepted (2026-05-17)

## Context

forceworkbench-mini のフロントエンドは状態管理に Jotai を採用している。Jotai には次のような複数の atom 種別・パターンが存在する:

| 種類                          | 役割                                                                                                       | spec での例                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| PrimitiveAtom                 | 値を持つ基本 atom (`useState` のグローバル版)                                                              | `tabsAtom`, `activeTabIdAtom`, `treeSelectedSObjectAtom`                             |
| 派生 atom (derived atom)      | read 関数を持つ atom (`atom((get) => ...)`)。useMemo / selector 相当                                       | —                                                                                    |
| action atom (write-only atom) | write 関数のみを持つ atom。複数 atom の協調更新を 1 操作として宣言                                         | `addDescribeTabAtom`, `addSoqlTabAtom`, `closeTabAtom`, `activateTabAtom`            |
| atomFamily                    | キーごとに atom インスタンスを動的生成。`atom<Map<K,V>>` で代替可能だが、購読粒度がキー単位に細分化される | `describeTabStateFamily`, `soqlTabStateFamily`                                       |
| focusAtom (jotai-optics)      | 親 atom の特定 path を部分購読・部分更新する切り出し atom                                                  | `describeTabStateFamily(tabId)` から `.prop("selectedFieldName")` 等で切り出す部品 |

008-workbench-layout (ツリー + マルチタブ式メイン画面への UI 刷新) の atom 設計検討時に、これらをどう使い分けるかが論点となった。とくに「派生 atom は依存関係が暗黙化し追跡困難になる」というプロジェクト方針 (既存ルール) との整合性を取りつつ、focusAtom や atomFamily の利点を享受する線引きを明文化する必要があった。

## Decision

### 1. 派生 atom: 原則禁止

read 関数を持つ atom (`atom((get) => ...)` 形式) は **原則使用しない**。

### 2. focusAtom: 構造アクセス系 optic 限定で許可

jotai-optics の `focusAtom` は使用可。ただし許可される optic は **構造アクセス系 (`.prop()`, `.path()`, `.nth()` 等) のみ**。`.iso()`, `.lens()` 等の任意変換ロジックを埋め込む optic は派生 atom 扱いとして禁止。

### 3. action atom: 業務ロジックを伴う複数 atom 更新のみ

action atom (write-only atom) は以下に該当する場合のみ使用する:

- 複数の atom を協調的に更新する操作
- 業務ルール (重複判定・正規化・連動更新) を伴う更新

単純な値の代入は `useSetAtom(primitiveAtom)` で十分。**「1 atom = 1 set action atom」を機械的に展開する設計は採らない**。

### 4. atomFamily: 購読粒度を局所化したい場合に使用

タブ ID 等のキーごとに独立した state を持ち、かつ「特定キーの変更を特定キーの購読者にだけ伝えたい」場合に使用する。素朴に `atom<Map<K, V>>` で代替可能だが、購読粒度が Map 全体になりキー間で意図しない再レンダリングが伝播するため、独立購読が必要な場面では atomFamily を採用する。

### 5. 計算結果の共有は React 機能で代替

派生 atom が解決していた「計算結果の共有」は以下のいずれかで代替する:

- コンポーネントローカルの `useMemo`
- 複数コンポーネントから使うなら共通カスタムフック
- React 外からも使うなら純粋関数を `selectors.ts` 等で export

### 6. atom 定義ファイルの構成: 役割別分割 (`index.ts` なし) を採用

`state/<domain>/` 配下に **役割別** で複数ファイルに分割する。

```
state/<domain>/
  types.ts    # 型定義のみ
  atoms.ts    # PrimitiveAtom / atomFamily / focusAtom helper / 純粋関数
  actions.ts  # write-only action atom
```

- 各ファイルは公開境界をそのまま export し、import 元は **ファイル単位で直接 import** する (`from "@/state/workbench/actions"` 等)
- バレル (`index.ts`) は置かない (理由は Alternatives G)
- 量が増えて分割粒度を細かくする場合 (例: `families.ts` / `selectors.ts`) もこの方針内で拡張する
- ドメイン数が継続的に増える見込みが立った場合は機能ドメイン別フォルダ (Alternatives E) への移行を再検討する

## Consequences

### Positive

- atom の依存関係が **静的に追跡可能** になる (派生 atom の動的依存・任意ロジックを排除)
- 「ある atom を変えたとき何が再計算/再レンダリングされるか」がコードの grep で網羅可能
- 状態更新ロジックは action atom か React フック層に限定され、レイヤが明確
- focusAtom により大構造 state の **部分購読** は維持できる
- atom 数の爆発を抑制 (1 atom = 1 setter を強制しない)

### Negative

- 派生 atom があれば 1 行で書けた「アクティブタブを取得」のような計算が、`useMemo` / カスタムフックでの記述になる (ボイラープレート増)
- 「A が変わったら B も更新」を action atom 内で **明示する必要** (派生 atom の自動再計算は使えない)。漏れるとバグの原因になる
- React 外から計算結果を取りたい場面で純粋関数を別途用意する手間

## Alternatives Considered

### A. 派生 atom を全面許可

**却下理由**: 依存先が動的 (条件分岐内の get) になりうる、連鎖して指数的に複雑化する、コード本体を読まないと依存関係が分からない、といった保守性の課題が大きい。本プロジェクトの開発体制 (少人数 + AI エージェント併用) では、依存関係の暗黙化が特にコストになる。

### B. focusAtom も含めて全面禁止

**却下理由**: オブジェクト型 state の部分購読/更新が冗長化する (例: `DescribeTabState` の `selectedFieldName` だけ更新したいとき、毎回構造全体を spread でコピー)。focusAtom は依存先が parent atom 1 つに固定され、optic を構造アクセス系のみに限定すれば動的依存が発生せず、**静的に path が追跡可能**。派生 atom と同じリスクを持たないため、限定的に許容する方が実装コストとのバランスが良い。

### C. 1 atom = 1 set action atom を必須化

**却下理由**: 単純な値保持の atom まで action 化するとボイラープレートが爆発する。`useSetAtom(primitiveAtom)` は購読を発生させずに setter を取得できるため、業務ロジックがない場合は action atom 化の付加価値がない。中規模 SPA では過剰な規約となる。

### D. atomFamily の代わりに `atom<Map<K, V>>` を使う

**却下理由**: 購読粒度が Map 全体になり、任意のキーの変更で全購読者が再レンダリングされる。タブ機能のように「キーごとに独立した state」が並存するケースでは性能・整合性ともに atomFamily が優位。

### E. 機能ドメイン別フォルダ (`features/<domain>/state/`) でコロケーションする

**却下理由**: 本プロジェクト規模では state 管理ドメインが少数 (現状ほぼタブ機能のみ)。features フォルダを切ると state の置き場所判断が逆に増え、共有 atom (`currentUserAtom` 等) の置き場所に迷いが出る。ドメイン数が継続的に増える見込みが立った時点で再検討する。

### F. atom 層を隠蔽するカスタムフック層 (`useTabs()`, `useAddDescribeTab()` 等) で公開

**却下理由**: atom 構造変更を吸収できる利点はあるが、「1 atom = 1 hook」を量産する設計と相性が悪く、Decision 3 の「1 atom = 1 set action atom を機械的に展開しない」と同じ過剰さを生む。atom 構造を頻繁に変える要件・テスト時に hook をモックする要件も現状ない。

### G. バレル (`index.ts`) で公開 API を集約する

**却下理由**:

- 役割別分割した意味が薄れる (import 元は何でも index 経由になり、ファイル分割の構造が呼び出し側から見えなくなる)
- バレル経由の import は循環参照のグラフが追いにくく、Vite/TS が解決できない循環を生みやすい
- Vite/Rollup の tree-shaking は直接 import でも効くので性能上の利点が無い
- 現状の atom 内に「外から触らせたくない内部 atom」が無く、公開 API の境界を強制する要件も薄い

将来「内部 atom と公開 atom を線引きしたい」「ファイル構造を頻繁に変えて import 元を不安定にしたくない」要件が出てきた時点で再検討する。

## References

- 関連スペック: [docs/specs/008-workbench-layout/spec.md](../specs/008-workbench-layout/spec.md)
- 関連 Issue: [#24 ツリー + マルチタブ式メイン画面への UI 刷新](https://github.com/Satoshi-Tb/forceworkbench-mini/issues/24)
- Jotai 公式ドキュメント: https://jotai.org/
- jotai-optics (focusAtom): https://jotai.org/docs/extensions/optics
