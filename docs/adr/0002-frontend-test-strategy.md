# ADR-0002: フロントエンド自動テスト・E2E 戦略

## Status

Accepted (2026-05-21)

## Context

forceworkbench-mini のフロントエンド (`frontend/`) には自動テストが存在せず、ルート `AGENTS.md` で「明示依頼があるまで `npm run test` / `npm run test:e2e` やテスト基盤を追加しない」と規定していた。

issue #6 (フロントエンド自動テストと E2E 導入を検討する) にて、テスト導入要否・採用フレームワーク・スコープ・モック戦略・CI での扱いを検討した結果、明示依頼として **単体テストと E2E テストの双方を導入する** 結論に至った。本 ADR は採用方針・代替案・帰結を恒久ルールとして集約する。

検討時の主要論点は以下:

| 論点 | 検討内容 |
|---|---|
| 単体テストの採用フレームワーク | Vitest / Jest |
| 単体テストの対象範囲 | 純粋関数のみ / hooks / コンポーネント描画 / atom |
| 見た目 (描画) テストの是非 | jsdom + `@testing-library/react` を入れるか |
| API モックの要否 | MSW 等を導入するか |
| E2E のフレームワーク | Playwright / Cypress |
| E2E のスコープ | 正常系のみ / 異常系もカバー |
| E2E のバックエンド起動方式 | 手動起動 / npm script 起動 / Playwright `webServer` |
| 入力チェックを E2E でどこまで見るか | 全パターン / wiring smoke のみ / なし |
| CI 必須化 | 本決定で扱うか別 issue か |

バックエンドのテスト方針は [docs/specs/007-backend-test-policy/spec.md](../specs/007-backend-test-policy/spec.md) で別途確定済み (JUnit 5 + AssertJ + `MockSalesforceClient` 中心)。フロントエンドの方針はバックエンドと独立に決める。

## Decision

### 1. 単体テスト: Vitest を採用

`frontend/` の単体テストは **Vitest** を採用する。

- Vite ネイティブで `vite.config.ts` を流用可能
- TypeScript / ESM 設定の二重化が不要
- Node ベースの実行で高速

`jsdom` / `@testing-library/react` / `MSW` は **導入しない**。理由は Alternatives C / D / E 参照。

### 2. 単体テストの対象範囲

| 区分 | 扱い |
|---|---|
| 純粋関数 (`frontend/src/utils/*` 等) | 対象 |
| 入力チェック (Zod スキーマ・既存 `soqlBuilder` の入力検証) | 対象 |
| hooks の純粋部分 (例: `apiErrorMessage`) | 対象 |
| コンポーネント描画 | **対象外** |
| Jotai atoms 単体 | 対象外 |
| TanStack Query / Router の振る舞い | 対象外 |
| スナップショット | 対象外 |

「見た目 (DOM 描画) を検証するテストは書かない」を原則とする。MUI / Jotai / TanStack Query / TanStack Router が絡む jsdom 経由のテストはフレーキー化のリスクが高く、保守コストに対し退行検出力が見合わない。実 DOM での振る舞い検証は E2E 側に集約する。

### 3. E2E テスト: Playwright を採用

E2E テストは **Playwright** を採用する。

- Chromium / WebKit / Firefox を一律対応
- `webServer` 設定による依存サーバ自動起動が公式機能として整っている
- iframe の取り扱いに癖が少ない

### 4. E2E のバックエンド起動: Playwright `webServer` で自動起動

- バックエンドを `application-mock` プロファイルで起動する (実 Salesforce には接続しない)
- Playwright の `webServer` 設定で自動起動・自動停止する
- `reuseExistingServer: !process.env.CI` を指定し、ローカルでは既に起動済みの backend を再利用、CI では毎回新規起動とする
- Windows / Unix の `mvnw.cmd` / `mvnw` の出し分けは `process.platform` で判定する
- フロントエンド配信は `SpaForwardingConfig` 経由でバックエンドから配る構成を基本とし、`webServer` 配列に backend を 1 つだけ並べる (Vite dev server を E2E で別途起動する必要が出た場合は実装側で再検討する)

### 5. E2E のスコープ: 正常系中心 + 画面ごと wiring smoke 1 件

