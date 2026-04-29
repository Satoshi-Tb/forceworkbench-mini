# Workbench (forceworkbench) 調査結果

別言語移植のための事前調査。すべて当リポジトリ (`C:\home\dev_ai\forceworkbench`) を読んで作成。

## 結論サマリ

- アプリ正体: **Salesforce 全 API（SOAP/REST/Bulk/Metadata/Apex/Streaming）の Web GUI クライアント**
- リポジトリ内バージョン: 66.0.0（API v8.0 ～ v66.0 を網羅）
- 状態: **Maintenance Only Mode**。新機能はもう増えない。PHP 8.4 互換維持のみ続いている。
- 言語: **PHP 8.4 / フレームワークレス / 生 PHP**
- 配備: Heroku (heroku-24) または Docker Compose (web + worker + redis)
- アーキ: 各画面=独立 PHP ファイル ＋ `WorkbenchContext` を `$_SESSION` に共有 ＋ Redis BLPOP で長時間ジョブを async 化

## ファイル一覧

| ファイル                 | 内容                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `01_overview.md`         | アプリ概要・ホスティング前提・最上位構成                                                              |
| `02_tech_stack.md`       | 言語・拡張モジュール・ライブラリ・データストア・各 API クライアント実装の場所、設定とセキュリティ機構 |
| `03_architecture.md`     | リクエストフロー、`workbench/` 直下のエントリ表、Context/Controller/Async/Util の役割                 |
| `04_auth_and_session.md` | 4 種ログイン経路・セッション処理・CSRF・暗号化                                                        |
| `05_features.md`         | メニューカテゴリ別の機能カタログ（画面 × API × 特記事項）                                             |
| `06_salesforce_apis.md`  | 利用している Salesforce API 一覧と、各 API での呼出メソッド                                           |
| `07_porting_notes.md`    | 別言語移植時の論点・最小コア抽出例・推奨手順                                                          |
| `08_migration_plan.md`   | **照会機能 (Login / SOQL Query / Describe) の Java Spring Boot + React 版への移植プラン (確定版)**    |

## どこから読むか

- 全体把握 → `01` → `03` → `05`
- 移植検討 → `06` → `07`
- 認証だけ知りたい → `04`
- **これから実装する** → `08_migration_plan.md` (確定プラン)

## 次に確認すべき箇所（深掘り候補）

1. `workbench/shared.php`（28KB、本回は冒頭のみ精読）— `crypto_serialize` の鍵生成、`addLinksToIds`、`getWorkbenchUserAgent` の詳細
2. `workbench/put.php`（57KB）— DML 各種フォーム生成と CSV→Bulk Job 変換ロジックの全容
3. `workbench/header.php` / `footer.php`（合計 ~10KB）— 共通 UI とメニュー描画
4. `workbench/static/script/` 配下の自前 JS（query.js / restexplorer.js / streamingClient.js など）

「どの機能を移植したいか」が決まれば、上記のうち該当箇所を重点的に再調査することで設計に落とし込める。
