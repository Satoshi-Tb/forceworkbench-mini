# 移植計画: Workbench 照会機能 → Java Spring Boot + React 版

## Context (背景・目的)

`forceworkbench` (PHP 8.4 製) の **照会系機能だけ** を別言語スタックに移植して、
「**MySQL Workbench 風の Salesforce 照会ツール**」として再構築する。

- 移植元: `C:\home\dev_ai\forceworkbench\workbench\` (PHP, 生 PHP, Workbench v66.0)
- 移植目的: 照会機能の充実化。Workbench は Maintenance Only Mode で UI / 体験面の改善が止まっているため、
  自前ツールで「クエリ発行 / 表形式表示 / オブジェクト定義確認」を強化する
- スコープ:
  - 残す: **ログイン / SOQL Query / describe**
  - 落とす: 更新系 (insert/update/upsert/delete/undelete/purge)、Metadata、Bulk、Streaming、Apex Execute、REST Explorer
- 利用形態: **個人・少人数チーム（開発関係者）向けローカルツール**。Docker Compose で 1 本に固める想定

## 認証方式 (確定)

ハイブリッド: **アプリレベル認証 (簡易) + Integration User による Salesforce 接続 (固定)**

### 仕組み

- Salesforce 接続用の Integration User の username / password / securityToken / loginUrl は、
  バックエンドの `application.properties` (or 環境変数) に格納
- 利用者は React のログイン画面で **email + password** を入力
- Spring Boot が `application.properties` の `sf.username` / `sf.password` と一致するか確認
  - 一致しなければ 401
- 一致したら **同じ認証情報で Partner SOAP `login()` を実行** し、sessionId を取得
- sessionId と instanceUrl は HTTP セッションに格納、HttpOnly Cookie で React と紐付け
- 以降の API 呼出はその sessionId を SOAP の `<SessionHeader>` に詰めて使用

### `application.properties` の項目

```properties
sf.username=integration-user@example.com
sf.password=<password>
sf.security-token=<optional>
sf.login-url=https://login.salesforce.com    # または test.salesforce.com
sf.api-version=65.0
```

※ password / token は **環境変数で上書き**できるようにし、git 管理から外す前提
※ Spring Boot の `@ConfigurationProperties` で `SalesforceProperties` クラスにバインド

### 注意点

1. **Integration User の権限**: 利用者全員が Integration User の権限でデータを見る。本来見えてはいけないオブジェクトもアクセス可能になる可能性があるため、社内の参照ポリシーを事前確認すること
2. **利用者識別の限界**: 利用者識別は厳密な本人特定ではなく、少人数チーム内での簡易利用記録を目的とする。SF 側の監査ログには Integration User しか残らない。本アプリ側では、ログイン画面で入力された email と操作内容を Logback に記録する
3. **Security Token**: 信頼 IP 外からのアクセスでは token が必要。**フォーム上は password のみを入力させる**設計とし、サーバ側で `props.password + props.securityToken` を結合してから SOAP login に送る。利用者は token を意識しない
4. **同時セッション数の上限**: SF はユーザあたり同時セッションを制限 (組織設定により 5 等)。少人数チーム前提なので問題ないが、既存バッチと並列稼働時は注意。本アプリ側で sessionId を HTTP セッションごとに 1 つ持つ素直な設計とする
5. **password 比較**: `MessageDigest.isEqual()` で **constant-time comparison** を使い、タイミング攻撃を回避

### Salesforce API 方針

対象環境では **SOAP API のみ利用可能** なため、SOQL Query / describe は Partner SOAP API で実装する。
REST API への置換は行わない。

API バージョンは、現在利用している環境に合わせて **v65.0** を初期値とする。
MVP では UI 上の API バージョン切替機能は持たせず、`sf.api-version` または環境変数で変更可能にする。
将来のバージョンアップ時は設定値を変更し、README に検証済み API バージョンを明記する。

## 確定した技術スタック

### バックエンド

- **Java 21 + Spring Boot 3 系**
- **Maven** — ビルドツール (`pom.xml` ベース)。Gradle ではなく Maven を採用
- **Salesforce WSC (`force-wsc`)** — Partner SOAP クライアント
  - Maven Central の最新版がない時期があるため、`com.force.api:force-wsc` の取得経路を最初に確定させる
  - 取得不可なら GitHub から自前ビルドして `mvn install:install-file` でローカルリポジトリに登録
- **Spring Cache (simple in-memory `ConcurrentMapCache`)** — describe キャッシュ。`@EnableCaching` + `@Cacheable("describe")` だけで導入。外部コンテナ不要
- **Spring Session (in-memory)** — sessionId / instanceUrl / userInfo を HTTP セッションに保持
- **Spring Security** — フォームログイン (アプリレベル認証) と CSRF / セッション管理
- ロギング: Logback。利用者の email とアクセス内容を行レベルで記録

### フロントエンド

- **React 18 + TypeScript + Vite**
- **TanStack Router (ファイルベースルーティング)** — `src/routes/` 配下にファイルを置く構成。型安全な route params
- **TanStack Query** — API 呼出 / キャッシュ / 再取得 (TanStack Router と同作者・同思想で連携が綺麗)
- **MUI (Material UI)** — 全体 UI
- **MUI X DataGrid (Community)** — 結果テーブル、仮想スクロール、列幅調整、ソート、フィルタ等の Community 範囲で実装。列固定・高度な集計・Pro 機能は将来改善で検討
- **Monaco Editor** — SOQL エディタ（最初は素のテキストエリアでも可、補完は段階的に後付け）

## 移植スコープと参考にする既存実装

### 1. ログイン機能

| 項目             | 参考にする既存ファイル                                   | メモ                                                                                                   |
| ---------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| ログイン UI      | `workbench/login.php`                                    | Standard モード相当を素朴化。フィールドは email / password のみ                                        |
| ログイン処理本体 | `workbench/controllers/LoginController.php#processLogin` | password 比較 → SOAP login → sessionId 取得 → 接続テスト (`getServerTimestamp`) → 監査ログの流れを踏襲 |
| 接続情報 DTO     | `workbench/context/ConnectionConfiguration.php`          | `sessionId / isSecure / host / apiVersion` を保持。Java 側でも同じ抽象を作る                           |
| 接続コンテキスト | `workbench/context/WorkbenchContext.php`                 | Spring SessionScope Bean に最小情報のみ持たせる (sessionId, instanceUrl, apiVersion, userInfo)         |
| WSDL             | `workbench/soapclient/sforce.650.partner.wsdl`           | 現在利用中の v65.0 を初期採用。WSC は同等 WSDL から型生成済                                           |

