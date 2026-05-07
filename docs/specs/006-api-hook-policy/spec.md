# 認証 API を含む API hook 化方針の整理 (issue #9)

## 背景・目的

フロントエンドの API 呼び出しが二系統で混在している。

- **TanStack Query 経由 (整理済み):** `useCurrentUser` / `useDescribeGlobal` / `useDescribeSObject` / `useRunSoql`
- **fetcher 直呼び (未整理):** `login` (`routes/login.tsx:36`), `logout` (`routes/__root.tsx:52`), `downloadCsv` (`routes/query.tsx:92`)

混在の影響として、以下が発生している。

- ログイン成功後の `queryClient.setQueryData(currentUserQueryKey, user)` を画面コンポーネントで手動同期しており、画面ロジックとキャッシュ管理が結合している
- `loading` / `error` が画面の `useState` と TanStack Query の `isPending` / `error` で二重に管理されている
- queryKey の命名規則と配置が文書化されておらず、各 hook ファイル内の定数として散在している

issue #9 の完了条件:

1. API fetcher と TanStack Query hook の分担方針が明文化されている
2. 認証 API を含む主要 API の hook 化対象が整理されている
3. 必要に応じて既存実装が方針に沿って修正されている
4. 既存の画面動作が維持されている

## 成功基準

- 画面コンポーネントから `frontend/src/api/*` を直接 import している箇所が無い (`apiFetch` 等の共通ユーティリティを除く)
- `login` / `logout` / `downloadCsv` が TanStack Query の `useMutation` 経由になっている
- queryKey が `frontend/src/hooks/queryKeys.ts` に集約されている
- フロントエンド開発時のコーディング指針 (`frontend/AGENTS.md`) に責務分担・命名規則・キャッシュ更新方針が明文化されている
- ログイン / ログアウト / SOQL 実行 / CSV ダウンロード / describe 画面遷移の既存動作が維持されている
- `cd frontend && npm run lint && npm run build` が通る

## 方針

| 項目 | 内容 |
|---|---|
| `api/*` 層の責務 | HTTP fetcher の薄い層。`apiFetch` (CSRF・401 ハンドリング)・`ensureOk`・Zod 検証経由でレスポンス型と fetcher 関数のみ export。React 状態は持たない |
| `hooks/*` 層の責務 | TanStack Query の `useQuery` / `useMutation` を集約。画面コンポーネントは `hooks/*` のみを使用し `api/*` を直接 import しない |
| queryKey 配置 | 全 queryKey を `frontend/src/hooks/queryKeys.ts` に集約・export。第1要素はドメイン名 (`auth` / `describe`) とする |
| キャッシュ更新方針 | mutation hook の `onSuccess` でキャッシュ更新を完結させる (画面側で `setQueryData` を直書きしない) |
| loading / error 表示 | `mutation.isPending` / `mutation.error` を画面で参照し、`useState` による独自管理は禁止 |
| Router beforeLoad | `__root.tsx` の認証チェックは `queryClient.fetchQuery(currentUserQueryOptions)` のまま維持 |

### キャッシュ更新の具体方針

| hook | 成功時の処理 |
|---|---|
| `useLogin` | `queryClient.setQueryData(queryKeys.auth.me, user)` |
| `useLogout` | `queryClient.setQueryData(queryKeys.auth.me, null)` |
| `useRunSoql` | invalidate / setQueryData は不要 (単発実行系) |
| `useExportCsv` | invalidate / setQueryData は不要 (副作用はファイル DL のみ) |

## 対象 API の最終リスト

### 新規 hook 化する API

| fetcher | 新規 hook | hook 種別 | 配置 |
|---|---|---|---|
| `login` | `useLogin` | `useMutation` | `frontend/src/hooks/useLogin.ts` |
| `logout` | `useLogout` | `useMutation` | `frontend/src/hooks/useLogout.ts` |
| `downloadCsv` | `useExportCsv` | `useMutation` | `frontend/src/hooks/useExportCsv.ts` |

`useExportCsv` は `downloadCsv` の Blob 取得に加えて、`URL.createObjectURL` → anchor click → `revokeObjectURL` までを `mutationFn` 内で完結させる。引数は `{ soql, encoding, filename }`。ファイル名生成 (`formatJstTimestamp`) は呼び出し画面側に残す。

### 既存 hook (queryKey 集約のみ実施)

| hook | 変更内容 |
|---|---|
| `useCurrentUser` | `currentUserQueryKey` 定数を削除し、`queryKeys.auth.me` を参照。`currentUserQueryOptions` は `__root.tsx` の `beforeLoad` で利用中のため残す |
| `useDescribeGlobal` | `queryKeys.describe.global` を参照 |
| `useDescribeSObject` | `queryKeys.describe.sobject(name)` を参照 |
| `useRunSoql` | 変更なし (queryKey 不要の mutation hook) |

### queryKeys.ts の構造

```typescript
export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  describe: {
    global: ["describe", "global"] as const,
    sobject: (name: string) => ["describe", name] as const,
  },
} as const;
```

## 影響ファイル

### フロントエンド (新規)