| 区分 | 扱い |
|---|---|
| ログイン → 主要画面遷移 (正常系) | 対象 |
| SOQL 実行 → DataGrid 描画 (正常系) | 対象 |
| 次ページ取得・CSV ダウンロード・Describe 遷移 | 対象 |
| 入力エラー表示 (wiring smoke) | 対象。**画面ごとに 1 件だけ** |
| API エラーのリッチな分岐 | 対象外。バックエンド Controller テストで経路保証する |
| スナップショット / ビジュアルリグレッション | 対象外 |
| アクセシビリティ自動検査 (axe 等) | 対象外。必要になった時点で別途扱う |
| 本物の Salesforce 接続を伴う E2E | 対象外 |

### 6. 入力チェックの役割分担: Zod 単体テスト + 画面ごと wiring smoke

入力チェックの検証は以下の 2 層構造で扱う:

- **Zod スキーマのルール網羅** (required / min / max / regex / refine 等) は Vitest 側でテーブル駆動して網羅する
- **フォーム → `zodResolver` → React Hook Form → MUI `helperText` の wiring** (繋ぎ込みの正しさ) は E2E 側で「画面ごとに 1 件だけ smoke 確認」する (空送信 → エラー表示)

これにより「個別ルールを追加するたびに E2E を増やす」運用を避け、E2E は正常系中心という方針を維持する。1 画面あたり wiring smoke は 1 件を超えない。

理由は Alternatives F 参照。

### 7. モック戦略

- **単体テスト**: 何もモックしない。純粋関数 / 入力チェック / 純粋 hooks に限定するため I/O 自体が無い
- **E2E**: バックエンドを `application-mock` プロファイルで起動 (実 Salesforce 非依存)。Playwright route interception は使わない

### 8. CI 必須化: 本 ADR ではスコープ外

`.github/workflows/` の構築は本 ADR で扱わない。理由は spec 007 (バックエンドテスト方針) と同じ (CI は課金 / Secrets 設計 / PR 戦略を伴うため別途検討する)。

将来 CI を導入する際の優先順位想定: `format:check` / `lint` / `build` 静的検証 → `npm run test` → `npm run test:e2e`。確定は CI 構築側で行う。

開発者運用ルール (テスト導入後):

- フロントエンドコードを変更する PR では、変更内容に応じて `npm run test` を実行して PASS であることを確認する
- E2E が壊れた場合、`@test.skip` / `@test.fixme` で逃げない。原因を直すかテスト側を修正する

## Consequences

### Positive

- 純粋ロジック (`soqlBuilder` の演算子分岐・エスケープ等) の退行を最小コストで検知できる
- Zod スキーマ導入後、入力検証ルールの網羅テストをテーブル駆動で安価に維持できる
- E2E が正常系中心 + wiring smoke のみに絞られるため、ルール追加で E2E が肥大化しない
- jsdom / RTL / MSW を入れないことで「コンポーネントテストがフレーキーで CI を落とす」問題を構造的に回避できる
- Playwright `webServer` でバックエンド起動を自動化することで、開発者が手動でサーバを起動する手間が無くなる
- 採用しないものを明示することで、将来「テストカバレッジを上げるため」に jsdom / MSW / スナップショットが安易に導入されるドリフトを防げる

### Negative

- 「画面描画のリグレッション」を単体テスト層で検知できないため、E2E で初めて気付く構造になる (E2E の実行時間に依存)
- E2E がバックエンド起動を含むため、単体テストに比べてローカル実行・CI 実行ともに時間がかかる
- Playwright のブラウザバイナリ (数百 MB) を `~/.cache` 等にダウンロードする必要があり、CI のキャッシュ設定が前提になる
- 「Zod ルール追加 → 単体テスト追加」は必要だが、「フォーム画面追加 → wiring smoke 1 件追加」を忘れると wiring 検知が抜ける運用リスクが残る

## Alternatives Considered

### A. Jest を採用

**却下理由**: Vite との二重設定 (`jest.config.js` + Babel/SWC + tsconfig 分岐) が必要になり保守コストが上がる。Vite ネイティブの Vitest を採用すれば設定を一本化できる。

### B. Cypress を採用

**却下理由**: ブラウザマトリクスが Chromium ベースに偏る・iframe の取り扱いに癖が強い・Playwright と比べて優位な点が少ない。Playwright は `webServer` 機能・複数ブラウザエンジン対応・並列実行が標準で揃っており、本プロジェクトの要件に合致する。

