# 認証 / セッションフロー

`workbench/login.php` + `workbench/controllers/LoginController.php` + `workbench/session.php`
+ `workbench/context/WorkbenchContext.php` + `workbench/context/ConnectionConfiguration.php` を参照。

## 1. ログイン経路は 4 通り

| `loginType` | 入力 | 内部処理 |
|---|---|---|
| `std` (Standard) | username + password | Salesforce のドメイン (login/test) を選び、Partner SOAP の `login()` 呼出 |
| `adv` (Advanced) | username+password 又は **Session ID + Server URL** | session id の場合は SOAP `login` をスキップして直接 Partner client を初期化 |
| `oauth` | OAuth 2.0 Web Server Flow | `code` 取得 → `/services/oauth2/token` に curl POST → `instance_url` + `access_token` で初期化 |
| `signed_request` | Salesforce Canvas からの POST | HMAC-SHA256 で署名検証 → `instanceUrl + partnerUrl` を Server URL として確立 |

OAuth は `WorkbenchConfig.oauthConfigs` (host => key/secret/label) で設定された host だけが使える。
`oauthRequired = true` の場合は std/adv が無効化される。

## 2. ログイン後の流れ

1. `LoginController::processLogin()` 内で
   `session_unset(); session_destroy(); session_start(); session_regenerate_id();`
   を実行（Session Fixation 防止）
2. `ConnectionConfiguration::fromUrl($serverUrl, $sessionId, $clientId)` を構築
3. `WorkbenchContext::establish($connConfig)` で `$_SESSION["WORKBENCH_CONTEXT"]` に格納
4. UserInfo 取得＝接続テスト
5. **Org ID Allow/Block list** を 15 文字 ID で照合 (`orgIdAllowList`, `orgIdBlockList`)
6. `$actionJump` (既定: `select.php`) に 302 リダイレクト

## 3. リクエスト毎のチェック (`workbench/session.php`)

- `redirectToHTTPS` 設定が true なら HTTPS へリダイレクト
- `requireSSL` 設定で end-to-end SSL を強制
- `WorkbenchContext::isEstablished() == false` で `requiresSfdcSession` 画面 → `login.php` へ強制リダイレクト
- 読取専用モード（`readOnlyMode`）で書込み画面を遮断
- POST/PUT 系は `validateCsrfToken()`
- アイドル時間 (`sessionIdleMinutes`) 超過時は `getServerTimestamp()` で SFDC 側のセッション死活確認
- `PATH_INFO` 付き URL を 400 拒否

## 4. CSRF トークン

`shared.php#getCsrfToken` ：
```
md5( $config['csrfSecret'] . session_id() . $_SERVER['SCRIPT_NAME'] )
```
- `csrfSecret` は Heroku デプロイ時に `app.json` の `"generator":"secret"` で自動生成される
- フォーム送信時は `getCsrfFormTag()` を hidden input として埋め込む

## 5. セッション保管

- `RedisSessionHandler` … Redis があれば `SETEX($session_id, 3600, $data)`
- 無ければ PHP デフォルト（ファイル）
- セッション cookie は `httponly`
- ブラウザ側 Cookie に Workbench 設定値（`Settings` 画面で変更可能なもの）も別途保存

## 6. 暗号化

- `crypto_serialize` / `crypto_unserialize`（`shared.php` 内、`ext-sodium` 使用）で
  セッションIDなどの機密値を **Redis に格納する直前で対称鍵暗号化** する。
- 鍵はおそらく `csrfSecret` 由来 or 別環境変数（`shared.php` 全体は未読だが命名規則から推測）。
  →**移植時は必ず詳細を確認するべき重要箇所**。

## 7. ログアウト (`logout.php`)

- WorkbenchContext を `release()` してセッションを破棄
- OAuth 経由ログイン時は SFDC 側のフロントチャネルログアウト用 iframe を仕込む実装あり
  (`session.php` 経由の `serverUrlPrefix` を保持しているのはそのため)
