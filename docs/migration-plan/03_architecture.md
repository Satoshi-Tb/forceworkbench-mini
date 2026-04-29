# アーキテクチャ

## 1. リクエストフロー全体像

```
ブラウザ (Form POST / GET)
   │
   ▼
Apache + PHP-FPM
   │
   │ 1) 各 *.php エントリ (login.php, query.php, ... )
   │ 2) 必ず最初に require_once 'session.php'
   │       └─ require 'config/constants.php' / 'WorkbenchConfig.php' / 'shared.php'
   │       └─ session_start()  (Redis ハンドラを差し込む可能性あり)
   │       └─ WorkbenchContext を establish/復元
   │       └─ CSRF 検証、HTTPS 強制、ログイン要否チェック
   │
   ▼
WorkbenchContext (= $_SESSION["WORKBENCH_CONTEXT"])
   │
   │ ConnectionConfiguration (sessionId, host, apiVersion, clientId)
   │ Cache: PartnerConnectionProvider, MetadataConnectionProvider,
   │        ApexConnectionProvider, AsyncBulkConnectionProvider,
   │        RestDataConnectionProvider, UserInfoProvider,
   │        DescribeGlobalProvider, DescribeSObjectsProvider,
   │        SfdcVersionsProvider
   │
   ▼
SOAP / REST / Bulk クライアント   ←→  Salesforce
```

## 2. `workbench/` 直下の主要エントリ

`workbench/config/constants.php#$GLOBALS["MENUS"]` が **画面=エントリ=機能** の定義表になっている。
`select.php` から「画面遷移先」を選ぶ UI も同テーブルから生成される。

| グルーピング | エントリ PHP | 役割 |
|---|---|---|
| WORKBENCH | `index.php` | `login.php` への 302 リダイレクト |
|  | `login.php` + `controllers/LoginController.php` | 標準/詳細/OAuth 各方式のログイン |
|  | `select.php` | 「Object × Action」の組合せ画面遷移ハブ |
|  | `settings.php` | ユーザ毎の Cookie 設定 / Restore Defaults |
|  | `logout.php` | セッション破棄 |
|  | `help.php`, `about.php`, `terms.php`, `healthcheck.php` | 静的/補助ページ |
| Info | `describe.php` | sObject の describe を ExpandableTree で表示 |
|  | `metadataDescribeAndList.php` | Metadata 型/コンポーネントの一覧（フォルダ走査も） |
|  | `sessionInfo.php` | UserInfo / Org / Metadata 概要 / API Version 切替 |
| Queries | `query.php` + `async/QueryFutureTask.php` | SOQL エクスプローラ。CSV エクスポート / Matrix 集計 |
|  | `asyncSOQL.php` 一連 | Async SOQL ジョブ定義・送信・状態確認 |
|  | `search.php` | SOSL 検索 |
|  | `streaming.php` + `controllers/StreamingController.php` | Push Topic / Generic Subscription 管理＋CometD 受信 |
| Data (DML) | `retrieve.php` | レコード参照 |
|  | `insert.php` / `update.php` / `upsert.php` / `delete.php` / `undelete.php` / `purge.php` | すべて `put.php` （57 KB の中央 DML 処理）にディスパッチ |
|  | `csv_preview.php` | アップロード CSV のプレビュー |
| Migration | `metadataDeploy.php` | metadata.zip のステージング → deploy |
|  | `metadataRetrieve.php` | package.xml ベース / 単一型ベース両対応の retrieve |
|  | `metadataStatus.php` | deploy / retrieve の非同期 ID 監視・成果物 ZIP DL |
| Utilities | `restExplorer.php` + `controllers/RestExplorerController.php` | URL/Method/Body を直接編集する REST 実行画面 |
|  | `execute.php` + `async/ApexExecuteFutureTask.php` | Anonymous Apex 実行＋Debug log 表示 |
|  | `pwdMgmt.php` | setPassword / resetPassword |
|  | `asyncStatus.php` | Bulk API ジョブ／バッチの状態監視 |
|  | `downloadAsyncBatch.php` / `downloadResultsWithData.php` | Bulk API リクエスト/結果のダウンロード |
|  | `jumpToSfdc.php` | レコード ID から SFDC UI へジャンプ |
|  | `cometdProxy.php` → `util/CometdProxy.php`（PhpReverseProxy 利用） | Streaming のリバースプロキシ |
|  | `future_get.php` | 非同期ジョブの結果ポーリング受け |

