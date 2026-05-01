# デモデプロイガイド: Google Cloud Run / ローカル + Cloudflare Tunnel

対象アプリ: `docs/migration-plan/08_migration_plan.md` に記載の Spring Boot 3 + React (Vite) 構成。
Salesforce 照会ツール (SOQL Query / describe) を Integration User 経由で提供する。

このドキュメントの目的:

1. **デモ用途専用** のデプロイ手順を、無料枠で完結する 2 案に絞って整理する
2. それぞれの想定シナリオ・前提・手順・後始末を一通り示す

> 前提
>
> - **デモ用途のみ**。本格運用は視野外
> - **常時稼働は不要**。コールドスタート・アイドル sleep を許容
> - **無料枠で完結** させる
> - 視聴対象は限られた関係者 (社内デモ、スクリーン共有など)

---

## 1. 採用する 2 案

| 案 | 概要 | 想定シナリオ |
| --- | --- | --- |
| **A. Google Cloud Run** (主) | Docker イメージを Cloud Run にデプロイし、固定 URL `https://*.run.app` で常時アクセス可能にする | 「URL を伝えればいつでも見せられる」状態にしたい |
| **B. ローカル + Cloudflare Tunnel** (副) | デモする時だけローカルで起動し、`cloudflared` で公開 URL を発行する | デモ時のみ起動でよい / 自分の PC スペック・ネットワークを使いたい |

両案ともアプリ側の変更点は共通。**§3 の事前調整 → §4 (案 A) または §5 (案 B) → §6 動作確認 → §7 後始末** の順に進める。

---

## 2. デモ用途で押さえるべきリスクと対策

「デモだから雑でよい」とは言っても、Integration User の権限が触れる以上は最低限のガードをかける。

| # | リスク | デモ用途での対策 |
| --- | --- | --- |
| R1 | Integration User が組織内データに広く触れる可能性 | **Salesforce Developer Edition 組織** に専用 Integration User を作り、本番 SF とは隔離。デモ後は org ごと放置しても害が無い状態にする |
| R2 | アプリレベル認証が共有 password 1 個 | デモ用 password は十分長くする。デモ URL を SNS / 公開 issue に貼らない。デモ終了後は §7 の手順で停止 |
| R3 | 公開 URL への brute force | アプリ側の失敗ログ + (任意) Cloudflare Access (Zero Trust 無料枠 50 ユーザ) を前段に被せる |
| R4 | password / sessionId / SOAP リクエストのログ漏洩 | Logback の SOAP `<password>***</password>` マスクと、AGENTS.md の方針通り「機密値は `log.*` 引数に渡さない」を実装で必ず守る |
| R5 | コールドスタート / sleep 復帰でセッションロスト | デモ進行中の体験低下のみ。デモ開始 1 分前にウォームアップで一度叩いておく |
| R6 | Salesforce 接続情報が `.env` / Git に残る | (案 A) Secret Manager に格納 / (案 B) `.env` をローカルに留め `.gitignore` 確認 |

---

## 3. 事前にコード側で済ませる最小調整 (両案共通)

1. **`server.port` を環境変数で上書きできるように**
   Cloud Run は `PORT` 環境変数を強制注入する。
   `application.properties` に以下を追加:
   ```properties
   server.port=${PORT:8080}
   ```

2. **本番プロファイル `application-prod.properties` を追加**
   ```properties
   server.servlet.session.cookie.secure=true
   server.servlet.session.cookie.same-site=lax
   server.servlet.session.cookie.http-only=true
   server.forward-headers-strategy=native
   logging.level.com.example.sfqry=INFO
   ```

3. **ヘルスチェック用エンドポイント** `GET /api/health` → 200 を返すだけのものを 1 本用意。
   Cloud Run のスタートアップ判定や Tunnel の疎通確認に使う。

4. **シークレット周りの最終確認**
   - `.gitignore` に `.env` / `application-local.properties` が入っているか
   - SOAP リクエストの `<password>` をマスクするインターセプタが入っているか
   - エラーレスポンスにスタックトレースを返さない `@ControllerAdvice` が入っているか

---

## 4. 案 A: Google Cloud Run

### 4.1 必要なもの

- Google Cloud アカウント (クレカ登録は要だが、無料枠を超えなければ課金されない)
- `gcloud` CLI
- Docker (ローカルビルド検証用)
- Spring Boot を含む Dockerfile (08_migration_plan.md の構成を流用)

