# 別言語移植のための論点メモ

## 1. 全体移植 vs. 部分移植

このアプリは「Salesforce 全 API の Web GUI」という巨大な集合体。
**部分移植（特定機能だけ）** を前提に整理する。
依存度の高い箇所から順に並べる。

| 機能 | 依存性 | 移植難度 | 備考 |
|---|---|---|---|
| ログイン (Partner SOAP) | 中央依存。これが無いと他は動かない | 中 | OAuth Web Server Flow なら REST だけで完結し、低難度 |
| SOQL Query (`query.php`) | Partner SOAP `query`/`queryMore` に依存 | 中 | REST `/query` で代替可。代替後は SOAP 不要 |
| SOSL Search | Partner SOAP `search` | 中 | REST `/search` で代替可 |
| DML (`put.php`) | Partner SOAP + Bulk API | **高** | Sync は REST Composite で代替、Async は Bulk API v2 推奨 |
| REST Explorer | curl ラッパ + 認証 | **低** | 純粋 HTTP 中継。最も移植しやすい |
| Apex Execute | Apex SOAP `executeAnonymous` | 中 | REST Tooling API `/executeAnonymous` で代替可 |
| Streaming | CometD プロキシ | 高 | CometD 互換ライブラリ要。`replayId` 対応必要 |
| Async SOQL | REST のみ | 低 | URL を直接叩くだけ |
| Metadata Deploy/Retrieve | Metadata SOAP | **高** | 公式の代替 REST API は v54+ にあるが機能差あり。SOAP 維持が無難 |
| describe / metadataDescribeAndList | SOAP / REST | 中 | REST `/sobjects/{type}/describe` で代替可 |
| Bulk Job Status / Batch DL | Bulk API v1 | 中 | Bulk API v2 に切り替えるなら全面書直し |

## 2. 言語選択時の主要懸念

### 2-1. SOAP の取扱い
- 本実装は PHP 標準の `SoapClient` に **WSDL を直接食わせている**だけで、独自 SOAP スタックは持っていない
- 移植先で同等のことをする選択肢:
  - **Java**: JAX-WS / wsimport（公式 Salesforce Partner WSDL は wsimport で OK）
  - **C#/.NET**: WCF (`svcutil` / Connected Service for Salesforce)
  - **Go / Rust**: SOAP ライブラリが薄いので、必要メソッドだけ手書き XML が現実的
  - **Node.js / TypeScript**: `strong-soap` / `easy-soap-request`、もしくは REST API への置換を推奨
  - **Python**: `zeep`（成熟しており第一候補）
- 同梱 WSDL バージョンが多数ある（v8.0 ~ v66.0）。
  運用ポリシーを確認し、サポートする最新 1 ~ 数バージョンに絞ることを推奨。

### 2-2. Bulk API クライアント
- 本実装は curl で XML を組立てる古典実装。Bulk API v1 のみ対応。
- 移植時は **Bulk API 2.0 (REST/JSON)** に置換するのが今後の運用上有利
  （HardDelete のみ v1 でしか使えない点に注意）。

### 2-3. 非同期処理基盤
- Redis BLPOP ベースのワーカーキュー。これは **「長時間 SOAP/REST 呼び出しを Web リクエストから切り離す」** ための仕組み。
- 移植先で代替候補:
  - Java: Spring + Quartz / Sidekiq 系 / SQS
  - C#: Hangfire / Hosted Service
  - Node.js: BullMQ
  - Go: 自前ゴルーチン + Redis Stream / NATS
- "FUTURE_LOCK" による所有者照合 (session_id 比較) と TTL ベース GC の発想は移植先でも踏襲推奨。

### 2-4. セッション / 状態保持
- 本実装は **PHP セッション ($_SESSION) に巨大なオブジェクト** を入れている：
  - `WorkbenchContext`（接続設定 + 各 API クライアントキャッシュ）
  - 直近の `QueryRequest`、`RestExplorerController`、CSV プレビュー、Retrieve 済 ZIP 等
- 移植先では「セッションに重い接続オブジェクトを入れる」設計は **しない**こと推奨。
  - 接続は毎リクエストでステートレスに再構築（特に SOAP は WSDL ロードが重いので、起動時 1 回で再利用）
  - 状態は { sessionId, instanceUrl, apiVersion, userInfo } 程度の軽量 DTO に絞る

### 2-5. CSRF
- `md5(secret + session_id + script_name)` の単純実装。
- 移植先のフレームワーク標準 CSRF 機構に置換する方が安全（HMAC-SHA256, double-submit cookie 等）。

### 2-6. フロントエンド
- jQuery + 旧 Dojo CometD + 自前 JS。**SPA ではなくサーバーサイドレンダ**。
- 移植時の方針候補:
  - サーバ側で同様に HTML を返す（テンプレートエンジン置換だけで済む）
  - 完全に React/Vue + REST バックエンドへ刷新する（最もコストは高いが成果は大きい）

