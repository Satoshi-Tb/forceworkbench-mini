# `08_migration_plan.md` レビュー指摘メモ

対象: `work/08_migration_plan.md`

Workbench 照会機能を Java Spring Boot + React へ移植する計画についてのレビュー指摘と、
ユーザ回答後に確定した修正方針をまとめる。

## 前提として確定した事項

- 利用者は社内の限られたメンバー 3 名程度を想定する。
- アプリログインの利用者識別は厳密な本人特定ではなく、簡易的な利用記録を目的とする。
- Salesforce 側の監査ログは Integration User に集約される前提でよい。
- 対象環境では SOAP API のみ利用可能なため、SOQL Query / describe は Partner SOAP API で実装する。
- MVP では MUI X DataGrid Community を前提とし、Pro 機能は使わない。

## 指摘 1: 認証方式の監査限界を明記する

現行計画では、利用者が React のログイン画面で email + password を入力し、
Spring Boot が設定済みの `sf.username` / `sf.password` と比較する方針になっている。

この方式では厳密には「誰が操作したか」を特定できない。ただし、少人数チーム向けの
ローカルツールであり、形式的なログイン記録で足りるという前提が確認済み。

`08_migration_plan.md` には以下の趣旨を追記すること。

```md
利用者識別は厳密な本人特定ではなく、少人数チーム内での簡易利用記録を目的とする。
Salesforce 側の監査ログは Integration User に集約される。
```

## 指摘 2: SOAP API のみで実装する方針を明記する

`07_porting_notes.md` では SOQL Query / describe を REST API に寄せる案も示しているが、
対象環境では SOAP API しか利用できないため、今回の計画では REST 置換を行わない。

`08_migration_plan.md` には以下の趣旨を追記すること。

```md
対象環境では SOAP API のみ利用可能なため、SOQL Query / describe は Partner SOAP API で実装する。
REST API への置換は行わない。
```

この前提では、Salesforce WSC (`force-wsc`) の採用は妥当。

## 指摘 3: API バージョンは v65.0 を初期値にする

現行計画では v66.0 を前提にしているが、現在利用中の Salesforce API バージョンは v65.0。
MVP では既存利用環境と挙動を合わせるため、v65.0 を初期値にする。

推奨方針:

- MVP では `sf.api-version=65.0` を初期値にする。
- UI 上の API バージョン切替機能は MVP では持たせない。
- 将来のバージョンアップに備え、`application.properties` または環境変数で変更可能にする。
- README に「検証済み API バージョン」を明記する。

設定例:

```properties
sf.api-version=65.0
```

将来拡張の段階:

1. MVP: `sf.api-version` で固定、UI 変更なし
2. 次段階: 起動時に利用可能バージョンを設定リスト化
3. 必要になった場合のみ: 画面上でセッション単位の API バージョン切替

## 指摘 4: CSV エクスポートは GET ではなく POST にする

現行計画では `GET /api/query/csv?soql=...` になっている。
SOQL を URL クエリに含めると、ブラウザ履歴、アクセスログ、プロキシログに残る可能性があり、
URL 長制限にも当たりやすい。

MVP では以下の 1 API でよい。

```text
POST /api/query/csv
body: { soql, queryAll }
response: text/csv
```

React 側では `fetch` で POST し、レスポンスを Blob 化してダウンロードする。
ユーザー体験としては「CSV ボタンを押すとダウンロードされる」だけなので、UI/UX への影響はない。

大量 CSV、再試行、非同期エクスポートが必要になった場合のみ、将来以下に拡張する。

```text
POST /api/query/exports
GET  /api/query/exports/{exportId}/download
```

## 指摘 5: queryLocator はフロントへ直接返さずサーバ側で管理する

現行計画では Salesforce の `queryLocator` を React 側に返す設計になっている。
`queryLocator` は sessionId ほど危険ではないが、Salesforce のページング内部ハンドルであり、
サーバ側セッションに紐づく状態として管理した方がよい。

フロントへ直接返す場合の弱点:

- ブラウザやログに残る可能性がある。
- 別タブ、古い画面、再読み込み時の扱いが曖昧になる。
- locator 失効時に、どの SOQL の続きだったかサーバ側で判断しづらい。
- 将来、監査ログ、キャンセル、再実行、CSV 連携を入れる時に扱いにくい。
- Salesforce 実装詳細が API レスポンスに漏れる。

推奨 API:

```text
POST /api/query
-> { queryRunId, rows, columns, done }

GET /api/query/runs/{queryRunId}/next
-> { rows, done }
```

サーバ側 HTTP セッション内で以下のように保持する。

```text
queryRunId -> {
  soql,
  queryLocator,
  createdAt,
  lastAccessedAt,
  rowCount
}
```

React は `queryLocator` ではなく `queryRunId` のみを保持する。
UI/UX は変わらず、画面上は Run / Next page の操作だけでよい。

## 指摘 6: MUI X DataGrid Community 前提に合わせて機能表現を修正する

現行計画では MUI X DataGrid Community の説明に列固定が含まれているが、
column pinning は Pro/Premium 側の機能であり、MVP では使えない。

`08_migration_plan.md` では以下の趣旨に修正すること。

```md
MUI X DataGrid Community — 結果テーブル、仮想スクロール、列幅調整、ソート、フィルタ等の
Community 範囲で実装。列固定・高度な集計・Pro 機能は将来改善で検討。
```

MVP では Pro ライセンスを前提にしない。

## `08_migration_plan.md` への反映優先順

1. API 前提を「SOAP API のみ」に固定する。
2. API バージョン初期値を v65.0 に変更し、設定で変更可能とする。
3. CSV エクスポート API を `POST /api/query/csv` に変更する。
4. ページング設計を `queryLocator` 直接返却から `queryRunId` 方式に変更する。
5. DataGrid の説明から Pro 機能を除外する。
6. 認証方式の監査限界を明記する。
