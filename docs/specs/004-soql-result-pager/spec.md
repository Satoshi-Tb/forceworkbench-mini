# SOQL 結果ページャー: OFFSET 限定 + クライアント側ページング方式

## 背景・目的

現状の SOQL 結果画面は「次のページ」のみで前ページに戻れない。Salesforce SOAP API の `queryMore()` は使い捨ての `queryLocator` を返す前進専用 API のため、API 単体で前ページを取得することはできない。「過去ページをサーバ/クライアントに保持して戻る」案も検討したが、運用方針として以下を採用する。

- 取得結果は最大 2,000 件 (Salesforce SOQL の `LIMIT` 上限) に揃える。
- その 2,000 件をフロントに一括返却し、MUI DataGrid のクライアントサイドページングで前後移動させる。
- 2,000 件を超える結果セットは 2,000 件で打ち切り、「条件を絞り込んでください」と警告を表示する。
- CSV エクスポートのみ全件取得を維持する。

これにより `queryMore` 経由のサーバ側ページング状態 (queryLocator・queryRunId・SessionContext.queryRuns) は UI ページングからは完全に不要となり、前後移動はフロントの DataGrid に閉じる。CSV は内部実装で従来どおり `PartnerConnection.queryMore()` を直接叩いて全件取得する。

## 成功基準

- `/query` 画面で、結果グリッドの前後ページ移動が DataGrid 標準のページャーで可能になる。
- 取得結果が 2,000 件を超えた場合、画面上部に警告バナーが表示される (取得分の 2,000 件はそのまま DataGrid に表示)。
- 「次のページ」ボタンと関連 API/状態 (`queryRunId`, `done`, `queryRuns`) が画面・コード両面から削除されている。
- CSV エクスポートは従来どおり 2,000 件超でも全件ダウンロードできる。
- `cd backend && .\mvnw.cmd -B test` が通る。
- `cd frontend && npm run lint && npm run format && npm run build` が通る。

## 方針

| 項目 | 内容 |
|---|---|
| 1 リクエスト最大件数 | 2,000 件 (SOQL `LIMIT` 上限と一致) |
| 取得方式 | `sf.query-batch-size = 2000` を強制し、初回 `query()` 一発で取得 |
| 超過検知 | 初回 `query()` の `QueryResult.isDone()` が `false` なら超過 |
| 超過時 UI | DataGrid に 2,000 件表示 + `<Alert severity="warning">` で告知 |
| ページ移動 | MUI DataGrid 標準のクライアントサイドページング (デフォルト 25 行/ページ、`pageSizeOptions=[25,50,100]`) |
| CSV | 既存どおり全件取得 (`SoapSalesforceClient.exportCsv()` 内で `conn.queryMore()` を直接呼ぶ) |

## 影響ファイル

### バックエンド (削除)

- `backend/src/main/java/com/example/sfqry/query/QueryRunState.java` … record まるごと削除

### バックエンド (修正)

- `backend/src/main/java/com/example/sfqry/query/QueryResultDto.java`
  - `String queryRunId` と `boolean done` を削除
  - `boolean truncated` を追加 (2,000 件で打ち切られたか)
- `backend/src/main/java/com/example/sfqry/query/QueryController.java`
  - `GET /runs/{id}/next` エンドポイントを削除
- `backend/src/main/java/com/example/sfqry/query/QueryService.java`
  - `queryMore(String runId)` メソッドを削除
- `backend/src/main/java/com/example/sfqry/common/SalesforceClient.java`
  - インターフェースから `QueryResultDto queryMore(String runId)` を削除
- `backend/src/main/java/com/example/sfqry/common/SoapSalesforceClient.java`
  - `queryMore()` 実装と `registerNewRun()` を削除
  - `query()`: バッチサイズを 2000 で強制設定し、`qr.isDone() == false` で `truncated=true` を立てて返す
  - `convertResult()` を `truncated` 受け取りに変更
  - `exportCsv()` は変更不要 (内部で `conn.queryMore()` を直接呼んでいるため)
- `backend/src/main/java/com/example/sfqry/common/MockSalesforceClient.java`
  - `queryMore()` を削除
  - `query()` を 1 リクエスト完結に変更 (Account モックは `truncated=true` を返して警告挙動を再現)
  - `exportCsv()` を Account 用 2 ファイル連結処理に書き換え (現状 `queryMore` 経由で組み立てているため)
- `backend/src/main/java/com/example/sfqry/auth/SessionContext.java`
  - `Map<String, QueryRunState> queryRuns` フィールドと getter を削除
  - `clear()` から `queryRuns.clear()` を削除
