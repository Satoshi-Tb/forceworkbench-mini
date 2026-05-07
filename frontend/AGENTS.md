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