### C. コンポーネント単体テスト (jsdom + `@testing-library/react`) を導入

**却下理由**: MUI 7 系の CSS-in-JS / DataGrid・Jotai の atom 購読・TanStack Query / Router の絡みで jsdom 経由のテストがフレーキー化しやすい。レンダリングを伴う振る舞い検証は E2E (実 DOM・実ブラウザ) で行う方が信頼性が高く、テスト層を増やすほどメンテ対象が増える。

### D. MSW をフロント単体テストで使う

**却下理由**: コンポーネント描画テストを行わない方針のため、ブラウザ内 fetch をモックする必要が無い。E2E は実バックエンドの `application-mock` プロファイルで賄えるため、MSW を導入する用途が無い。

### E. `MockSalesforceClient` をフロント単体テストで使う

**却下理由**: バックエンドのモック実装にフロントエンドのテストが依存する構造になり、「バックエンドの mock 仕様を変更するとフロントのテストも壊れる」レイヤ間結合を生む。単体テストは描画を伴わないため API モック自体が不要。

### F. Zod 単体テストだけで入力チェックの E2E を完全代替する

**却下理由**: Zod 単体テストはスキーマ仕様の正しさは網羅できるが、以下は検出できない:

- フォームが正しいスキーマを使っているか (resolver の繋ぎ漏れ・別スキーマ参照ミス)
- エラー表示が画面に出るか (zodResolver → React Hook Form → MUI `helperText` の経路)
- どのフィールドにエラーが付くか
- 送信ボタンの活性制御 (`formState.isValid` 連動)

TypeScript + `zodResolver<typeof schema>` で型レベルの保証はある程度効くが、wiring が壊れる経路 (resolver 未指定・別スキーマ取り違え) は型では検知できない。画面ごと wiring smoke 1 件を E2E に残すハイブリッド方式で最小コストで担保する。

### G. E2E でバックエンドを別途手動起動させる運用

**却下理由**: 開発者体験 (毎回 `mvnw spring-boot:run` を別ターミナルで起動) ・CI 運用 (ジョブステップで別途起動・停止の管理が必要) の双方で手順が重い。Playwright `webServer` 機能で自動化できるため不採用。

### H. E2E に異常系を網羅的に含める

**却下理由**: API エラーの分岐網羅はバックエンド Controller テスト (spec 007 優先度 3) で経路保証されており、E2E で再度網羅すると保守コストが二重化する。E2E は正常系の経路保証と「壊れた wiring の早期検知」に絞る。

### I. スナップショットテストを補助的に採用

**却下理由**: MUI 7 系の CSS-in-JS (`emotion` 由来の動的クラス名) や DataGrid の構造変動でスナップショットが容易に壊れる。退行検出力に対し追従コスト (毎リリースごとのスナップショット更新) が過大。

### J. Storybook + interaction tests

**却下理由**: 現状 Storybook は未導入で、本決定のスコープを超える。コンポーネントカタログとしての価値はあるが、テスト戦略の文脈で先行導入する優先度が低い。必要になった時点で別途検討する。

### K. CI (GitHub Actions) を本決定で同時構築

**却下理由**: spec 007 と同じ理由で別途扱う。`.github/workflows/` 未整備・課金 / Secrets 設計・PR 戦略 (必須レビュー設定等) を伴うため、テスト戦略とは別の意思決定軸が必要。

## References

- 関連 Issue:
  - [#6 フロントエンド自動テストとE2E導入を検討する](https://github.com/Satoshi-Tb/forceworkbench-mini/issues/6) (本 ADR の起票元)
  - [#11 入力検証にZod schemaを適用する](https://github.com/Satoshi-Tb/forceworkbench-mini/issues/11) (実装順序の前提)
  - [#26 フロントエンド自動テスト基盤導入とパイロット実装](https://github.com/Satoshi-Tb/forceworkbench-mini/issues/26) (本 ADR に基づく実装 issue)
- 関連スペック: [docs/specs/007-backend-test-policy/spec.md](../specs/007-backend-test-policy/spec.md) (バックエンドテスト方針)
- Vitest 公式: https://vitest.dev/
- Playwright 公式: https://playwright.dev/
- Playwright `webServer`: https://playwright.dev/docs/test-webserver
