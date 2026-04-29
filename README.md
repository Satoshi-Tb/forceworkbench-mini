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

`SPRING_PROFILES_ACTIVE=mock` で Salesforce 接続なしのモック起動。real プロファイル (空または未指定) では `SF_USERNAME` / `SF_PASSWORD` / `SF_SECURITY_TOKEN` / `SF_LOGIN_URL` / `SF_API_VERSION` を設定する。

## Salesforce WSC (force-wsc) 入手結論

`com.force.api:force-wsc:67.0.0` が Maven Central で取得可能。フェーズ 6 の実 SOAP 実装時に `backend/pom.xml` の依存に追加する。
