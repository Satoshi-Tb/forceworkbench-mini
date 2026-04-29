# 09. 実装プラン: forceworkbench 照会機能 → Java Spring Boot + React 移植

## Context

`docs/migration-plan/08_migration_plan.md` で確定済みの移植計画に基づき、`forceworkbench-mini` リポジトリで Salesforce 照会ツール (Login / SOQL Query / Describe のみ) を 0 から構築する。現状 `backend/` `frontend/` は `.gitkeep` のみで実装は皆無。`work/reference/` に PHP Workbench (v66.0) の参照実装、`docs/migration-plan/` に確定済み計画書がある。

新しい設計判断はしない。計画書を実装順序へ落とし込み、**モックモードを先に立ち上げて UI を回せる状態を作ってから、実 SOAP に進む**。Karpathy 4 原則 (最小限・依頼範囲のみ・投機的追加禁止) を全フェーズで遵守する。

## 全体方針

- **テストコードは全フェーズで生成しない**。後続検討事項とし、本プランの対象外
- フェーズ 1 のあと、ログイン→トップページ表示の **シンプルなフロント+バック疎通確認 (フェーズ 2)** を必ず挟み、本格的な API スケルトン構築 (フェーズ 3) に進む
- モックモード優先。フェーズ 6 で初めて WSC / 実 SOAP に着手

## マイルストーン線引き

- **フェーズ 2 完了 = 最小疎通確認**: ログインしてホームが表示できる、フロント+バック両方が動く最小状態
- **フェーズ 5 完了 = MVP デモ**: モックモードで全シナリオ (SOQL Query / Describe / CSV) が回り、レビュー可能
- **フェーズ 6 完了 = 実環境 SF 疎通**: real profile で実組織と疎通
- **フェーズ 8 完了 = 配布可能**: `docker compose up` 1 発で起動

## フェーズ間チェックポイント

- **CP-A (フェーズ 1 冒頭)**: `com.force.api:force-wsc` の Maven 取得経路を最初に確認 (Central / GitHub / `mvn install:install-file` のどれか) し、結論を `README.md` に 1 行記録。実装はフェーズ 6 まで遅延
- **CP-B (フェーズ 5 → 6 境界)**: ユーザーから「Integration User の credential / Developer Edition 組織 / `SF_LOGIN_URL` が用意できた」確認を得るまでフェーズ 6 着手しない

---

## フェーズ 1: 基盤雛形 (ビルド可能化)

**成果物**: `mvn spring-boot:run` と `npm run dev` がそれぞれ起動し、`/api/*` が Vite proxy 経由で 8080 へ届く。エンドポイントはまだ無い。

**作成ファイル**:

- ルート: `.gitignore` 追記 (`backend/target/`, `frontend/node_modules/`, `frontend/dist/`, `frontend/src/routeTree.gen.ts`, `**/application-local.properties`, `.env`), `.env.example`, `README.md` (起動手順 + WSC 入手結論)
- `backend/pom.xml` (Spring Boot 3 + starter-web / starter-validation の最小。starter-security / starter-cache はフェーズ 3 で追加、WSC はフェーズ 6 で追加)
- `backend/mvnw`, `backend/mvnw.cmd`, `backend/.mvn/wrapper/maven-wrapper.properties`
- `backend/src/main/java/com/example/sfqry/Application.java` (`@SpringBootApplication` のみ)
- `backend/src/main/resources/application.properties` (`spring.profiles.active=mock` のみ)
- `frontend/package.json` (react / react-dom / vite / @vitejs/plugin-react / typescript の最小。TanStack Router/Query, MUI, DataGrid はフェーズ 3 で追加)
- `frontend/vite.config.ts` (proxy `/api -> http://localhost:8080`)
- `frontend/tsconfig.json`, `frontend/tsconfig.node.json` (strict)
- `frontend/index.html`, `frontend/src/main.tsx` (`<div>Hello</div>` のみ)
- `frontend/eslint.config.js` (最小)

**完了条件**:

- `cd backend && ./mvnw spring-boot:run` で 8080 起動
- `cd frontend && npm install && npm run dev` で 5173 起動 → "Hello" 表示
- `curl http://localhost:5173/api/me` が 8080 に proxy され 404 返却 (proxy 動作確認)
- `README.md` に WSC 入手結論が 1 行記載

---

## フェーズ 2: ログイン → トップページ表示の疎通確認

**成果物**: フロントの最小ログインフォーム → 成功するとトップページが表示され、ログアウトでフォームに戻る、最小エンドツーエンド動作。Spring Security / TanStack Router / MUI などの本格採用は次フェーズに送る。

**作成ファイル** (backend, 最小):

