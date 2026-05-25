# Karpathy 4原則（要約）

- 実装前に前提を明示する。曖昧なら聞く
- 最小限のコードで解決する。投機的な追加は不可
- 依頼された範囲だけを変更する
- 成功基準を先に定義し、検証可能にする

# 禁止事項

- 依頼されていないリファクタをしない
- 既存コードのスタイルを変えない
- 過剰なエンジニアリングをしない
- フォールバック・デフォルト引数を濫用しない
- デッドコード・未使用コードを放置しない
- 不要な後方互換コードを生成しない

# 秘匿情報の取り扱い

秘匿情報が会話履歴に露出した場合、即座にユーザへ警告する。

- 対象: パスワード / API トークン / OAuth secret / security token / 秘密鍵 / `.env` の中身 / `credentials.json` / password を含む接続文字列など
- 検知タイミング: ユーザのペースト、IDE 選択範囲、ファイル読込、ツール出力など経路を問わず、値が会話に乗った時点
- 対応:
  - 該当値が露出した事実を明示する
  - 用途 (本番 / ステージング / 使い捨て Developer Edition 等) をユーザに確認する
  - 必要ならローテート手順 (例: Salesforce → Setup → My Personal Information → Reset My Security Token) を案内する
- 禁止: 秘匿情報を commit / ログ出力 / 中間ファイル / コメント / 説明文に残さない (引用すらしない)

## コードスタイル

**共通:**

- 巧妙なコードより、シンプルで読みやすいコードを優先

**フロントエンド:**

- TypeScript strict mode
- ESLint によるリンティング

**バックエンド:**

# ビルド・テスト

## 自動テスト方針

**フロントエンド:**

- フォーマッタ: `npm run format`
- リント: `npm run lint`
- ビルド: `npm run build`
- 単体テスト: `npm run test`。方針は `docs/adr/0002-frontend-test-strategy.md` に従う (Vitest を採用・純粋関数と入力チェックに限定・見た目テストは行わない)。

**バックエンド:**

- ビルド/既存テスト確認: `.\mvnw.cmd -B clean test`
- パッケージング確認が必要な場合: `.\mvnw.cmd -B clean -DskipTests package`
- 新規テストコード: 詳細方針 `backend/AGENTS.md` に沿って、必要であれば追加
- 既存テストの追従修正: 対象コードを改修した場合は必須

**E2Eテスト:**

- `npm run test:e2e`。方針は `docs/adr/0002-frontend-test-strategy.md` に従う (Playwright を採用・正常系中心・バックエンドは `application-mock` プロファイルで `webServer` 経由自動起動)。