## 3. 「特定機能を移植したい」場合の最小コアとして抽出すべきもの

ユーザの目的に応じ、以下の単位で切り出すと再利用しやすい。

### 3-1. 「ログインだけ別言語化したい」
必要なもの:
- OAuth 2.0 Web Server Flow ハンドラ（`LoginController::oauthRedirect` / `oauthProcessLogin`）
- `ConnectionConfiguration::fromUrl()` 相当の DTO 構築
- Org ID Allow/Block list 判定
- Canvas signed_request 検証（HMAC-SHA256）

### 3-2. 「SOQL/REST Explorer だけ移植したい」
必要なもの:
- `RestClient.php`（curl ラッパ）相当の HTTP クライアント
- `RestExplorerController`（メソッド・ヘッダ・ボディ・URL の状態保持）
- `RestResponseInstrumenter`（応答 JSON のリンク化）
- バイナリ Body 自動 DL の判定ロジック (`prepareBinaryResponseAsDownload`)

### 3-3. 「Bulk DML だけ移植したい」
必要なもの:
- `BulkApiClient.php` 全体（XML/CSV/ZIP 構築、Job/Batch ライフサイクル）
- `JobInfo`, `BatchInfo` の値オブジェクト
- `put.php` の CSV / フィールドマップ → Bulk Job 変換ロジック
- `asyncStatus.php` のポーリング UI ロジック
- ※ 推奨は Bulk API 2.0 への置換

### 3-4. 「Metadata Deploy/Retrieve だけ移植したい」
必要なもの:
- `SforceMetadataClient.php` の SOAP メソッド集
- `metadataDeploy.php` の `DeployOptions` 組立 + ZIP ステージング
- `metadataRetrieve.php` の `RetrieveRequest` 組立（package.xml / 単一型両対応）
- `metadataStatus.php` の checkXxxStatus + ZIP 受信処理

### 3-5. 「Streaming / CometD だけ移植したい」
必要なもの:
- `PhpReverseProxy` / `CometdProxy` のリバースプロキシ機能
- `StreamingController` の Push Topic CRUD（REST 経由）
- ブラウザ側 CometD クライアント (Dojo) は移植先では `cometd-nodejs-client` 等を採用検討

## 4. 移植時に必ず確認すべき隠れ仕様

1. **`crypto_serialize` / `crypto_unserialize` の鍵管理**
   - `shared.php` 内（未読セクションあり）。`ext-sodium` で実装されているはず。
   - 既存の Redis に格納された値との互換性が要るかどうかをユーザに確認。新規移植なら気にせず再構築可。

2. **`callOptions_client` (User-Agent / partner client id)**
   - SOAP 呼び出し時の `CallOptions.client` ヘッダ。WB のデフォルトは `getWorkbenchUserAgent()`。
   - Salesforce Partner Program で個別 ID 取得済みなら差し替えが必要。

3. **同梱 WSDL の更新ポリシー**
   - 移植先で SOAP を採用する場合、WSDL のバージョンアップを保守する責務が発生する。
   - REST ベースに振るほどメンテナンスコストは下がる。

4. **API バージョン後方互換**
   - WB は v8.0 まで遡れる設計。普通の業務移植では「現行 v60.0 以降のみ」「テナント既定 1 バージョンのみ」と絞ってよい。

5. **HTTP ヘッダで実装している機能**
   - `Sforce-*`, `OAuth` 認証スキーム、`X-PrettyPrint`, `Content-Disposition` 自動セット 等
   - 移植先 HTTP ライブラリで同等の制御が可能か確認。

6. **Heroku 依存表現**
   - `HTTP_X_REQUEST_ID`, `HTTP_X_REQUEST_START`, `HTTP_X_FORWARDED_FOR`
   - ログ key=value 形式は Heroku Logplex 想定。移植先の運用基盤に合わせて変更。

7. **`asyncTimeoutSeconds` (35 分)**
   - 大型 Query / Bulk 結果のロングポーリングを支える前提。移植先の Web サーバ・ロードバランサのタイムアウトと整合確認。

## 5. 移植プロジェクトの推奨ステップ

1. **対象機能を最大 1 ～ 2 個に絞る**（目的が「特定機能を別言語に」なので最重要）
2. その機能が依存する Salesforce API を**REST API に寄せる**設計に書き直す
   （SOAP のまま再現するメリットは少ない。維持コストが下がる）
3. 認証は **OAuth 2.0 のみ**にし、Username/Password / Session ID 直接設定は省略を検討
4. 状態は最小限の DTO（accessToken, instanceUrl, apiVersion, userId, orgId）に圧縮
5. 非同期処理は移植先言語のジョブキュー（or サーバレス）標準を採用
6. UI は要件に応じて **新規 SPA 実装** を推奨（既存 jQuery 系 UI の移植は工数対効果が悪い）
