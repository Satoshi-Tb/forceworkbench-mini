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
- **計算結果の共有は派生 atom ではなく `useMemo` / カスタムフック / 純粋関数 export で代替**。

詳細・検討経緯: [docs/adr/0001-jotai-atom-usage.md](../docs/adr/0001-jotai-atom-usage.md)