- `frontend/AGENTS.md`
  - 「API 呼び出しの責務分担」「queryKey 命名規則」「mutation 後のキャッシュ更新」「loading / error 表示方針」を記述
  - ルートの `AGENTS.md` のフロントエンド固有ルールを引き上げる位置付け

- `frontend/src/hooks/queryKeys.ts`
  - 上記の `queryKeys` オブジェクトを定義・export

- `frontend/src/hooks/useLogin.ts`
  - `useMutation` で `login` fetcher をラップ
  - `onSuccess` で `queryClient.setQueryData(queryKeys.auth.me, user)` を実行

- `frontend/src/hooks/useLogout.ts`
  - `useMutation` で `logout` fetcher をラップ
  - `onSuccess` で `queryClient.setQueryData(queryKeys.auth.me, null)` を実行

- `frontend/src/hooks/useExportCsv.ts`
  - `useMutation<void, ApiError, { soql: string; encoding: CsvEncoding; filename: string }>` の形
  - `mutationFn` 内で `downloadCsv` 呼び出しから DL トリガまでを実行

### フロントエンド (修正)

- `frontend/src/hooks/useCurrentUser.ts`
  - `currentUserQueryKey` 定数を削除し、`queryKeys.auth.me` 参照に置換
  - `currentUserQueryOptions` の `queryKey` も `queryKeys.auth.me` 参照に変更

- `frontend/src/hooks/useDescribeGlobal.ts`
  - `queryKey` を `queryKeys.describe.global` に変更

- `frontend/src/hooks/useDescribeSObject.ts`
  - `queryKey` を `queryKeys.describe.sobject(name)` に変更

- `frontend/src/routes/login.tsx`
  - `useState<boolean>(loading)` / `useState<string | null>(error)` を削除
  - `useLogin` の `mutate` / `isPending` / `error` を使用
  - `queryClient.setQueryData` の直接呼び出しを削除 (hook 内に移動)
  - `currentUserQueryKey` の import を削除

- `frontend/src/routes/__root.tsx`
  - `handleLogout` を `useLogout` の `mutate` 経由に置換
  - `setQueryData(currentUserQueryKey, null)` の直接呼び出しを削除 (hook 内に移動)
  - `currentUserQueryKey` の import を削除

- `frontend/src/routes/query.tsx`
  - `handleCsv` を `useExportCsv` の `mutateAsync` 経由に置換
  - `csvError` の `useState` を削除し `exportCsv.error` を参照
  - `formatJstTimestamp` で生成したファイル名は hook 引数として渡す

### バックエンド

変更なし。

### ドキュメント

`docs/migration-plan/` への追記は不要。本 spec が方針記録となる。実装後の運用ルールは `frontend/AGENTS.md` に集約する。

## 検証手順

1. **静的検証**

   ```bash
   cd frontend
   npm run lint
   npm run build
   ```

   両方成功すること。

2. **手動動作確認** (`SPRING_PROFILES_ACTIVE=mock` で backend 起動 + `npm run dev` でフロント起動)

   | 手順 | 期待動作 |
   |---|---|
   | `/login` で誤った資格情報を入力 | 「ログインに失敗しました」が表示される。`mutation.isPending` 中はボタンが disabled |
   | 正しい資格情報でログイン | `/query` へ遷移。AppBar にユーザー名・ログアウトボタンが表示 |
   | `/query` で SObject 選択 → SOQL 自動生成 → 「実行」 | 結果がグリッドに表示される |
   | 「CSV」ボタン押下 (Shift_JIS / UTF-8 両方) | ファイル `query_yyyyMMddHHmmss.csv` がダウンロードされる |
   | バックエンド停止状態で「CSV」 | Alert に「CSVダウンロードに失敗しました」 |
   | 「ログアウト」ボタン | `/login` へ遷移 |
   | 直 URL で `/query` へアクセス (未ログイン) | `/login` へリダイレクト |

3. **キャッシュ動作確認**

   - ログイン直後、AppBar のユーザー名表示に refetch 待ちが発生しない (`setQueryData` で即時反映)
   - ログアウト後、`useCurrentUser` が `null` を返す
   - `/describe` 初回ロード後、再訪時にキャッシュ HIT する

## 補足: 検討して採用しなかった案

- **queryKey を各 hook ファイル内定数のまま維持:** 現状規模 (hook 7 個程度) なら命名規則だけで重複は防げるが、`hooks/queryKeys.ts` への集約のほうが一覧性・リファクタ容易性が高く、ファイル増のコストよりメリットが上回ると判断
- **方針を `docs/` 配下の独立ファイルに置く:** コード変更時に参照されにくい。`frontend/AGENTS.md` ならルートの `AGENTS.md` から自然に辿れ、AI / 開発者の作業時に確実に読まれる
- **`downloadCsv` を fetcher 直呼びのまま残す:** ファイルダウンロードの副作用が大きい点は事実だが、`isPending` / `error` を画面で `useState` 二重管理する状態が残る。`mutationFn` 内に副作用を閉じ込めれば画面はシンプルになり一貫性が向上する