- `backend/src/main/resources/application.properties`
  - `sf.query-batch-size` のデフォルトを `2000` 固定 (環境変数で上書き不可、UI 取得上限と一致させる)

### フロントエンド (修正)

- `frontend/src/api/query.ts`
  - `QueryResult` 型から `queryRunId: string | null` と `done: boolean` を削除し、`truncated: boolean` を追加
  - `nextQueryPage()` 関数を削除
- `frontend/src/routes/query.tsx`
  - `nextQueryPage` の import を削除
  - `handleNext()` を削除
  - 「次のページ」ボタンを削除
  - `result.truncated` のとき `<Alert severity="warning">取得結果が 2,000 件で打ち切られました。検索条件を絞り込んで再実行してください。</Alert>` を表示
- `frontend/src/components/ResultGrid.tsx`
  - `<DataGrid>` に以下を追加:
    - `pageSizeOptions={[25, 50, 100]}`
    - `initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}`
  - DataGrid のクライアント側ページングを使用 (MUI 標準動作)

### モックデータ

- `backend/src/main/resources/mock/query/account-page-1.csv` … そのまま使用 (truncated=true 用)
- `backend/src/main/resources/mock/query/account-page-2.csv` … CSV エクスポート時の連結用に残す (Mock の `exportCsv` で参照)

## 削除されるもの一覧 (本方針の副産物)

- `QueryRunState` record
- `SalesforceClient.queryMore` インターフェースメソッド
- `SoapSalesforceClient.queryMore`, `registerNewRun`
- `MockSalesforceClient.queryMore`
- `QueryService.queryMore`
- `QueryController.next` (`GET /api/query/runs/{id}/next`)
- `SessionContext.queryRuns`
- フロント: `nextQueryPage`, `handleNext`, 「次のページ」ボタン, `QueryResult.queryRunId`, `QueryResult.done`

## CSV エクスポートへの影響について

「次のページ」エンドポイントとそれに連なる `SalesforceClient.queryMore` を削除しても、CSV エクスポートには影響しない。経路が独立しているため。

- 削除する経路: `GET /api/query/runs/{id}/next` → `QueryService.queryMore` → `SalesforceClient.queryMore` → `SoapSalesforceClient.queryMore`
- CSV の経路: `POST /api/query/csv` → `QueryService.exportCsv` → `SalesforceClient.exportCsv` → `SoapSalesforceClient.exportCsv` (内部で **Salesforce SDK の `PartnerConnection#queryMore(locator)` を直接呼ぶ**)

`SoapSalesforceClient.exportCsv()` 内の `qr = conn.queryMore(qr.getQueryLocator())` は Salesforce SDK (`com.sforce.soap.partner.PartnerConnection`) のメソッド呼び出しであり、自前の `SalesforceClient.queryMore` インターフェースとは別物。SDK の機能なのでそのまま使える。queryLocator もこのメソッド内のローカル変数で完結し、`SessionContext.queryRuns` には触れない。

ただし `MockSalesforceClient.exportCsv()` は現状自前の `queryMore(runId)` を経由しているため、ここだけ Account 用 2 CSV を直接連結する形に書き換える必要がある (上記「影響ファイル」に記載済み)。

## テスト・検証観点

### ビルド/リント

- `cd backend && .\mvnw.cmd -B test`
- `cd frontend && npm run lint && npm run format && npm run build`

### mock プロファイルでの動作確認

- `SELECT Id, Name FROM Account` → 警告バナー表示 + DataGrid に 1 ページ目データ表示、ページ送りで前後移動可
- `SELECT Id, Name FROM Contact` → 警告なし、ページ送りで前後移動可
- 「CSV」ボタン → Account の場合 page-1 + page-2 の全行が含まれる CSV がダウンロードされる

### 実 Salesforce 環境 (任意)

- 結果 2,000 件以下のクエリ → 警告なし、ページャーで前後移動
- 結果 2,000 件超のクエリ (例: 全 Account) → 2,000 件表示 + 警告バナー
- CSV ダウンロード → 全件含まれる

## 実行するコマンド

```sh
# backend
cd backend
.\mvnw.cmd -B test

# frontend
cd ../frontend
npm run format
npm run lint
npm run build
```

## やらないこと

- 自動テスト追加 (プロジェクト方針: 明示依頼があるまで作らない)
- DataGrid をサーバサイドページングモードに切り替える改修
- ページサイズ選択 UI 以外のフィルタ/ソート機能拡張