## 3. `workbench/context/` — 接続ハンドル管理

- `WorkbenchContext` … `$_SESSION` に保持される **コンテキストの実体**
  - `ConnectionConfiguration`（host, sessionId, apiVersion, clientId）
  - 各 API 用の `*ConnectionProvider`（Partner / Metadata / Apex / Bulk / REST data）
  - キャッシュ可能な値プロバイダ（`UserInfo`, `DescribeGlobal`, `DescribeSObjects`, `SfdcVersions`）
  - Default Object（画面間で引き回す対象 sObject）, Idle 時の死活確認
- Provider 共通基底: `AbstractConnectionProvider`, `AbstractSoapConnectionProvider`
- `CacheableValueProvider` … `$_REQUEST` レベルの軽キャッシュ

## 4. `workbench/controllers/`

| クラス | 役割 |
|---|---|
| `LoginController` | UI/Advanced/OAuth/SignedRequest の４経路ログイン制御 |
| `RestExplorerController` | REST 実行画面の状態保持（メソッド・URL・ヘッダ・ボディ）、バイナリレスポンスの自動添付ダウンロード化 |
| `RestResponseInstrumenter` | JSON レスポンスのリンク化・整形 |
| `StreamingController` | Push Topic CRUD（REST 経由で `PushTopic` sObject を操作）、CometD 設定 JSON 生成 |

## 5. `workbench/async/` — 非同期処理基盤

`workbench/async/futures.php` の `FutureTask` 抽象クラスが核。

- `FutureTask::enqueue()` — Redis キー `FUTURE_TASK_REQUESTS` に `crypto_serialize($this)` を RPUSH。
  - 別途 `FUTURE_LOCK<asyncId>` に `session_id` を `SETEX` し、
    結果の所有者照合と GC タイムアウトを兼ねる。
- `FutureTask::dequeue($timeout)` — `BLPOP`（CLI ワーカーのみ呼出可）
- `FutureResult::redeem()` — 結果をシリアライズして `FUTURE_RESULT<asyncId>` にプッシュ
- `FutureResult::ajax()` — `future_ajax.js.php` を出力。ブラウザは `future_get.php` を XHR で叩いて結果回収
- Redis が無ければ `enqueueOrPerform()` が同期実行にフォールバック

具体タスク：
- `QueryFutureTask` — SOQL クエリ実行（Matrix・CSV エクスポート対応）
- `ApexExecuteFutureTask` — `executeAnonymous` 呼び出し
- `RestExplorerFutureTask` — REST 実行（バイナリ DL 時は同期側で完結）

ワーカー起動：`workbench/async_worker.php`（`async_workers.sh` が複数 fork）。

## 6. `workbench/util/`

| ファイル | 役割 |
|---|---|
| `ExpandableTree` | 8KB 程度の自前ツリー UI。describe / sessionInfo / metadata 一覧で再利用 |
| `PhpReverseProxy` / `CometdProxy` | Streaming API への HTTP リバースプロキシ |
| `RedisSessionHandler` | `SessionHandlerInterface` 実装。`SETEX` で TTL=1h |
| `ErrorLogging` | エラーロギングユーティリティ |
| `asyncSOQLViewJobDetails` | Async SOQL ジョブ状態 HTML 生成 |

## 7. 共通 UI ビルディングブロック (`shared.php` / `header.php` / `footer.php`)

- `printSelectOptions`, `printObjectSelection`, `displayError`, `displayInfo`
- ID 値の `addLinksToIds`（ID から SFDC UI / WB 機能へのリンク生成）
- メニュー描画は `header.php` が `$GLOBALS["MENUS"]` を走査して生成
- ロギング：`workbenchLog($level, $type, $msg)` でアクセス毎に key=value 形式で stderr/syslog 出力（Heroku Logplex 互換）