### 4.2 Dockerfile (デモ向け簡易版)

```dockerfile
# Node stage: React build
FROM node:20-alpine AS frontend
WORKDIR /workspace/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Maven stage: jar build
FROM maven:3.9-eclipse-temurin-21 AS backend
WORKDIR /workspace/backend
COPY backend/pom.xml ./
RUN mvn -B dependency:go-offline
COPY backend/ ./
COPY --from=frontend /workspace/frontend/dist ./src/main/resources/static
RUN mvn -B -DskipTests package

# Runtime stage
FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=backend /workspace/backend/target/*.jar app.jar
USER app
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -Djava.security.egd=file:/dev/./urandom"
ENV SPRING_PROFILES_ACTIVE=prod
ENTRYPOINT ["sh","-c","java $JAVA_OPTS -jar app.jar"]
```

### 4.3 デプロイ手順

1. **プロジェクト作成と API 有効化**
   ```bash
   gcloud projects create sfqry-demo --name="sfqry demo"
   gcloud config set project sfqry-demo
   gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com
   ```

2. **Artifact Registry を作成**
   ```bash
   gcloud artifacts repositories create sfqry \
     --repository-format=docker \
     --location=asia-northeast1
   ```

3. **シークレットを Secret Manager に登録**
   値はシェル履歴に残らないように `--data-file` で渡す。
   ```bash
   printf '%s' 'integration-user@example.com' | gcloud secrets create SF_USERNAME --data-file=-
   printf '%s' '<sf-password>'                | gcloud secrets create SF_PASSWORD --data-file=-
   printf '%s' '<sf-token>'                   | gcloud secrets create SF_SECURITY_TOKEN --data-file=-
   printf '%s' 'demo-user@example.com'        | gcloud secrets create APP_LOGIN_EMAIL --data-file=-
   printf '%s' '<demo-password>'              | gcloud secrets create APP_LOGIN_PASSWORD --data-file=-
   ```

4. **イメージビルド & プッシュ**
   ```bash
   gcloud builds submit \
     --tag asia-northeast1-docker.pkg.dev/sfqry-demo/sfqry/app:latest .
   ```

5. **Cloud Run へデプロイ**
   ```bash
   gcloud run deploy sfqry \
     --image asia-northeast1-docker.pkg.dev/sfqry-demo/sfqry/app:latest \
     --region asia-northeast1 \
     --platform managed \
     --allow-unauthenticated \
     --memory 1Gi \
     --cpu 1 \
     --concurrency 20 \
     --timeout 300 \
     --min-instances 0 \
     --max-instances 1 \
     --set-env-vars SPRING_PROFILES_ACTIVE=prod,SF_LOGIN_URL=https://login.salesforce.com,SF_API_VERSION=65.0 \
     --set-secrets SF_USERNAME=SF_USERNAME:latest,SF_PASSWORD=SF_PASSWORD:latest,SF_SECURITY_TOKEN=SF_SECURITY_TOKEN:latest,APP_LOGIN_EMAIL=APP_LOGIN_EMAIL:latest,APP_LOGIN_PASSWORD=APP_LOGIN_PASSWORD:latest
   ```

   完了するとコマンド出力に `https://sfqry-xxxxxxxxxx-an.a.run.app` 形式の URL が表示される。

### 4.4 設定値の意図

| 設定 | 値 | 理由 |
| --- | --- | --- |
| `--memory` | 1Gi | Spring Boot は 512MB だと OOM しやすい。1GB あれば余裕。無料枠の GB-秒は十分余る |
| `--cpu` | 1 | コールドスタート短縮 |
| `--max-instances` | 1 | in-memory セッション/キャッシュ前提。スケールアウトさせない |
| `--min-instances` | 0 | 無操作時はゼロにスケールして無料枠を温存 |
| `--concurrency` | 20 | デモなら 1 でも可。複数人同時操作するなら 20 で安全 |
| `--timeout` | 300 | CSV エクスポートが長引くケース対策 |
| `--allow-unauthenticated` | 有効 | アプリ側の email/password 認証で守る前提。Cloudflare Access を被せる場合 (§4.5) もこのままで OK |

### 4.5 (任意) Cloudflare Access で前段認証を足す

Cloud Run の URL は推測されにくいが、漏れたら誰でも触れる。
無料枠で IdP 個人認証を被せたい場合の構成:

