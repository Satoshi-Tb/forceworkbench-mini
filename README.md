# forceworkbench-mini

Salesforce 照会ツール (MySQL Workbench 風)。Java Spring Boot + React で構築する Workbench 照会機能の移植版。

詳細な移植計画は `docs/migration-plan/` を参照。

## 公開範囲・利用について

- このリポジトリは**個人開発用途**を想定しています。

> **注意: mock プロファイルのままインターネット公開しないこと**
>
> `SPRING_PROFILES_ACTIVE=mock` のままデプロイすると、`APP_LOGIN_EMAIL` / `APP_LOGIN_PASSWORD`
> 未設定時はデフォルト資格情報でログインできる状態になります。
> 公開エンドポイントにデプロイする場合は必ずこれらの環境変数を上書きしてください。
> デプロイ手順は `docs/deployment/demo-deploy.md` を参照してください。

## 起動 (開発時)

backend (Spring Boot, port 8080):

```bash
cd backend
./mvnw spring-boot:run
```

frontend (Vite dev server, port 5173):

```bash
cd frontend
npm install
npm run dev
```

ブラウザで `http://localhost:5173` を開く。`/api/*` は Vite proxy で 8080 に転送される。

## 起動 (Docker Compose)

フロントエンドのビルド成果物を Spring Boot の jar に同梱した単一コンテナを起動する。動作確認・本番想定の構成検証に利用する。

事前に `.env.example` を `.env` にコピーし、`SPRING_PROFILES_ACTIVE` および必要な接続情報を設定しておく。

```bash
docker compose up --build       # ビルド + 起動 (フォアグラウンド)
docker compose up -d --build    # バックグラウンド起動
docker compose logs -f          # ログ追跡
docker compose down             # 停止
```

ブラウザで `http://localhost:8080` を開く (Vite dev server は使わず、Spring Boot がフロントエンドの静的ファイルも配信する)。

依存パッケージや Java/Node のバージョンを更新した場合は `--build` を付けてイメージを再生成する。

## 環境変数

`.env.example` を `.env` にコピーして利用する。`.env` は git 管理外。

```bash
cp .env.example .env
```

### モック向け設定例 (`.env`)

`SPRING_PROFILES_ACTIVE=mock` で Salesforce 接続なしの mock 起動を行う場合の例。

```env
SPRING_PROFILES_ACTIVE=mock

# UI ログイン用 (mock プロファイルの認証)
APP_LOGIN_EMAIL=<任意のメールアドレス>
APP_LOGIN_PASSWORD=<任意のパスワード>
```

- `APP_LOGIN_EMAIL` / `APP_LOGIN_PASSWORD` を未設定にすると `application-mock.properties` のデフォルト (`test/test`) で起動する。ローカル動作確認のみなら省略可。
- 公開エンドポイントへのデプロイ時は必ず上書きすること (詳細は `docs/deployment/demo-deploy.md`)。

### 本番向け設定例 (`.env`, real プロファイル)

実 Salesforce 組織への接続を行う場合の例。`SPRING_PROFILES_ACTIVE` は**空文字列を明示**する (行を削除すると `application.properties` のデフォルト `mock` が有効になるため)。

```env
# real プロファイル (空文字列を明示)
SPRING_PROFILES_ACTIVE=

# Salesforce Integration User
SF_USERNAME=integration-user@example.com
SF_PASSWORD=<Salesforce パスワード>
SF_SECURITY_TOKEN=<Salesforce セキュリティトークン>
SF_LOGIN_URL=https://login.salesforce.com
SF_API_VERSION=64.0

# (任意) HTTPS 経由で公開する場合
# COOKIE_SECURE=true
```

- `SF_API_VERSION=64.0` は SOAP `login()` の制約に合わせた指定 (v65.0以上では利用できない)。なお、Saleseforce側の `Enable SOAP API login()` の設定が、有効化されている必要がある。
- real プロファイルのログイン画面では Salesforce のユーザー名とパスワードのみを入力する。SOAP Partner API へのログイン時は、サーバ側で `SF_SECURITY_TOKEN` をパスワードに連結して送信する。
- `SF_QUERY_BATCH_SIZE` は通常省略する (デフォルト 2,000 件)。
- HTTPS 終端のリバースプロキシ越しに公開する場合のみ `COOKIE_SECURE=true` を有効化する。HTTP のローカル `docker compose` 起動時に `true` にすると Cookie が機能しないので注意。
