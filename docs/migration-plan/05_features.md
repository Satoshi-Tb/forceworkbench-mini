# 機能一覧 (機能カタログ)

`workbench/config/constants.php` の `$GLOBALS["MENUS"]` がすべての画面・機能の正規ソース。
ナビバー上のグループ単位で整理する。

凡例: 🟢=主要機能 / 🔵=支援機能 / ⚪=補助・静的ページ

---

## A. WORKBENCH (ログイン関連)

### A-1. ログイン (`login.php`) 🟢
- **入力**: username/password / sessionId+serverUrl / OAuth / Canvas Signed Request
- **内部 API**: Partner SOAP `login`, OAuth2 `/services/oauth2/token`
- **特記**: `Remember username` Cookie、Org ID Allow/Block、HTTPS 強制
- 移植検討時の中核。

### A-2. ログアウト (`logout.php`)
- WorkbenchContext.release() + `session_destroy()`
- OAuth 経由時は SFDC 側を front-channel logout する iframe を出力する実装

### A-3. Settings (`settings.php`) 🔵
- `defaults.php` の各キーをユーザ毎の Cookie として上書き保存
- "Restore Defaults" でクリア
- 値の min/max・型バリデーション

### A-4. Help / About / Terms / Healthcheck ⚪
- 静的・準静的ページ。`healthcheck.php` は Heroku のヘルスチェック用 200 を返すだけ。

---

## B. Info — 情報照会

### B-1. Standard & Custom Objects (`describe.php`) 🟢
- API: Partner SOAP `describeSObjects`
- ExpandableTree でフィールド・リレーション・レコードタイプを階層表示
- ID/keyPrefix から sObject 種別を推測する `getObjectTypeByKeyPrefixOrId`（DescribeGlobal キャッシュ利用）

### B-2. Metadata Types & Components (`metadataDescribeAndList.php`) 🟢
- API: Metadata SOAP `describeMetadata`, `listMetadata`（フォルダ持ち型は `Folder` から `query` してから listMetadata）
- 親型→子型 (`childXmlNames`) のリンクを HTML で自動生成

### B-3. Session Information (`sessionInfo.php`) 🔵
- UserInfo / Organization / Metadata describe / API バージョン切替
- API バージョン切替時に DescribeSObjects キャッシュを破棄、Default Object の妥当性チェック

---

## C. Queries — クエリ系

### C-1. SOQL Query (`query.php` + `async/QueryFutureTask.php`) 🟢
- **API**: Partner SOAP `query`, `queryAll`, `queryMore`
- **エクスポート先**: screen / matrix（行列ピボット） / csv / async_csv / async_zip
- Parent relationship クエリは設定で禁止可能（`allowParentRelationshipQueries`）
- 既知例外（`MALFORMED_QUERY`, `INVALID_FIELD`, `INVALID_TYPE`, `QUERY_TIMEOUT`, `EXCEEDED_ID_LIMIT`）はハンドリング済
- メモリ閾値超過で QueryMore を中断するセーフガード
- クエリリクエストは `qrjb` パラメータ（base64 JSON）で URL 共有可能
- フロント側（`query.js`）に SOQL ビルダ UI

### C-2. Async SOQL — 一連 🟢
| 画面 | 役割 |
|---|---|
| `asyncSOQL.php` | エントリ |
| `asyncSOQLDefineQuery.php` | クエリ定義フォーム |
| `asyncSOQLDisplayFields.php` | XHR でソース／ターゲット object のフィールド一覧返却 |
| `asyncSOQLSubmitJob.php` | `/services/data/v{X}/async-queries/` への POST 投稿 |
| `asyncSOQLViewStatus.php` | ジョブ一覧表示（XHR ベース） |
| `asyncSOQLViewJobDetails.php` | 個別ジョブ詳細・キャンセル |

REST 経由で実装。

### C-3. SOSL Search (`search.php`) 🟢
- API: Partner SOAP `search`
- 結果を SOSL クエリ補助 UI（10KB の自前画面）で表示

### C-4. Streaming Push Topics (`streaming.php` + `controllers/StreamingController.php`) 🟢
- Push Topic の CRUD は **REST API 経由**で `PushTopic` sObject を操作
- ブラウザは CometD（Dojo の `dojo.js` + `cometd`）で `/cometd/<api>/` を long polling
- ブラウザ ←→ Workbench (`cometdProxy.php` → `util/CometdProxy.php` = `PhpReverseProxy`) ←→ SFDC
- `streamingV2Enabled`, `replayFrom` 対応 (Replay Extension)
- Generic Subscription にも対応

---

## D. Data — DML

### D-1. 単一エントリポイント `put.php` 🟢
`insert.php`/`update.php`/`upsert.php`/`delete.php`/`undelete.php`/`purge.php` は薄いラッパで、
すべて `put.php` の `put($action)` に集約。