### 2. SOQL Query 機能

| 項目                 | 参考にする既存ファイル                                                        | メモ                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| クエリ実行ロジック   | `workbench/async/QueryFutureTask.php`                                         | `query / queryAll / queryMore` の使い分け、parent relationship 制限、既知例外 (MALFORMED_QUERY 等) ハンドリング |
| クエリリクエスト DTO | `workbench/soxl/QueryObjects.php` (`QueryRequest`, `QueryRequestFilter`)      | フィルタ・ソート・LIMIT などのフォームモデル。今回は SOQL 直接入力中心なので軽量化可                            |
| ページング           | `QueryFutureTask.php#query` 内の `queryResponse->done` / `queryLocator`       | queryLocator はサーバ側 HTTP セッションで保持し、React には queryRunId のみ返す設計に置換                       |
| CSV エクスポート     | `workbench/query.php` の `export_action == csv` 分岐                          | バックエンドで `StreamingResponseBody` + queryMore ループを使い、メモリに乗せず流す                             |
| 既知エラー処理       | `QueryFutureTask.php` の `MALFORMED_QUERY / INVALID_FIELD / QUERY_TIMEOUT` 等 | Java 側でも同等メッセージで `WorkbenchHandledException` 相当を返却                                              |

### 3. Describe 機能

| 項目             | 参考にする既存ファイル                                                                     | メモ                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| オブジェクト一覧 | `workbench/context/DescribeGlobalProvider.php` (および `WorkbenchContext::describeGlobal`) | describeGlobal で取得、カスタム/標準フィルタ・名前検索を React 側で実装 |
| sObject 詳細     | `workbench/describe.php` + `DescribeSObjectsProvider.php`                                  | フィールド・子リレーションを取得。レコードタイプ / レイアウトは見送り   |
| ID prefix 推定   | `WorkbenchContext::getObjectTypeByKeyPrefixOrId`                                           | 「ID をペーストしたら sObject を推定」する補助機能として再現可          |

