# forceworkbench-mini

Salesforce 照会ツール (MySQL Workbench 風)。Java Spring Boot + React で構築する Workbench 照会機能の移植版。

詳細な移植計画は `docs/migration-plan/` を参照。

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

## 環境変数

`.env.example` を `.env` にコピーして利用する。`.env` は git 管理外。

```bash
cp .env.example .env
```

`SPRING_PROFILES_ACTIVE=mock` で Salesforce 接続なしのモック起動。real プロファイル (空または未指定) では `SF_USERNAME` / `SF_PASSWORD` / `SF_SECURITY_TOKEN` / `SF_LOGIN_URL` / `SF_API_VERSION` を設定する。SOQL 画面の取得上限は Salesforce の `LIMIT` 上限に合わせて既定 2,000 件とし、デバッグ時のみ `SF_QUERY_BATCH_SIZE` で上書きできる。

SOAP `login()` は Salesforce 側の制約により API v65.0 以上では利用できないため、real プロファイルのログイン確認では `SF_API_VERSION=64.0` を指定する。新規 Developer Edition org では `Setup` の `ユーザインターフェース` で `Enable SOAP API login()` を有効化する必要がある。

real プロファイルのログイン画面では Salesforce のユーザー名とパスワードのみを入力する。SOAP Partner API へのログイン時は、サーバ側で `SF_SECURITY_TOKEN` をパスワードに連結して送信する。

## Salesforce WSC / Partner API 入手結論

`com.force.api:force-wsc:67.0.0` (SOAP framework) と `com.force.api:force-partner-api:67.0.0` (Partner WSDL から生成された stub) が Maven Central で取得可能。`backend/pom.xml` で両方を依存に加える。