- `backend/src/main/java/com/example/sfqry/auth/AppLoginController.java` (POST `/api/login`, request body の email / password を `application.properties` の固定値と `MessageDigest.isEqual` で比較。成功時に HttpSession 属性 `userInfo` を固定値でセット、200 返却。失敗時 401)
- `backend/src/main/java/com/example/sfqry/auth/AppLogoutController.java` (POST `/api/logout`, HttpSession invalidate)
- `backend/src/main/java/com/example/sfqry/auth/MeController.java` (GET `/api/me`, HttpSession に `userInfo` があれば返す、無ければ 401)
- `backend/src/main/resources/application.properties` 追記 (`app.login.email=test@example.com`, `app.login.password=test`)

※ Spring Security は **このフェーズでは入れない**。HttpSession を自前管理し、starter-web のみで実装。CSRF / Cookie 属性詰めはフェーズ 3 以降で行う。

**作成ファイル** (frontend, 最小):

- `frontend/src/main.tsx` (React state ベースで「未ログインならフォーム / ログイン済みならホーム」を切替。**TanStack Router / MUI は使わない**。素の `<form>` + `fetch`)
- `frontend/src/api/client.ts` (`fetch` 最小ラッパ。`credentials: 'include'`)
- `frontend/src/api/auth.ts` (`login(email, password)`, `logout()`, `me()`)

**完了条件 (手動シナリオ)**:

1. `npm run dev` (5173) と `mvn spring-boot:run` (8080) を同時起動
2. ブラウザで `http://localhost:5173/` を開くと、`/api/me` が 401 のため最小ログインフォームが表示される
3. 固定 email / password (`test@example.com` / `test`) を入力 → ログイン成功 → 「ようこそ」相当の最小トップページに遷移し、`/api/me` の UserInfo が表示される
4. 誤った資格でログイン失敗 → エラーメッセージ表示
5. ログアウトボタンでフォームに戻る
6. ブラウザを再読み込みしても、HttpSession Cookie が生きていればトップページのまま

**ここで実装したファイルは、フェーズ 3 以降で本格構成に置き換える前提**。`AppLoginController` / `MeController` / `AppLogoutController` は中身が拡張され、`main.tsx` は TanStack Router + ルートファイルへ全面置換される。

---

## フェーズ 3: モックモード骨子 (バックエンド全 API)

**成果物**: `SPRING_PROFILES_ACTIVE=mock` で計画書の全 API エンドポイントが固定レスポンスを返す。SF 接続コードは未着手。

**触るファイル** (Java, 追加 / 拡張):

- `backend/pom.xml` (`spring-boot-starter-security`, `spring-boot-starter-cache` 追加)
- `Application.java` に `@EnableCaching` 追加
- `config/SecurityConfig.java` (`/api/login` 許可、その他は要認証、CSRF, Cookie HttpOnly+SameSite=Lax)
- `config/SalesforceProperties.java` (`@ConfigurationProperties("sf")`, mock では値未使用)
- `auth/SessionContext.java` (`@SessionScope`: sessionId, instanceUrl, userInfo, queryRunId map)
- `auth/AppLoginController.java` (フェーズ 2 の最小実装を拡張: props と email/password を constant-time 比較 → SessionContext に固定 UserInfo)
- `auth/AppLogoutController.java`, `auth/MeController.java` (SessionContext 経由に置換)
- `query/QueryController.java` (POST `/api/query`, GET `/api/query/runs/{id}/next`, POST `/api/query/csv`)
- `query/QueryService.java` (SalesforceClient 経由のみ)
- `query/QueryRequestDto.java`, `QueryResultDto.java`, `QueryRunState.java`
- `describe/DescribeController.java` (GET `/api/describe/global`, `/api/describe/{sobject}`, POST `/api/cache/clear`)
- `describe/DescribeService.java` (`@Cacheable("describe")`)
- `describe/dto/DescribeGlobalDto.java`, `DescribeSObjectDto.java`, `FieldDto.java`, `ChildRelationshipDto.java`
- `common/SalesforceClient.java` (interface)
- `common/MockSalesforceClient.java` (`@Profile("mock") @Service`, resources/mock を読む)
- `common/ApiException.java`, `ErrorAdvice.java` (最小スケルトンのみ)

**作成ファイル** (resources):

- `application-mock.properties` (固定 email / password)
- `mock/me.json`
- `mock/describe-global.json` (Account / Contact / Opportunity)
- `mock/describe/{Account,Contact,Opportunity}.json`
- `mock/query/account-page-1.csv` (`Id,Name,Type,Industry,CreatedDate`, 計画書 244-249 行準拠)
- `mock/query/account-page-2.csv`
- `mock/query/contact-basic.csv` (`Id,FirstName,LastName,Email,AccountId`)

**参照**: `work/reference/workbench/controllers/LoginController.php` (login 構造), `context/WorkbenchContext.php` (SessionContext 項目選定), `query.php` (CSV 返却枠組み)