## バックエンド構成案

```
backend/
├─ pom.xml                                 Maven ビルド定義 (Spring Boot 3, force-wsc, spring-cache, spring-security)
├─ mvnw / mvnw.cmd                         Maven Wrapper (チームでビルド環境を揃える)
└─ src/main/java/com/example/sfqry/
   ├─ Application.java                    @SpringBootApplication, @EnableCaching
   ├─ config/
   │   ├─ SecurityConfig.java             Spring Security: form login, CSRF, session
   │   ├─ SalesforceProperties.java       @ConfigurationProperties("sf"): username/password/token/login-url/api-version
   │   └─ PartnerConnectionFactory.java   sessionId を渡して PartnerConnection を生成 (per request/session)
   ├─ auth/
   │   ├─ AppLoginController.java         POST /api/login (email, password)
   │   │                                    1) props と一致確認 (constant-time)
   │   │                                    2) SOAP login (props.username, props.password + props.token)
   │   │                                    3) sessionContext に sessionId/instanceUrl 格納
   │   ├─ AppLogoutController.java        POST /api/logout
   │   ├─ MeController.java               GET /api/me — UserInfo
   │   └─ SessionContext.java             @SessionScope Bean
   ├─ query/
   │   ├─ QueryController.java            POST /api/query, GET /api/query/runs/{queryRunId}/next, POST /api/query/csv (stream)
   │   ├─ QueryService.java               PartnerConnection.query / queryMore
   │   ├─ QueryRequestDto.java            soql, batchSize, queryAll
   │   ├─ QueryRunState.java              session 内で queryRunId -> queryLocator/soql/createdAt/rowCount を保持
   │   └─ QueryResultDto.java             queryRunId?, columns[], rows[], totalSize, done
   ├─ describe/
   │   ├─ DescribeController.java         GET /api/describe/global, GET /api/describe/{sobject}
   │   ├─ DescribeService.java            @Cacheable("describe")
   │   └─ dto/                            DescribeGlobalDto, DescribeSObjectDto, FieldDto, ChildRelationshipDto
   └─ common/
       ├─ ApiException.java               既知 SF エラーを統一レスポンスに
       └─ ErrorAdvice.java                @ControllerAdvice で 4xx/5xx 整形
```

### `pom.xml` の主要 dependency

- `org.springframework.boot:spring-boot-starter-web`
- `org.springframework.boot:spring-boot-starter-security`
- `org.springframework.boot:spring-boot-starter-cache`
- `org.springframework.boot:spring-boot-starter-validation`
- `com.force.api:force-wsc:<latest>` (取得不可なら自前ビルドしてローカルにインストール)
- `org.springframework.boot:spring-boot-starter-test` (test scope)

## リポジトリ / Docker 構成案

リポジトリは **モノレポ** とし、バックエンド、フロントエンド、Docker 関連ファイルを 1 リポジトリにまとめる。
MVP では「clone → `.env` 設定 → Docker Compose で起動」までを 1 リポジトリで完結させる。

推奨構成:

```
repo-root/
├─ backend/
│  ├─ pom.xml
│  ├─ mvnw
│  ├─ mvnw.cmd
│  └─ src/
├─ frontend/
│  ├─ package.json
│  ├─ vite.config.ts
│  └─ src/
├─ docs/
│  └─ migration-plan/               現 work/ 配下の移植計画ドキュメント一式
├─ work/
│  └─ reference/                    現 work/ 配下のドキュメントを除く、現 forceworkbench 配下の参照用リソース一式
├─ Dockerfile
├─ compose.yaml
├─ .env.example
├─ .gitignore
└─ README.md
```

`docs/migration-plan/` には、本リポジトリの現 `work/` フォルダ配下にある
Workbench 調査結果、移植メモ、レビュー指摘、移植計画ドキュメント一式を移管する。

`work/reference/` には、参照専用として現 forceworkbench 配下のリソースを格納する。
ただし現 `work/` 配下の移植計画ドキュメントは `docs/migration-plan/` へ移すため、
`work/reference/` には含めない。

`work/` は参照用作業領域として扱い、`.gitignore` で全体を無視対象にする。
移植先アプリ本体と移植計画ドキュメントは `backend/`、`frontend/`、`docs/migration-plan/` で管理する。

