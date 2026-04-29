# 利用している Salesforce API 一覧

機能を別言語へ移植する際の最小コア。各機能ごとの API コール経路をまとめる。

## 1. Partner SOAP API
- WSDL: `workbench/soapclient/sforce.{version}.partner.wsdl`
- ラッパ: `SforcePartnerClient` (extends `SforceBaseClient`)
- 利用箇所:
  - 認証: `login(username, password)` / `LoginScopeHeader(orgId, portalId)`
  - 接続検証: `getServerTimestamp()`
  - DML: `create`, `update`, `upsert`, `delete`, `undelete`, `emptyRecycleBin`, `merge`, `convertLead`
  - クエリ: `query`, `queryAll`, `queryMore`, `search`
  - Describe: `describeGlobal`, `describeSObjects`, `describeLayout`, `describeTabs`, `describeDataCategoryGroupStructures` 等
  - その他: `retrieve(fieldList, sObjectType, ids[])`, `getUserInfo`, `setPassword`, `resetPassword`, `sendEmail`, `process`, `invalidateSessions`, `logout`
- ヘッダ多数 (`SforceHeaderOptions.php`):
  - CallOptions, AssignmentRuleHeader, MruHeader, QueryOptions, EmailHeader,
    AllOrNoneHeader, AllowFieldTruncationHeader, DisableFeedTrackingHeader,
    OwnerChangeOptionsHeader, UserTerritoryDeleteHeader, LocaleOptions,
    PackageVersionHeader, LoginScopeHeader

## 2. Metadata SOAP API
- WSDL: `sforce.{version}.metadata.wsdl`
- ラッパ: `SforceMetadataClient` (extends `SoapBaseClient`)
- 利用 API:
  - `describeMetadata(asOfVersion)`
  - `listMetadata(type, folder, asOfVersion)`
  - `deploy(zipBytes, DeployOptions)` / `checkDeployStatus(asyncProcessId, includeDetails)`
  - `retrieve(RetrieveRequest)` / `checkRetrieveStatus(asyncProcessId, includeZip)`
  - `checkStatus(asyncProcessId)`

## 3. Apex SOAP API
- WSDL: `sforce.{version}.apex.wsdl`
- ラッパ: `SforceApexClient`
- 利用 API:
  - `executeAnonymous(apexCode)` （`DebuggingHeader` で `setDebugLevels(category, level)` 同梱）

## 4. REST API
- ラッパ: `RestClient.php`（curl 直叩き）
- 認証: `Authorization: OAuth <sessionId>` ヘッダで Partner セッション流用
- 利用: REST Explorer / Streaming コントローラの PushTopic CRUD / Async SOQL ジョブ操作
- バイナリレスポンスは `expectBinary=true` で curl の `RETURNTRANSFER=0` に切替

## 5. Bulk API (1.0 / 旧 Async API)
- ラッパ: `BulkApiClient.php`（curl + 自前 XML/CSV 構築）
- ベース URL: Partner エンドポイントを `/services/Soap/u/{ver}/...` → `/services/async/{ver}` に変換
- 機能:
  - createJob / updateJob / updateJobState / getJobInfo
  - createBatch / getBatchInfo / getBatchInfos / getBatchRequest
  - getBatchResults / getBatchResultStream
- ContentType: CSV / XML / ZIP_CSV / ZIP_XML
- API バージョン別の機能制限を `validateJob` 内で明示

## 6. Streaming API (CometD)
- WB はあくまで HTTP リバースプロキシとして仲介:
  - `workbench/cometdProxy.php` → `workbench/util/CometdProxy.php`(`PhpReverseProxy` を継承)
  - 上流 URL: `https://<sfdcHost>/cometd/<apiVersion>/`
- ブラウザ側で Dojo CometD クライアント + ReplayExt が動作
- Push Topic / Generic Subscription / Replay 対応

## 7. Async SOQL (REST)
- エンドポイント: `/services/data/v{X}/async-queries`
- 利用: `RestExplorerController::getInstanceForAsyncSOQL()` を再利用してジョブ送信／状態取得／キャンセル

## 8. OAuth 2.0
- Web Server Flow: `/services/oauth2/authorize` → `code` → `/services/oauth2/token`
- Canvas: `signed_request` の HMAC-SHA256 検証

## 9. その他外部 URL
- `frontdoor.jsp?sid=<sid>` … `linkIdToUi` 機能で SFDC UI セッション発行
- `na1.salesforce.com`, `login.salesforce.com`, `test.salesforce.com`, `prerellogin.pre.salesforce.com` …
  ホスト判定（`LoginController::isAllowedHost`）
