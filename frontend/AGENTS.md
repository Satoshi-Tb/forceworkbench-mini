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
- 単体テストは `npm run test` で実行する。テストファイルは `frontend/src/**/*.test.ts` に置く。非公開 helper (`formatCondition` / `formatValue` など) はテストのためだけに export せず、公開関数経由で挙動を確認する。
- **E2E テストは Playwright を採用する**。バックエンドは `application-mock` プロファイルで起動し、Playwright の `webServer` 設定経由で自動起動する (実 Salesforce 接続なし)。**正常系を中心**に画面遷移・主要シナリオを検証する。
- E2E は `npm run test:e2e` で実行する。内部で `npm run build:e2e` によりフロントエンドを `frontend/e2e-static` にビルドし、Playwright は Spring Boot backend 1 本だけを `webServer` で起動して静的ファイルも配信する。テストファイルは `frontend/e2e/**/*.spec.ts` に置く。
- **入力エラー表示は画面ごとに wiring smoke を 1 件だけ E2E に残す**。Zod スキーマのルール網羅は Vitest 側で行う。未入力時に送信ボタンを非活性化する画面では、空送信ではなく UI から到達可能な入力エラーで wiring を確認する。
- スナップショット / ビジュアルリグレッション / アクセシビリティ自動検査は採用しない。
- CI 必須化は本方針のスコープ外 (別 issue で扱う)。

詳細・検討経緯・代替案: [docs/adr/0002-frontend-test-strategy.md](../docs/adr/0002-frontend-test-strategy.md)

## テストヘルパー作成ルール

テストファイル内でヘルパー関数を作成する場合のルール。Vitest 単体テスト・Playwright E2E の双方に適用する。

- **可読性は DRY より優先する** — 重複を恐れず、読み手がテスト本体だけで「何を主張しているか」を理解できる状態を保つ。helper まで往復しないと意味が取れない構造は避ける。
- **作成は明確なメリットがある場合のみ** — 採用基準は (a) 冗長な boilerplate の回避 (例: プロパティ数が多い型の構築) / (b) フレーキー要素の局所化 (例: Playwright の `Promise.all([waitForEvent, click])` の発火順序) / (c) ユーザ動作への意味付け (例: `login(page)`)。いずれにも該当しない場合はインラインで書く。
- **helper にはコメント必須** — 利用者がコードを読まずに使えるよう、目的・適用範囲を helper 直上にコメントとして書く。
- **assert を helper に隠さない** — `expect` 系の assertion はテスト本体に置く。helper は値の準備・操作・取得だけに留める。失敗時のスタックトレースが helper を指してテストの主張がぼやけることを避けるため。
- **テスト helper は production コードと独立させる** — production の関数 (例: 初期 state ファクトリ等) を helper として流用しない。production の修正でテストが連鎖的に壊れることを避けるため、テスト用の fixture / factory は独立して用意する。
- **命名と中身の抽象度を一致させる** — 名前が抽象的なら中身も抽象 (例: `login` は user 動作レベル)、中身が低水準 1 操作なら名前も具体的にする。名前と中身の抽象度がズレた helper はインライン化するか分割する。
- **戻り値型を明示する** — TypeScript の型推論に任せず `Promise<Buffer>` / `Promise<void>` 等を書く。呼び出し側で helper 本体を遡らず使えるようにするため。
- **helper が throw する経路は具体的な文言にする** — `throw new Error("...")` の文言は「何が起きたか」が分かるものにする。テスト失敗時の調査時間を短縮するため。

### 今後検討

以下は採用見送り。必要が生じた時点で再検討する。

- **共有 helper への昇格基準** — 「何ファイルで重複したら共通モジュール (`*.testSupport.ts` 等) に抽出するか」のルールは現時点では設けない。各テストファイル末尾配置のままとし、複数ファイルで重複が顕在化した時点で再検討する。