### 実行時の構成

本番 / MVP 配布用の Docker イメージは **Spring Boot の 1 コンテナ** とする。
React は Vite の通常ビルドで静的ファイル化し、Spring Boot の静的配信ディレクトリへ同梱する。

ビルド時:

```text
Node.js stage
  frontend を npm run build
  -> frontend/dist を生成

Maven/JDK stage
  frontend/dist を backend/src/main/resources/static へコピー
  mvn package
  -> Spring Boot jar を生成

Runtime stage
  JRE ベースイメージに jar だけを配置
  java -jar app.jar
```

実行時:

```text
Spring Boot
  /api/**      -> Java API
  /            -> React index.html
  /assets/**   -> React JS/CSS
```

このため、アプリを起動するサーバー / 最終 Docker イメージには Node.js は不要。
Node.js は Docker build 中の frontend build stage でのみ利用する。

### Docker Compose

MVP 配布用の `compose.yaml` は 1 サービス構成を基本とする。

```yaml
services:
  app:
    build: .
    ports:
      - "8080:8080"
    env_file:
      - .env
```

`.env.example` には Salesforce 接続情報とアプリ設定を定義する。
実シークレットを含む `.env` や `application-local.properties` は git 管理しない。

```properties
SF_USERNAME=integration-user@example.com
SF_PASSWORD=
SF_SECURITY_TOKEN=
SF_LOGIN_URL=https://login.salesforce.com
SF_API_VERSION=65.0
```

### 開発時の起動

開発時はフロントエンドとバックエンドを個別に起動する。

```text
frontend: npm run dev        -> http://localhost:5173
backend:  mvnw spring-boot:run -> http://localhost:8080
```

React 側の API 呼び出しは本番と同じく相対パス `/api/...` に統一する。
開発時は Vite dev server の proxy で `/api` を Spring Boot へ転送する。