1. 独自ドメインを Cloudflare DNS に委任
2. Cloud Run のカスタムドメインマッピングは使わず、Cloudflare 側で `sfqry.example.com → <Cloud Run URL>` の `CNAME` を切ってプロキシ ON
3. Zero Trust → Access → Applications → Self-hosted で `sfqry.example.com` を追加し、Google Workspace 等の IdP を必須化
4. Cloud Run の `*.run.app` URL は社外に出さず、Cloudflare 経由のドメインのみ案内する

(完全な Access バイパス防止には Cloud Run 側でも JWT 検証が必要だが、デモ用途では URL 秘匿で十分)

---

## 5. 案 B: ローカル + Cloudflare Tunnel

### 5.1 必要なもの

- ローカル PC で Spring Boot が起動できる環境 (Java 21 + Maven)
- `cloudflared` インストール (Windows: `winget install --id Cloudflare.cloudflared`)
- (B-2 のみ) Cloudflare アカウントと、そこに DNS を委任した独自ドメイン

### 5.2 二つのモード

| モード | 用途 | 特徴 |
| --- | --- | --- |
| **B-1 Quick Tunnel** | 「今この瞬間だけ見せる」 | 起動の度に `https://*.trycloudflare.com` の使い捨て URL が発行される。ドメイン不要・サインイン不要 |
| **B-2 Named Tunnel** | 「同じ URL で何度かデモする」 | 自前ドメイン配下に固定 URL。Cloudflare Access も被せられる |

### 5.3 B-1: Quick Tunnel (最小構成)

```bash
# 1. Spring Boot を起動 (本番プロファイル)
SPRING_PROFILES_ACTIVE=prod ./mvnw spring-boot:run

# 2. 別シェルで Tunnel 起動
cloudflared tunnel --url http://localhost:8080
```

実行直後、コンソールに `https://random-words.trycloudflare.com` が表示される。
これをデモ視聴者に共有する。**起動の度に URL が変わる** ので注意。

デモが終わったら両方のプロセスを `Ctrl+C` で停止すれば公開停止。

### 5.4 B-2: Named Tunnel (固定 URL + Access 連携可能)

1. **`cloudflared` で初回ログイン** (ブラウザでドメイン選択)
   ```bash
   cloudflared tunnel login
   ```

2. **Tunnel 作成**
   ```bash
   cloudflared tunnel create sfqry-demo
   ```
   `~/.cloudflared/<UUID>.json` に資格情報ファイルが生成される。

3. **DNS ルーティング**
   ```bash
   cloudflared tunnel route dns sfqry-demo sfqry.example.com
   ```

4. **設定ファイル `~/.cloudflared/config.yml`** (Windows なら `%USERPROFILE%\.cloudflared\config.yml`)
   ```yaml
   tunnel: <UUID>
   credentials-file: C:\Users\<you>\.cloudflared\<UUID>.json

   ingress:
     - hostname: sfqry.example.com
       service: http://localhost:8080
     - service: http_status:404
   ```

5. **Spring Boot 起動 → Tunnel 起動**
   ```bash
   SPRING_PROFILES_ACTIVE=prod ./mvnw spring-boot:run
   # 別シェル
   cloudflared tunnel run sfqry-demo
   ```

6. **(推奨) Cloudflare Access で IdP 認証を要求**
   Zero Trust → Access → Applications → Self-hosted を `sfqry.example.com` に対して追加。

### 5.5 注意点 (Tunnel 案)

- **デモ中はローカル PC をシャットダウン / sleep させない** (sleep で接続が切れる)
- Cloudflare 側で TLS 終端されるので、ローカル Spring Boot は HTTP で待ち受けて OK。`server.servlet.session.cookie.secure=true` は維持 (Cloudflare からは HTTPS で渡る)
- `.env` をローカルに置く場合は `.gitignore` に登録済みであることを再確認
- Quick Tunnel の URL は **生存期間中なら誰でもアクセス可能**。不要時は `cloudflared` を必ず停止する

---

## 番外: モック版デプロイ

Salesforce 接続情報が不要なモック版 (`SPRING_PROFILES_ACTIVE=mock`) でデプロイする手順。
デモデータが固定のため、SF 組織の準備ゼロで起動できる。

### 案 A との差分 (Cloud Run)

§4.3 手順 3 (シークレット登録) を **丸ごとスキップ**し、手順 5 の `gcloud run deploy` を以下に置き換える。

