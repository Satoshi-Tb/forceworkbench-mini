# フロントエンド実装ルール

## API 呼び出し

- `frontend/src/api/*` は HTTP fetcher の薄い層に限定する。
- 画面コンポーネントは `frontend/src/hooks/*` の hook 経由で API を呼び出す。
- 画面コンポーネントから `frontend/src/api/*` の fetcher 関数を直接 import しない。
- `frontend/src/api/*` からの型 import は許可する。

## queryKey

- queryKey は `frontend/src/hooks/queryKeys.ts` に集約する。
- 第1要素はドメイン名にする。例: `auth`, `describe`
- hook 内で queryKey を直書きせず、`queryKeys` を参照する。

## mutation 後のキャッシュ更新

- mutation 成功後の TanStack Query キャッシュ更新は hook の `onSuccess` に集約する。
- 画面コンポーネントで `queryClient.setQueryData` を直接呼び出さない。
- 単発実行系やファイルダウンロード系は、必要がない限り invalidate / setQueryData を行わない。

## loading / error 表示

- API 実行中状態は `mutation.isPending` や query の loading 状態を参照する。
- API エラー表示は `mutation.error` や query の `error` を参照する。
- API の loading / error を画面の `useState` で二重管理しない。

## 状態管理 (Jotai)

- **派生 atom (read 関数を持つ atom) は原則禁止** — 依存関係追跡が困難になるため。
- **focusAtom は `.prop()` / `.path()` / `.nth()` 等の構造アクセス系 optic に限り使用可** — `.iso()` / `.lens()` 等の任意変換ロジックを埋め込む optic は派生 atom 扱いとして禁止。
- **action atom (write-only atom) は業務ロジックを伴う複数 atom 更新のみに使用** — 単純な値の代入は `useSetAtom(primitiveAtom)` で十分。1 atom = 1 set action atom の機械的展開は採らない。
- **atomFamily は購読粒度を局所化したい場合に使用** — タブ ID 等のキー別独立 state で、キー間の不要な再レンダリング波及を避けたい場合。
  - **キー破棄時に `family.remove(key)` を必ず呼ぶ** — atomFamily は内部 Map にキーごとの atom インスタンスをキャッシュするため、解放しないとメモリリークになる。例: タブを閉じる action atom 内で `describeTabStateFamily.remove(tabId)` を実行する。
  - **import 元は `jotai-family` パッケージ** — `import { atomFamily } from "jotai-family"`。`jotai/utils` 経由は使わない (理由は ADR-0001 Decision 7 / Alternatives H)。`focusAtom` も同様に `jotai-optics` から取る。
- **計算結果の共有は派生 atom ではなく `useMemo` / カスタムフック / 純粋関数 export で代替**。

詳細・検討経緯: [docs/adr/0001-jotai-atom-usage.md](../docs/adr/0001-jotai-atom-usage.md)

## テスト戦略

- **単体テストは Vitest を採用する**。スコープは `frontend/src/utils/*` の純粋関数・入力チェック (Zod スキーマ含む)・`hooks` の純粋部分に限定する。**見た目 (描画) のテストは実施しない** (フレーキー回避のため `jsdom` / `@testing-library/react` / `MSW` は導入しない)。
- **E2E テストは Playwright を採用する**。バックエンドは `application-mock` プロファイルで起動し、Playwright の `webServer` 設定経由で自動起動する (実 Salesforce 接続なし)。**正常系を中心**に画面遷移・主要シナリオを検証する。
- **入力エラー表示は画面ごとに wiring smoke を 1 件だけ E2E に残す**。Zod スキーマのルール網羅は Vitest 側で行い、E2E では「空送信 → エラー表示が出る」の 1 件だけで `zodResolver` の繋ぎ込みを確認する。
- スナップショット / ビジュアルリグレッション / アクセシビリティ自動検査は採用しない。
- CI 必須化は本方針のスコープ外 (別 issue で扱う)。
- 本 ADR 採択時点ではテスト基盤・テストコードは未追加。実装は issue #26 で issue #11 (Zod 導入) 完了後に着手する。

詳細・検討経緯・代替案: [docs/adr/0002-frontend-test-strategy.md](../docs/adr/0002-frontend-test-strategy.md)
