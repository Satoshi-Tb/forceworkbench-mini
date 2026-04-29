# Workbench (forceworkbench) — アプリケーション概要

## 1. アプリケーションの位置づけ

`forceworkbench` は **Salesforce.com の管理者・開発者向け Web ベース運用ツール**である。
SOAP / REST / Bulk / Streaming / Metadata / Apex といった Force.com 各 API を、
ブラウザだけから呼び出して、データ・メタデータの参照・操作・移行・テストを行うための
「API クライアント GUI」と位置づけられる。

公式名称：**Workbench**
公式サイト：`https://workbench.developerforce.com`
ライセンス：BSD-3 系（Salesforce.com, inc. 著作）
状態：**Maintenance Only Mode**（README.md に明記。新機能追加・新規セキュリティ修正なし。
ただし PHP 8.4 対応など互換性修正は最近もコミットされている）

リポジトリ内バージョン: `66.0.0`（`workbench/config/constants.php` 参照）。
Salesforce API のバージョンは v8.0 ～ **v66.0**（2024 春相当）まで同梱 WSDL でサポート。

## 2. 主な利用者像

- Salesforce 管理者：データ調査・一括 DML・メタデータの移行を GUI から行う。
- Salesforce 開発者：SOQL/SOSL/REST/Apex の挙動を確認する「サンドボックス」として利用。
- API デバッガ：SOAP ヘッダのカスタマイズ、API バージョンの切替、ロギング機能で
  動作検証を行う。

## 3. ホスティング前提

`Procfile`、`app.json`、`Dockerfile`、`docker-compose.yml` から判断して、
**Heroku（heroku-24 stack）または Docker Compose 環境**で動くことを前提に設計されている。

- Web プロセス: Apache + PHP-FPM（`heroku-php-apache2` バイナリ経由）
- Worker プロセス: PHP CLI (`async_workers.sh`) が Redis キューから非同期ジョブを取り出して実行
- セッション保管: Redis (任意、無くても動く)

## 4. リポジトリ最上位構成

```
/
├─ workbench/              … 実体のアプリケーションコード
├─ vendor/ (composer)      … Sentry SDK 等の依存
├─ assets/                 … ロゴ等
├─ build/, build.xml       … リリースビルド用
├─ scripts/                … 補助スクリプト
├─ docs/                   … ドキュメント
├─ local-development/      … docker-entrypoint-{web,worker}.sh
├─ Dockerfile              … Heroku-24 ベースのイメージ
├─ docker-compose.yml      … web / worker / redis の 3 サービス
├─ Procfile                … Heroku 用プロセス定義
├─ composer.json           … PHP 8.4, ext-redis, ext-soap, ext-curl, ext-sodium, sentry/sentry
├─ app.json                … Heroku ボタン用設定（CSRF secret 自動生成、SSL 強制 等）
├─ CHANGELOG.md            … 詳細な版数履歴
└─ README.md               … 概要 + Maintenance only 表記
```
