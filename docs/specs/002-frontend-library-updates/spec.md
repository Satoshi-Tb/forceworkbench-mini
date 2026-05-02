# フロントエンドライブラリ更新 実装方針

## 前提

- 本仕様は、フロントエンド基盤ライブラリを現行世代へ更新するための実装計画である。
- 対象は `frontend` アプリの依存関係、設定、必要最小限のコード修正に限定する。
- 既存採用済みの `Vite`、`TypeScript`、`TanStack Router`、`TanStack Query`、`MUI` は継続採用する。
- React 19 の新機能利用は目的にしない。React 19 への更新は MUI v7 との整合性を主目的とする。
- Node.js は v24 を利用する前提とし、Vite 8 の Node.js 要件は満たしている。
- Dockerfile 化を見据え、`npm ci` と lockfile による再現可能な install を前提にする。
- バックエンドは本仕様の変更対象外。

## 成功基準

- `frontend/package.json` の主要依存が次の方針へ更新されている。
  - `react` / `react-dom`: 19系
  - `@types/react` / `@types/react-dom`: 19系
  - `@mui/material`: 7系
  - `@mui/x-data-grid`: 8系
  - `vite`: 8系
  - `@vitejs/plugin-react`: Vite 8 と整合する版
  - `zod`: 4系
  - `prettier` / `eslint-config-prettier`: devDependencies
- `npm run lint`、`npm run build` が通る。
- `npm run format` と `npm run format:check` が利用できる。
- 既存画面 (`/login`、`/query`、`/describe`) がビルド時に型エラーを起こさない。
- Vite 8 更新後も ESLint / Prettier の責務が分離されている。
- Docker build 時に本番成果物は `frontend/dist` を使う前提を崩さない。

## 採用方針

### React

- React 18.3.1 から React 19系へ更新する。
- React 19 の Actions、`useActionState`、`useOptimistic`、`use` などの新機能は今回の実装では使わない。
- 更新理由は、MUI v7 が `react-is@19` を前提にするため、React 18 以下で必要になる `react-is` override を避けること。
- React 19 移行に伴い、`@types/react` と `@types/react-dom` も 19系へ合わせる。

### MUI

- `@mui/material` は v7系へ更新する。
- `@mui/x-data-grid` は v8系へ更新する。
- MUI v7 / MUI X v8 の migration guide に従い、破壊的変更が出た箇所だけを修正する。
- UI 改修やデザイン変更は行わない。ビルド・型・実行互換を保つための最小修正に留める。

### Vite

- Vite は v8系へ更新する。
- Vite 8 は Rolldown / Oxc ベースへ移行しているため、MUI / React 更新とは別コミットまたは少なくとも別ステップとして検証する。
- 現在の `vite.config.ts` は React plugin と `/api` proxy のみであり、複雑な Rollup 設定はないため、影響範囲は小さい見込み。
- Vite 8 は ESLint / Prettier の代替ではない。lint / format は引き続き個別ツールで実行する。

### ESLint / Prettier

- ESLint は既存設定を維持する。
- Prettier を新規導入し、フォーマット責務を Prettier に寄せる。
- `eslint-config-prettier` を導入し、ESLint と Prettier の整形系ルール衝突を避ける。
- `package.json` に次の scripts を追加または整理する。

```json
{
  "scripts": {
    "format": "prettier . --write",
    "format:check": "prettier . --check",
    "lint": "eslint .",
    "build": "tsc -b && vite build"
  }
}
```

### Zod

- Zod 4系を導入する。
- 初期用途はフォーム入力検証ではなく、API response validation とする。
- React Hook Form は今回導入しない。入力フォームが増え、複数項目のバリデーションやエラー表示が必要になった段階で検討する。

## Zod API response validation 方針

### 目的

TypeScript の型は実行時には JSON の形を保証しないため、API 境界で `unknown` を Zod schema に通してからアプリ内部へ入れる。

対象候補:

- `/api/describe` のオブジェクト一覧
- `/api/describe/:sobject` のオブジェクト詳細
- SOQL 実行結果
- ログイン済みユーザー情報
- エラー JSON (`code` / `message`)

### 実装イメージ

```ts
import { z } from "zod";
import { ApiError, apiFetch, ensureOk } from "./client";

const sObjectSummarySchema = z.object({
  name: z.string(),
  label: z.string(),
  custom: z.boolean(),
});

const describeGlobalSchema = z.object({
  sobjects: z.array(sObjectSummarySchema),
});

type DescribeGlobal = z.infer<typeof describeGlobalSchema>;

function parseApiResponse<T>(schema: z.ZodSchema<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  throw new ApiError("INVALID_RESPONSE", "APIレスポンスの形式が不正です", 500);
}

export async function fetchDescribeGlobal(): Promise<DescribeGlobal> {
  const response = await ensureOk(await apiFetch("/api/describe"));
  const body: unknown = await response.json();
  return parseApiResponse(describeGlobalSchema, body);
}
```

### 導入順

1. `describe` 系 API の schema を追加する。
2. `response.json()` の戻り値を `unknown` として扱い、schema parse 後に返す。
3. schema から `z.infer` で型を生成できる場合は、既存の重複 type 定義を最小限に整理する。
4. SOQL 実行結果など、影響範囲が広いレスポンスへ段階的に広げる。

## Docker 前提

- 既存 Dockerfile の `node:24-alpine` を維持する。
- フロントエンド build stage では `npm ci` を使う。
- Docker layer cache が効くように、先に `package.json` と lockfile を copy して install し、その後 source を copy する。
- 本番 image には `node_modules` を持ち込まず、`frontend/dist` を配信対象にする。

## 実装ステップ

1. **Prettier 導入**
   - `prettier` と `eslint-config-prettier` を devDependencies に追加
   - `format` / `format:check` scripts を追加
   - 必要なら `.prettierrc` または `package.json` の Prettier 設定を追加
2. **React 19 更新**
   - `react` / `react-dom` / `@types/react` / `@types/react-dom` を 19系へ更新
   - 型エラーが出た箇所だけ修正
3. **MUI 更新**
   - `@mui/material` を 7系へ更新
   - `@mui/x-data-grid` を 8系へ更新
   - migration に伴う型・props の差分だけ修正
4. **Zod 導入**
   - `zod` を dependencies に追加
   - まず `describe` 系 API response validation を追加
5. **Vite 8 更新**
   - `vite` と `@vitejs/plugin-react` を更新
   - `vite.config.ts` の互換性を確認
6. **検証**
   - install、format check、lint、build を実行
   - 主要画面を手動確認

## 検証

```bash
cd frontend
npm ci
npm run format:check
npm run lint
npm run build
```

手動確認:

- `/login` が表示され、フォーム入力できる。
- `/query` が表示され、既存 SOQL 実行 UI が壊れていない。
- `/describe` が表示され、オブジェクト一覧と詳細画面が壊れていない。
- ブラウザ console に React / MUI / DataGrid 由来の明確な runtime error が出ていない。

## スコープ外

- React 19 の新機能を使ったフォームや mutation 処理への書き換え
- React Hook Form の導入
- UI デザイン変更
- 既存コンポーネントのリファクタ
- テスト基盤 (`vitest` / Testing Library) の新規導入
- Dockerfile 本体の作成
- バックエンド変更
