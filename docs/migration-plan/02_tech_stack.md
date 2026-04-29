# 技術スタック

## 1. 言語 / ランタイム

| 区分 | 内容 |
|---|---|
| 言語 | **PHP 8.4 系**（`composer.json` の `"php": "~8.4.0"`） |
| Web SAPI | Apache + PHP-FPM (`Procfile`: `vendor/bin/heroku-php-apache2 -F fpm_custom.conf workbench`) |
| CLI | 非同期ワーカー (`workbench/async_worker.php`) は `php_sapi_name() == 'cli'` を強制 |

## 2. PHP 拡張モジュール

`composer.json` で必須宣言：

- `ext-soap` — Partner / Metadata / Apex API は **PHP 内蔵 SoapClient** を直接利用
- `ext-curl` — REST / Bulk / OAuth トークンエンドポイントへの HTTP は **libcurl 直叩き**
- `ext-redis` — セッション保管／非同期ジョブキュー
- `ext-sodium` — `crypto_serialize` / `crypto_unserialize` でセッションIDを保護
- `extension_loaded('openssl')` … SSL ハンドシェイク

## 3. 主要ライブラリ / フロントエンド

### サーバ依存
- `sentry/sentry: ^4.0` … エラー収集（`composer.json`）
- 他フレームワークは **不採用**。すべて生 PHP（フレームワークレス、`require_once` ベース）。

### フロント（`workbench/static/script` 配下に同梱されたファイルを直接 `<script>` で読込）
- jQuery / jQuery UI（旧版同梱）
- CometD（`static-unversioned/script/dojo/`） … Streaming API クライアント
- 自前 JS：`query.js`, `restexplorer.js`, `streamingClient.js`, `paging.js`, `simpletreemenu.js` 等
- 旧来の HTML / `<form>` ベース。SPA ではない。

## 4. データストア

- **Redis** — セッション (`util/RedisSessionHandler.php`) と FutureTask の RPUSH/BLPOP キュー
- **その他 RDBMS は不使用**。Salesforce 側が事実上の永続層となる。

## 5. SOAP / REST クライアント実装

| 種別 | パス | 概要 |
|---|---|---|
| Partner SOAP | `workbench/soapclient/SforcePartnerClient.php` | 旧 PHP Toolkit を埋め込んでいる。`SforceBaseClient` を継承 |
| Metadata SOAP | `workbench/soapclient/SforceMetadataClient.php` | `describeMetadata`, `listMetadata`, `deploy`, `retrieve`, `checkStatus` 等 |
| Apex SOAP | `workbench/soapclient/SforceApexClient.php` | `executeAnonymous`, `setDebugLevels` |
| REST | `workbench/restclient/RestClient.php` | curl ラッパー（HEAD/GET/POST/PUT/PATCH/DELETE） |
| Bulk API | `workbench/bulkclient/BulkApiClient.php` | curl ベース。XML/CSV/ZIP_CSV/ZIP_XML を自前生成 |
| Streaming(CometD) | `workbench/util/CometdProxy.php` + `cometdProxy.php` | ブラウザ ←→ Workbench ←→ Salesforce のリバースプロキシ |
| Async SOQL | `workbench/asyncSOQL*.php`, `workbench/util/asyncSOQLViewJobDetails.php` | REST ベース (`/services/data/v{X}/async-queries/...`) |

## 6. 同梱 WSDL

`workbench/soapclient/sforce.{80..660}.{partner|metadata|apex}.wsdl`

- API バージョン v8.0 ～ v66.0 の **Partner WSDL** と、v11.0 以降の **Metadata / Apex WSDL** を網羅
- WSDL ファイル自体は SoapClient のコンストラクタへ直接渡されるだけで、DTO 生成等はしていない

## 7. 設定 (Configuration)

- 既定値: `workbench/config/defaults.php`（30 KB 超の巨大配列。User設定可能項目はSettings画面で表示）
- 上書き: `workbench/config/overrides.php`（運営者がデプロイ時に書く）
- 環境変数: `forceworkbench__<key>__default` 形式で上書き（`WorkbenchConfig.php` の `$_ENV` ループ）
- ユーザ単位: ブラウザの **Cookie** に各設定値を保存（"overrideable" フラグ true のみ）

## 8. セキュリティ機構

- CSRF: `csrfSecret` + `session_id` + `SCRIPT_NAME` の MD5 ハッシュ（`shared.php#getCsrfToken`）
  - GET 以外は `validateCsrfToken()` を `session.php` で強制
- セッション: HttpOnly cookie、Redis 永続化、`session_regenerate_id` をログイン直後に実行
- HTTPS: `requireSSL` / `redirectToHTTPS` 設定で強制（Heroku `app.json` で既定 true）
- ホスト制限: `LoginController::isAllowedHost` が `salesforce.com` / `cloudforce.com` / `vpod.t.force.com` だけ許可
- Org ID Allow/Block list: `LoginController::processLogin` で 15 文字 ID 比較
- DOCTYPE 拒否: `disallowDoctype()` で SOAP/XML 応答の XXE 対策
- Path info 拒否: `session.php` で `PATH_INFO` 付きアクセスを 400
- X-Frame-Options: `SAMEORIGIN`（`workbench/.htaccess`）