**完了条件**:

- `curl -i http://localhost:8080/api/me` が 401
- `POST /api/login` が 200 + Cookie 発行
- `GET /api/me` が UserInfo
- `POST /api/query` で `SELECT Id, Name FROM Account LIMIT 10` → queryRunId + columns + rows
- `GET /api/query/runs/{id}/next` で page-2
- `GET /api/describe/Account` を 2 回呼んで 2 回目はキャッシュヒット (ログ確認)

---

## フェーズ 4: フロント骨子 (UI シェル + API クライアント)

**成果物**: TanStack Router で `/login` `/query` `/describe` `/describe/$sobject` が描画され、未認証は `/login` redirect。フェーズ 2 の最小実装はここで全面置換。

**触るファイル**:

- `frontend/package.json` (TanStack Router/Query, MUI, MUI X DataGrid, @emotion/* 追加)
- `frontend/src/main.tsx` (createRouter + RouterProvider + QueryClientProvider + ThemeProvider に置換)
- `src/theme.ts` (MUI 既定)
- `src/routes/__root.tsx` (`beforeLoad` で `/api/me` 検査、未認証は `/login` redirect, ナビヘッダ)
- `src/routes/index.tsx` (`/` → `/query`)
- `src/routes/login.tsx` (MUI フォーム email + password)
- `src/routes/query.tsx` (素のテキストエリア + Run + DataGrid + 次のページ + CSV DL。**Monaco は入れない**)
- `src/routes/describe/index.tsx`, `describe/$sobject.tsx`
- `src/api/client.ts` (フェーズ 2 から拡張: CSRF double-submit, 401 → `/login` redirect)
- `src/api/auth.ts` (拡張), `query.ts`, `describe.ts` (新規)
- `src/components/ResultGrid.tsx` (DataGrid ラッパ, renderCell は id/string/datetime のみ)
- `src/components/ObjectPicker.tsx`, `FieldTable.tsx`
- `src/hooks/useDescribeGlobal.ts`, `useDescribeSObject.ts`, `useRunSoql.ts`

**参照**: `work/reference/workbench/login.php`, `query.php`, `describe.php` (画面項目選定)

**完了条件**:

- `npm run dev` + mock backend 同時起動でブラウザ確認
- `http://localhost:5173` → `/login` redirect → mock 固定資格でログイン → `/query` 遷移
- `npm run lint` / `npm run build` (tsc strict) エラーなし

---

## フェーズ 5: モック E2E 動作確認 (= MVP デモ完成)

**成果物**: 内部レビューに出せる状態。**新規ファイル原則なし**、フェーズ 3/4 のバグ修正のみ。

**手動シナリオ**:

1. ログイン → `/query` 遷移
2. `SELECT Id, Name FROM Account LIMIT 10` → DataGrid 表示
3. 次のページボタン → page-2 表示
4. CSV ダウンロード → Blob 取得
5. `/describe` で 3 オブジェクト表示
6. Account 選択 → フィールド + 子リレーション表示
7. 同じ Account を再度開いてキャッシュ動作 (Network タブで確認)
8. ログアウト → `/login`

**チェックポイント CP-B**: ユーザーから実 SF 疎通の前提が揃ったことの確認を待つ。

---

## フェーズ 6: 実 SOAP 実装 (real profile)

**成果物**: real profile で本物の SF 組織に対しフェーズ 5 シナリオが通る。

**触るファイル**:

- `backend/pom.xml` (`com.force.api:force-wsc:<version>` 有効化, CP-A 調査結果に従う。Central で取れない場合は `mvn install:install-file` 手順を `README.md` に記載)
- `config/PartnerConnectionFactory.java` (sessionId + instanceUrl から `PartnerConnection` 生成)
- `common/SoapSalesforceClient.java` (`@Profile("!mock") @Service`: login / query / queryMore / describeGlobal / describeSObject / exportCsv (StreamingResponseBody + queryMore ループ))
- `auth/AppLoginController.java` (real 分岐: props 一致 → SOAP `login(props.username, props.password + props.securityToken)` → SessionContext 格納 → `getServerTimestamp` で接続確認)
- `application.properties` (`sf.username` / `sf.password` / `sf.security-token` / `sf.login-url` / `sf.api-version` キー、値は env 上書き)

**参照**: `work/reference/workbench/controllers/LoginController.php#processLogin` (login シーケンス), `context/ConnectionConfiguration.php` (DTO), `async/QueryFutureTask.php` (query/queryMore/done 制御, parent relationship 制限), `context/DescribeGlobalProvider.php`, `DescribeSObjectsProvider.php`, `soapclient/sforce.650.partner.wsdl`

**完了条件**:

- `SF_USERNAME=... SF_PASSWORD=... SF_SECURITY_TOKEN=...` (default profile = real) で起動
- 実資格でログイン → `/api/me` が本物 UserInfo
- 大量 Account に対して queryMore が done まで回り CSV 全件ストリーミング
- 同 describe を 2 回呼んで SOAP 1 回 (ログ確認)

---

## フェーズ 7: エラー / 監査ログ / セキュリティ詰め

**成果物**: 既知 SF エラー整形、Logback 監査ログ、Cookie / CSRF / .gitignore 確定。

**触るファイル**:

- `common/ApiException.java` (`MALFORMED_QUERY` / `INVALID_FIELD` / `INVALID_SESSION_ID` / `QUERY_TIMEOUT` の 4 種)
- `common/ErrorAdvice.java` (4xx/5xx 整形, `INVALID_SESSION_ID` は 401)
- `auth/AppLoginController.java` (監査ログ: email + 時刻)
- `query/QueryService.java` (監査ログ: email + SOQL)
- `backend/src/main/resources/logback-spring.xml` (audit logger, password / sessionId / SOAP `<password>` マスク)
- `config/SecurityConfig.java` (Cookie 確認, HTTPS 時 Secure)
- `frontend/src/api/client.ts` (4xx JSON エラー正規化)
- `frontend/src/routes/query.tsx` (エラーバナー)

**参照**: `work/reference/workbench/async/QueryFutureTask.php` (既知エラーメッセージ), `controllers/LoginController.php` (監査項目)

**完了条件**:

- `SELECT Id FROM NotExistObject` でエラーバナー表示
- セッション切れで `/login` 自動遷移
- Logback に email + SOQL、password / sessionId 出力なし (目視)
- DevTools で Cookie HttpOnly + SameSite=Lax
- `git status` で `application-local.properties` が ignored

---

## フェーズ 8: Docker / 本番ビルド (= 配布可能)

**成果物**: `docker compose up` で `localhost:8080`、React は同一オリジン配信。

**作成ファイル**:

- `Dockerfile` (マルチステージ: Node `npm run build` → Maven `frontend/dist` を `backend/src/main/resources/static/` にコピーして `mvn package` → Runtime JRE + jar)
- `compose.yaml` (1 サービス `app`, `ports: 8080:8080`, `env_file: .env`)
- `.dockerignore`
- `backend/src/main/java/com/example/sfqry/config/SpaForwardingConfig.java` (`/api/**` と `/assets/**` 以外を `index.html` フォワード)

**完了条件**:

- `docker compose build` 成功
- `docker compose up` で `http://localhost:8080/` → React 表示
- `http://localhost:8080/login` 直アクセスでも React 起動 (SPA フォワード)
- `.env` 空 → mock profile で起動
- `.env` に SF 情報 → real profile で実 SF 接続

---

## 全フェーズで触らない / やらない

- **テストコード (ユニット / vitest / Playwright E2E) は本プランの対象外**。後続検討
- `work/reference/**` は READ ONLY
- `docs/migration-plan/**` は確定済、実装中は変更しない
- `08_migration_plan.md` 507-520 行の「最初は省略する項目」(OAuth / Bulk 2.0 / スキーマグラフ / 保存クエリ / Explain / 多言語化 / Monaco 補完 / 多組織 / 利用者ごと SF 認証) は MVP では実装しない
- 更新系 (insert/update/upsert/delete/undelete/purge), Metadata, Bulk, Streaming, Apex Execute, REST Explorer は移植対象外

## Critical Files

- `docs/migration-plan/08_migration_plan.md` (確定済み計画書、全フェーズの根拠)
- `backend/pom.xml` (フェーズ 1, 3, 6: 依存追加点)
- `backend/src/main/java/com/example/sfqry/auth/AppLoginController.java` (フェーズ 2 最小→3 拡張→6 SOAP 分岐の中心)
- `backend/src/main/java/com/example/sfqry/common/SalesforceClient.java` (フェーズ 3: real/mock 切替の interface)
- `frontend/src/main.tsx` (フェーズ 1 → 2 → 4 で段階的に置換)
- `frontend/src/routes/__root.tsx` (フェーズ 4: 認証ガードの中心)
- `Dockerfile` (フェーズ 8: 配布の中心)

## Verification (フェーズ横断)

- フェーズ 1: `mvn spring-boot:run` + `npm run dev` 同時起動と Vite proxy 動作
- フェーズ 2: ブラウザでログイン → トップ表示 → ログアウトの最小フロー (= 最小疎通線)
- フェーズ 3: 全 API エンドポイントを `curl` で疎通
- フェーズ 5: モック E2E 8 シナリオを手動でブラウザ確認 (= MVP 線)
- フェーズ 6: 実 SF 組織で同じシナリオを実施 (= 実疎通線)
- フェーズ 8: `docker compose up` での同一オリジン動作と SPA 直アクセス (= 配布線)