サポートする入力経路：
- **Single Record モード** — フォームに直接フィールドを入力
- **CSV / マッピング** — アップロードした CSV のヘッダと sObject フィールドをマッピング
- **ZIP** — Bulk API 用にバイナリ添付付き ZIP をアップロード

実行モード：
- **Sync (Partner SOAP `create/update/upsert/delete/undelete/emptyRecycleBin`)**
- **Async (Bulk API 経由)** — `doAsync` チェック時。Job/Batch を生成し、`asyncStatus.php` で監視
- Hard Delete（`delete` + `doHardDelete` チェック）→ Bulk `hardDelete` (API ≥ 19.0)

補助：
- `csv_preview.php` … アップロード CSV をプレビュー
- `downloadResultsWithData.php` … DML 結果に元データを結合してダウンロード（Sync DML 用）
- `retrieve.php` … 単一 ID の参照

---

## E. Migration — メタデータ移行

### E-1. Deploy (`metadataDeploy.php`) 🟢
- ZIP アップロード → セッションにステージング → 確認画面 → SOAP `deploy(zip, DeployOptions)`
- **DeployOptions**: rollbackOnError / runTests / testLevel / RunSpecifiedTests / 等を構築
- 完了時に `metadataStatus.php?asyncProcessId=...&op=D` へ遷移

### E-2. Retrieve (`metadataRetrieve.php`) 🟢
- 「単一型 + メンバ」または `package.xml` 全体での Retrieve に対応
- SOAP `retrieve(RetrieveRequest)` → 完了後 `metadataStatus.php?op=R` 経由で ZIP DL

### E-3. Status (`metadataStatus.php`) 🔵
- SOAP `checkStatus`, `checkDeployStatus`, `checkRetrieveStatus`
- 完了後の ZIP は `$_SESSION['retrievedZips']` に保持し、別 PHP からダウンロード

---

## F. Utilities

### F-1. REST Explorer (`restExplorer.php` + `controllers/RestExplorerController.php`) 🟢
- 任意 URL × Method × Headers × Body を編集して送信
- バイナリレスポンス（Document/Attachment/StaticResource/ContentVersion/MailmergeTemplate/QuoteDocument の Body）は
  自動で `Content-Disposition: attachment` 添えてストリーミング DL
- `RestResponseInstrumenter` で JSON 内のリンクを `?autoExec=1` 付きクリッカブル化（再帰探索）
- `simpletreemenu` でツリー表示

### F-2. Apex Execute (`execute.php` + `async/ApexExecuteFutureTask.php`) 🟢
- API: Apex SOAP `executeAnonymous` + `setDebugLevels(category, level)`
- DebugLog 表示／コンパイルエラー・例外メッセージ整形

### F-3. Password Management (`pwdMgmt.php`) 🔵
- API: Partner SOAP `setPassword`, `resetPassword`

### F-4. Bulk API Job Status (`asyncStatus.php`) 🔵
- API: Bulk API REST `getJobInfo`, `getBatchInfos`
- 各バッチの結果ダウンロードリンクを生成

### F-5. Download Bulk API Batch (`downloadAsyncBatch.php`) 🔵
- Bulk API のリクエスト/結果を直接 DL

### F-6. Download DML Results (`downloadResultsWithData.php`) 🔵
- 同期 DML 実行結果を CSV で DL

### F-7. CSV Preview (`csv_preview.php`) 🔵
- DML フォームのアップロード CSV プレビュー

### F-8. Jump To SFDC (`jumpToSfdc.php`) 🔵
- ID から SFDC UI の `https://<host>/<id>` URL に転送
- `frontdoor.jsp?sid=<sid>` で UI セッションを発行（オプション）

### F-9. CometD Proxy (`cometdProxy.php` → `util/CometdProxy.php`) 🟦
- ブラウザ ↔ SFDC Streaming のリバースプロキシ。CSRF token を検証して通す。

### F-10. Future Get (`future_get.php`) 🟦
- ブラウザの XHR (`future_ajax.js.php`) が結果を取りに来るエンドポイント

---

## G. 画面横断機能（フッタ・共通）

- ID リンク: 設定 `linkIdToUi` が true の時、応答中の 15/18 桁 ID を SFDC UI へリンク化
- ID Actions ホバーメニュー: 設定 `showIdActionsHover` で各 ID にメニュー（View / Edit / Describe / Retrieve など）
- Auto Refresh: 非同期処理の Status ページに meta refresh 自動挿入
- Request Time 表示: `displayRequestTime` 設定で footer に処理時間を出す
- 多言語タイムゾーン変換: `convertTimezone` + `localeDateTimeFormat`
- メモリ閾値ガード: クエリ大量取得時の中断
- API バージョン切替: 全画面共通で `sessionInfo.php` へ