`frontend/vite.config.ts` の例:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
```

この方式では、開発時も React からは同一オリジンの `/api/...` を呼ぶ形になり、
Spring Boot 側で開発用 CORS 設定を広げる必要がない。

### SPA ルーティング対応

React Router / TanStack Router の SPA ルーティングを使うため、
本番配信時は `/api/**` と静的アセット以外のパスを `index.html` にフォワードする。

例:

```text
/login
/query
/describe
/describe/Account
```

上記のような画面 URL へブラウザから直接アクセスしても React が起動できるようにする。

## フロントエンド構成案

```
src/
├─ main.tsx                            createRouter + RouterProvider, QueryClientProvider, ThemeProvider
├─ routeTree.gen.ts                    TanStack Router の自動生成 (gitignore 推奨)
├─ routes/                             ★ ファイルベースルーティング
│   ├─ __root.tsx                      ルートレイアウト (MUI Theme, ナビ, 認証ガード)
│   ├─ index.tsx                       / — トップ (認証時はクエリ画面へリダイレクト)
│   ├─ login.tsx                       /login — MUI フォーム (email + password)
│   ├─ query.tsx                       /query — Monaco エディタ + Run + DataGrid + queryMore + CSV DL
│   └─ describe/
│       ├─ index.tsx                   /describe — 左ペイン: オブジェクトリスト
│       └─ $sobject.tsx                /describe/$sobject — 右ペイン: フィールド/子リレーション
├─ api/
│   ├─ client.ts                       fetch wrapper, CSRF, 401 -> /login redirect
│   ├─ auth.ts                         login / logout / me
│   ├─ query.ts                        query / queryMore / csv stream URL
│   └─ describe.ts                     describeGlobal / describe(sobject)
├─ components/
│   ├─ ResultGrid.tsx                  MUI X DataGrid ラッパ。型に応じたセル表示
│   ├─ ObjectPicker.tsx                describeGlobal をリスト/オートコンプリート表示
│   └─ FieldTable.tsx                  describeSObject のフィールドテーブル (型・長さ・picklist)
└─ hooks/
    ├─ useDescribeGlobal.ts            useQuery({ queryKey: ['describe','global'], queryFn })
    ├─ useDescribeSObject.ts           useQuery({ queryKey: ['describe', name], queryFn })
    └─ useRunSoql.ts                   useMutation で POST /api/query → queryRunId を state 保持
```

### TanStack Router + Query 連携のポイント

- `createRouter({ context: { queryClient } })` で route loader からキャッシュを共有
- 認証ガードは `__root.tsx` の `beforeLoad` で `/api/me` を検査し、未ログインなら `/login` に redirect
- ルートの `loader` で describeGlobal を prefetch すると初期表示が滑らか

## API 設計 (FE ↔ BE)

| メソッド | パス                                      | 用途                                                                                         |
| -------- | ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| POST     | `/api/login`                              | email/password を受け取り props 比較 → SOAP login。Cookie にセッション ID を発行             |
| POST     | `/api/logout`                             | サーバセッション破棄                                                                         |
| GET      | `/api/me`                                 | UserInfo (org/user) 返却。React の起動時の認証状態確認                                       |
| POST     | `/api/query`                              | `{ soql, queryAll }` を受け取り 1 ページ分の結果と `queryRunId` を返す                       |
| GET      | `/api/query/runs/{queryRunId}/next`       | サーバ側に保持した queryLocator で queryMore の続きを返す                                    |
| POST     | `/api/query/csv`                          | `{ soql, queryAll }` を受け取り、text/csv で全件ストリーミング DL                             |
| GET      | `/api/describe/global`                    | Cache 経由で describeGlobal                                                                  |
| GET      | `/api/describe/{sobject}`                 | Cache 経由で describeSObject                                                                 |
| POST     | `/api/cache/clear`                        | キャッシュ手動再読込ボタン用                                                                 |

query paging は Salesforce の `queryLocator` を React に直接返さない。
Spring Boot の HTTP セッション内で `queryRunId -> queryLocator` を保持し、
React は `queryRunId` のみを持つ。

サーバ側保持データ:

```text
queryRunId -> {
  soql,
  queryLocator,
  createdAt,
  lastAccessedAt,
  rowCount
}
```

CSV エクスポートは GET クエリ文字列に SOQL を載せず、POST body で受け取る。
React 側では `fetch` で `POST /api/query/csv` を呼び、レスポンスを Blob 化してダウンロードする。
大量 CSV、再試行、非同期エクスポートが必要になった場合のみ、将来 `POST /api/query/exports` と
`GET /api/query/exports/{exportId}/download` へ拡張する。

レスポンス DTO 設計のポイント:

- `QueryResultDto.columns` は **describe で得た型情報をマージしたメタ列**（name, label, type, scale, picklistValues 等）。
  React 側は型に応じて DataGrid のカラム描画 (`renderCell`) を切替
- ネスト (親リレーション) は `Account.Name` のような **平坦化キー**で 1 セル化
- サブクエリは結果が多いので **「N 件」リンクで別ペイン展開**（Workbench 同様）
- AggregateResult は `expr0/expr1...` をエイリアス変換しないでそのまま見せる

## 「シンプル実装」のために最初は省略する項目

将来追加候補。最初の MVP では入れない:

- OAuth (Web Server Flow / PKCE)
- Bulk API 2.0 query (50k 件超対応)
- スキーマグラフ (ER 図)
- 保存クエリ・履歴永続化
- Explain Plan
- 多言語化・タイムゾーン変換 (画面は UTC 表示で開始、後付け)
- Monaco の SOQL 補完 (まずはハイライトだけ、describe ベース補完は後)
- 多組織同時ログイン (1 組織 = props 固定)
- 利用者ごとの SF 認証情報切替 (= パターン X)

## セキュリティ要点

- **password の constant-time 比較**: `java.security.MessageDigest.isEqual(byte[], byte[])` を使用
- **Cookie**: HttpOnly + SameSite=Lax (HTTPS 環境では Secure も)
- **CSRF**: Spring Security の CSRF を有効化、React は double-submit cookie
- **`application.properties` への password 直書き禁止**: 環境変数で上書きする運用にし、`application-local.properties` を `.gitignore` に追加
- **password を絶対にログに残さない**: SOAP リクエストのデバッグログでも `<password>***</password>` でマスク
- **sessionId は HTTP レスポンスボディに出さない**: Cookie 経由のみ
- **CORS**: 本番は同一オリジン配信。開発時も Vite proxy で `/api` を Spring Boot へ転送し、原則として Spring Boot 側の CORS 許可は広げない
- **アプリ側監査ログ**: 厳密な本人特定ではなく簡易利用記録として、ログイン画面で入力された email、時刻、SOQL を最低限 Logback で残す

## Verification (動作確認手順)

1. **ユニットテスト (バックエンド)**
   - `AppLoginController` の正常系/異常系: props と一致 / 不一致 / SF 接続失敗
   - `QueryService` を WSC のモック (Mockito) で検証: queryMore チェーンが done になるまで回ること
   - `DescribeService` の Spring Cache 動作: 同じ引数で 2 回呼ぶと SOAP 1 回しか走らないこと
   - password 比較が constant-time であることの単体確認

2. **結合テスト (Salesforce Developer Edition で手動)**
   - DE 組織に Integration User を作成、`application.properties` に投入 → アプリ起動
   - 正しい email + password でログイン成功 → `/api/me` が UserInfo を返す
   - 誤った email or password で 401
   - `SELECT Id, Name FROM Account LIMIT 10` 実行 → DataGrid に 10 行表示
   - `SELECT Id, Name FROM Account` (大量) 実行 → 1 ページ表示 + queryRunId 経由の queryMore で次ページ
   - CSV エクスポート → `POST /api/query/csv` でファイルが queryMore により全件含むこと
   - describe 画面で `Account` 選択 → フィールド一覧 + 子リレーション (`Contacts`, `Opportunities` 等) 表示
   - 同じ describe を 2 回開いてレスポンスが速くなること (キャッシュ動作確認)

3. **E2E テスト (任意)**
   - Playwright でログイン → クエリ実行 → 結果検証 → describe 画面遷移までを 1 シナリオ

4. **ローカル起動**
   - `docker compose up` で Spring Boot + Vite を 1 コマンド起動
   - 開発時は Vite dev サーバ (`localhost:5173`) → Spring Boot (`localhost:8080`) に Vite proxy 経由
   - 本番ビルド時は React を `dist/` → Spring Boot の `static/` に配置して同一オリジンで配信

## 移植リスク・要注意事項

1. **WSC の Maven 取得**: Maven Central に最新版が無い時期がある。Salesforce GitHub からの自前ビルド or 代替の取得経路を **プロジェクト最初に確定**させる
2. **Integration User の MFA 影響**: SOAP login が通らない場合は Connected App + OAuth が必要。エラーメッセージで案内する
3. **Salesforce API バージョン更新**: MVP の初期値は現在利用中の v65.0。半年に 1 回 Spring/Summer/Winter リリースがあるため、WSDL 同梱と検証済みバージョンの更新ポリシーを README に明記
4. **describe の応答サイズ**: 巨大組織では Account の describe が 5MB 超になることがある。Spring の HTTP メッセージサイズ上限を引き上げる必要があり得る
5. **queryLocator の TTL**: 約 2 日で失効する。queryLocator はサーバ側で保持し、失効時は React 側で再クエリ誘導を実装
6. **Integration User の権限スコープ**: チームポリシーとして「このツール経由で見える範囲」を事前合意する

## 重要ファイル一覧 (実装時に参照)

実装時に開く既存コード:

- `workbench/controllers/LoginController.php` … Login Controller の挙動
- `workbench/context/WorkbenchContext.php` … セッションスコープ Bean のモデル
- `workbench/context/ConnectionConfiguration.php` … 接続 DTO のモデル
- `workbench/async/QueryFutureTask.php` … query/queryMore ロジック、既知エラーリスト
- `workbench/query.php` … クエリフォーム / エクスポート分岐
- `workbench/soxl/QueryObjects.php` … QueryRequest DTO
- `workbench/describe.php` … describe 表示の項目選定
- `workbench/context/DescribeSObjectsProvider.php` … describeSObjects のキャッシュ実装
- `workbench/context/DescribeGlobalProvider.php` … describeGlobal の使い方
- `workbench/soapclient/sforce.650.partner.wsdl` … Partner WSDL v65.0

調査済みドキュメント (このリポジトリ内):

- `work/01_overview.md`, `work/02_tech_stack.md`, `work/03_architecture.md`,
  `work/04_auth_and_session.md`, `work/05_features.md`, `work/06_salesforce_apis.md`,
  `work/07_porting_notes.md`