```bash
gcloud run deploy sfqry \
  --image asia-northeast1-docker.pkg.dev/sfqry-demo/sfqry/app:latest \
  --region asia-northeast1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --concurrency 20 \
  --timeout 300 \
  --min-instances 0 \
  --max-instances 1 \
  --set-env-vars SPRING_PROFILES_ACTIVE=mock
```

`--set-secrets` の行は不要。モック用の固定 email/password はコード内に定義済みのため Secret Manager も使わない。

### 案 B との差分 (ローカル + Cloudflare Tunnel)

起動コマンドの環境変数を変えるだけ。`.env` も SF 接続情報も不要。

```bash
# Spring Boot 起動
SPRING_PROFILES_ACTIVE=mock ./mvnw spring-boot:run

# 別シェル (Quick Tunnel の場合)
cloudflared tunnel --url http://localhost:8080
```

### 後始末

案 A の場合、§7 の Cloud Run 後始末から **シークレット削除の行を省く**だけで手順は同じ。

```bash
gcloud run services delete sfqry --region asia-northeast1
# gcloud secrets delete ... は不要 (作成していないため)
gcloud artifacts repositories delete sfqry --location asia-northeast1
```

---

## 6. 動作確認チェックリスト (両案共通)

| 項目 | 期待結果 |
| --- | --- |
| `GET /api/health` | 200 |
| 公開 URL に未ログインアクセス | `/login` 画面が表示される |
| 誤った email/password | 401 |
| 正しい email/password | `/api/me` が UserInfo を返す。Cookie に `Secure; HttpOnly; SameSite=Lax` |
| `SELECT Id, Name FROM Account LIMIT 10` | DataGrid に 10 行 |
| 大量 SOQL → CSV エクスポート | ストリーミング DL 完走 (Cloud Run 側はタイムアウト 300s 以内であること) |
| describe(Account) 2 回目 | 1 回目より高速 (キャッシュ HIT) |
| (案 A) コンテナがアイドルで停止後の再アクセス | コールドスタート (10〜30s) を経て復帰、要再ログイン |
| (案 B-1) `cloudflared` 停止後の URL アクセス | 接続不可 |

---

## 7. 後始末 (デモ終了後)

### 案 A: Cloud Run

```bash
# サービス削除
gcloud run services delete sfqry --region asia-northeast1

# シークレット削除
gcloud secrets delete SF_USERNAME
gcloud secrets delete SF_PASSWORD
gcloud secrets delete SF_SECURITY_TOKEN
gcloud secrets delete APP_LOGIN_EMAIL
gcloud secrets delete APP_LOGIN_PASSWORD

# (任意) イメージ削除
gcloud artifacts repositories delete sfqry --location asia-northeast1
```

プロジェクトごと不要なら `gcloud projects delete sfqry-demo`。

### 案 B: Tunnel

```bash
# Tunnel 停止 (Ctrl+C)
# Named Tunnel の場合の追加クリーンアップ
cloudflared tunnel delete sfqry-demo
# DNS の CNAME も Cloudflare ダッシュボードから削除
```

### 共通

- Salesforce Developer Edition 側で Integration User の **password / security token を再発行** しておくと、漏れていた場合の影響を断てる
- アプリレベル認証用の `APP_LOGIN_PASSWORD` をローカルメモから消す

---

## 8. 本格運用へ進む場合の追加検討事項

本書はデモ用途のみカバー。本番運用が視野に入った時点で以下を再評価する。

- Integration User 共有 → ユーザごとの OAuth Web Server Flow
- in-memory セッション → Spring Session + Redis
- アプリレベル shared password → Cloudflare Access (本格設定 + アプリ側 JWT 検証)
- ログ長期保管 / SIEM 連携 (Cloud Logging → BigQuery、Logpush → R2 等)
- 依存脆弱性監視 (Dependabot / `mvn dependency-check`)
- HTTPS セキュリティヘッダ (CSP / HSTS / X-Content-Type-Options)
- Cloud Run の `--min-instances=1` でコールドスタート除去 (有料化)

---

## 9. 参考

- 08_migration_plan.md (本リポジトリ): アプリの全体設計
- Cloud Run ドキュメント: https://cloud.google.com/run/docs
- Cloudflare Tunnel: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
- Cloudflare Access (Zero Trust): https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-apps/
