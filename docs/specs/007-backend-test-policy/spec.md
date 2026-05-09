# バックエンド自動テスト導入方針 (issue #5)

## 背景・目的

バックエンドの既存テストは `backend/src/test/java/com/example/sfqry/query/SoqlQueryGuardTest.java` のみで、SoqlQueryGuard の入力検証ケースを JUnit 5 + AssertJ で確認している。`pom.xml` には `spring-boot-starter-test` が既に含まれており、テスト基盤の追加導入は不要。

一方、ルート `AGENTS.md` では「自動テスト導入は現時点では低優先度課題」「ユーザから明示依頼がない限り、新規テストコードは作成しない」と明記しており、無秩序にテストを増やす運用は取らない方針。

issue #5 の完了条件:

1. バックエンド自動テストの導入方針が決まっている
2. 初期導入対象のテストケース一覧が整理されている
3. テスト実行コマンドと CI での扱いが決まっている
4. 初期導入対象のテストコードが実装され、`.\mvnw.cmd -B clean test` が全件 PASS している

本 spec はこの 4 点を満たすことを目的とする。本 issue は方針確定とあわせて、優先度 1 → 2 → 3 の順でテストコード実装まで完了させるスコープとする(2026-05-10 にスコープ拡大)。

## 成功基準

- バックエンド自動テストの対象範囲・対象外範囲・命名規則・モック戦略が `backend/AGENTS.md` (新規) に集約されている
- 初期導入対象のテストケース候補が、対象クラス単位で本 spec に列挙されている
- ローカルでのテスト実行コマンドが明記されている (`.\mvnw.cmd -B clean test`)
- CI 自動化は本 issue のスコープ外であることが明記されている
- 既存の `SoqlQueryGuardTest` の構成 (JUnit 5 + AssertJ + `@DisplayName` 日本語) が今後の標準パターンとして合意されている
- 「初期導入対象テストケース一覧」優先度 1〜3 のテストコードが実装され、`.\mvnw.cmd -B clean test` が全件 PASS している

## 方針

### 対象範囲の判定原則

| 区分 | 扱い | 理由 |
|---|---|---|
| 純粋ロジック (Spring 不要) | 第 1 優先で対象 | DI / プロファイル不要・実行が速く・退行検出が安価 |
| Service 層 (SalesforceClient 経由) | 第 2 優先で対象 | 既存 `MockSalesforceClient` を `@ActiveProfiles("mock")` で注入してテストする |
| Controller 層 (REST API) | 必要に応じて対象 | MockMvc + `@SpringBootTest` で API 仕様 (HTTP ステータス・JSON 形状・CSV ヘッダ) を抑える |
| `SoapSalesforceClient` (本物 SOAP) | 対象外 | 外部依存・ネットワーク必須・モックの価値より維持コストが上回る |
| Spring Security / Cache の設定内部 | 対象外 | フレームワーク自身の責務。Controller 層テストで挙動として確認できれば十分 |
| private メソッド | 対象外 | ルート `AGENTS.md` で禁止済み。public 境界経由で検証する |
| DTO / record の getter / equals | 対象外 | `record` 自動生成。投資対効果が低い |

### 着手順とパイロット実装

優先度1 → 優先度2 → 優先度3 の順で進める。最初の PR(パイロット)で命名・ヘルパ・パラメータテスト・アサーションのパターンを固定し、その後の PR は同パターンを横展開する。

1. **パイロット PR**: 優先度1 の 2 クラス(`SoqlQueryGuardTest` 既存追加 + `CsvEncodingTest` 新規)を対象とし、本 spec の規約が実コードでどう表現されるかを確定する。
2. **横展開 PR**: パイロットで固定したパターンに沿って、優先度2(Service 層)→ 優先度3(Controller 層)の順で追加する。

途中でパターン変更が必要になった場合は、本 spec を更新してから新パターンを適用する。spec とテストコードの乖離は許容しない。

### モック戦略

`SalesforceClient` は唯一の Salesforce 依存境界となっている。テストではこの境界をどう差し替えるかを以下のように決める。

| ケース | 置換方法 | 例 |
|---|---|---|
| Service / Controller の標準動作確認 | `@ActiveProfiles("mock")` + 既存 `MockSalesforceClient` | `QueryServiceTest`・`QueryControllerTest` |
| `MockSalesforceClient` のシナリオで表現できない例外パス (例: 認証期限切れ・SOAP 障害の擬似化) | 必要時に Mockito による `SalesforceClient` の `@MockitoBean` 化 | `QueryService` で SalesforceClient が `ApiException` をスローした場合の伝播確認 |
| 認証 (`MockSalesforceClient.login`) の email / password | テスト用 `application-test.properties` で `app.login.email` / `app.login.password` を固定値化 | `LoginControllerTest` |

Mockito を「初期から広く使う」ことはしない。`MockSalesforceClient` で表現できる範囲を上限とし、不足が出た時点で限定的に導入する。

#### `@SpringBootTest` と `@WebMvcTest` の使い分け

| 用途 | アノテーション | Salesforce 依存の埋め方 |
|---|---|---|
| 主軸: 正常系・`MockSalesforceClient` で表現可能 | `@SpringBootTest @ActiveProfiles("mock")` | プロファイル選択で実 Bean |
| 例外パス(`ApiException` 伝播・`SalesforceClient` 由来例外など) | `@SpringBootTest @ActiveProfiles("mock")` + `@MockitoBean SalesforceClient` | Mockito で必要箇所のみ動的に振る舞いを上書き |
| `ErrorAdvice` 単独確認(ダミー Controller から例外を投げる) | `@WebMvcTest(ErrorAdvice.class)` | Service を呼ばないので不要 |

`@MockitoBean` 利用上の注意:

- 本リポジトリは Spring Boot 3.5 のため、`@MockBean` ではなく `@MockitoBean` / `@MockitoSpyBean` を採用する(deprecation 対応)
- `@MockitoBean` を含むテストクラスでは ApplicationContext がキャッシュされない。例外パスのテストは1クラスに集約して起動コストを抑える
- `@WebMvcTest` は Service Bean をロードしないため、Controller が依存する Service は `@MockitoBean` 等で埋める必要がある。本 spec では Controller 層を `@SpringBootTest` 主軸とするため、`@WebMvcTest` の出番は `ErrorAdviceTest` のみとする

### 命名・スタイル規則

既存 `SoqlQueryGuardTest` を標準形とし、新規テストもこれに合わせる。

- パッケージ: 対象クラスと同一 (`com.example.sfqry.<domain>` または `com.example.sfqry.<domain>.<sub>`)
- クラス名: `<Class>Test` (例: `QueryServiceTest`、`QueryRequestDtoTest`)
- アサーション: AssertJ (`assertThat` / `assertThatThrownBy` / `assertThatCode`)
- `@DisplayName` を日本語で付与し、テストレポートが日本語で読めるようにする
- メソッド名は英語の動詞句で記述 (`rejectsBlankQuery` 等)
- Mockito 用法は `@MockitoBean` (Spring 文脈) または `Mockito.mock(...)` (純粋単体) のどちらかに統一。`@Spy` / `verify(times)` の濫用はしない

#### パラメータテスト

同じテスト観点で複数の値パターンを確認する場合は、JUnit 5 の `@ParameterizedTest` を優先する。

- 引数の意味づけが単純(プリミティブ単独): `@ValueSource`
- 複数列の固定組: `@CsvSource`
- 複雑な構造・例外型を含む: `@MethodSource`
- `@DisplayName("...{0}...")` のプレースホルダで失敗時にどのパラメータか分かるようにする
- パラメータが `Object[]` の長いリストになる場合や、ケースごとに準備が大きく異なる場合は個別 `@Test` も併用する(可読性優先)

#### ヘルパの境界

過度に複雑な共通化は避ける。

- 同ファイル内の `private static` ヘルパまでは可(`assertMalformed` 等)
- 共通基底クラス(`abstract BaseControllerTest` 等)は作らない
- 別パッケージの `TestUtils` クラスも作らない
- AssertJ の流暢 API で済ませられるなら自前ヘルパを書かない
- 必要になった時点で抽出を検討。先回りで共通化しない

#### アサーション粒度

- JSON レスポンス: `jsonPath` で必要フィールドを検証する形を主とする。重要シナリオのみ full body 比較を 1〜2 件挿入し、形状全体を保証する
- CSV レスポンス: バイト列を `Charset.forName("...")` でデコードした文字列として比較する(行ごとまたは全体)
- DTO 同士の比較: `assertThat(actual).usingRecursiveComparison().isEqualTo(expected)` を活用してフィールド網羅と保守性を両立する

### テストデータの扱い

- Service / Controller テストの期待値計算には、`MockSalesforceClient` が読む `src/main/resources/mock/...` のリソース(CSV / JSON)を**そのまま再利用**する
- 期待値はテスト内でリソースから動的に計算する(行数、ヘッダ、特定フィールド等を読み取って組み立てる)
- テスト固有の fixture を `src/test/resources/` に新設するのは、`MockSalesforceClient` のシナリオで表現できない場合に限る
- 意図: 「mock 側のシナリオを増やしたら期待値もずれる」種の二重メンテを避ける

### テスト実行コマンド

ルート `AGENTS.md` で既に規定済みの以下を引き続き正としする。

| 用途 | コマンド |
|---|---|
| ビルド + 既存テスト実行 | `.\mvnw.cmd -B clean test` |
| パッケージング (テストスキップ) | `.\mvnw.cmd -B clean -DskipTests package` |

テストを追加する場合も、`mvn test` のデフォルトに乗る `**/*Test.java` 命名規則を守る。Maven Surefire の追加設定は導入しない。

### CI での扱い

本 issue では CI 自動化を扱わない。理由:

- リポジトリに `.github/workflows/` がまだ存在しない
- CI 構築は別途 PR 戦略・GitHub Actions 課金・Secrets 設計などの検討が必要
- まず「ローカルで `.\mvnw.cmd -B clean test` が通る状態を維持する」運用ルールから始める

将来 CI を導入する際は別 issue で扱い、本 spec は方針入力資料として参照する。

開発者の運用ルール (本 spec 採択時点での規定):

- バックエンドコード変更を含む PR を出す前に、ローカルで `.\mvnw.cmd -B clean test` を実行して全件 PASS であることを確認する
- 既存テストを意図的に破壊する変更は、テストの修正もセットで PR に含める
- テスト落ちを修正せずにスキップ (`@Disabled`) で逃げない

## 初期導入対象テストケース一覧

本 issue で追加するテストの一覧。優先度 1 → 2 → 3 の順で実装する(パイロット PR でパターン固定 → 横展開 PR の2段階。詳細は「着手順とパイロット実装」節)。

### 優先度 1: 純粋ロジック

#### `SoqlQueryGuardTest` (既存・追加)

既存ケースに加えて以下を追加候補とする:

- `acceptsLeadingWhitespaceBeforeSelect`: `   SELECT Id FROM Account` を許可する
- `rejectsLowercaseDmlVerbs`: `update Account SET ...` のような非 SELECT を拒否する
- `acceptsSemicolonInsideStringLiteral`: `WHERE Name = 'A; B'` を許可する
- `rejectsCommentBeforeFromClause`: `SELECT Id /* x */ FROM Account` を拒否する

#### `CsvEncodingTest` (新規)

`CsvEncoding.fromRequestValue` の入力マッピングを確認する。

- `defaultsToUtf8WhenNullOrBlank`: `null` / `""` / `"  "` で `UTF_8` を返す
- `acceptsCanonicalUtf8AndShiftJisIgnoringCase`: `"utf-8"` / `"UTF-8"` / `"shift_jis"` / `"SHIFT_JIS"` を解決する
- `rejectsUnsupportedEncodingWith400`: `"euc-jp"` で `ApiException("INVALID_CSV_ENCODING", BAD_REQUEST)` をスローする

### 優先度 2: Service 層 (`@ActiveProfiles("mock")`)

#### `QueryServiceTest` (新規)

`MockSalesforceClient` 経由で `QueryService.query` / `exportCsv` の振る舞いを確認する。

- `queryReturnsRowsForKnownSObject`: `SELECT Id FROM Contact` で行が返る
- `queryRejectsNonSelect`: `DELETE FROM Account` で `MALFORMED_QUERY` 例外
- `queryRejectsMultipleStatements`: `SELECT Id FROM Account; SELECT Id FROM Contact` で `MALFORMED_QUERY`
- `exportCsvReturnsHeaderAndCrlfRows`: CSV 文字列の 1 行目がヘッダ、行区切りが `\r\n`
- `auditLogsContainsCallerEmailWhenAuthenticated`: `SessionContext` にログイン情報がある場合、audit ロガーに email が出る (Logback `ListAppender` で捕捉)
- `auditLogsContainsAnonymousWhenNotAuthenticated`: 未認証時は `anonymous`

#### `DescribeServiceTest` (新規)

`MockSalesforceClient` 経由でキャッシュ挙動を確認する。`@SpringBootTest(classes = {DescribeService.class, ...})` で実 Bean を起動する。

- `describeGlobalReturnsSObjects`: モック JSON が読める
- `describeSObjectReturnsFields`: 既知の SObject (`Account` 等) で fields を返す
- `describeGlobalIsCachedAcrossCalls`: 2 回呼ぶと `MockSalesforceClient` 側のリソース読み込みは 1 回 (Mockito spy で検証)
- `describeSObjectKeyedByName`: 同じ sobject 名は再 IO せず、別 sobject 名は再 IO する

### 優先度 3: Controller 層 (`MockMvc` + `@SpringBootTest`)

Controller 層は結合テスト的な性格を持たせ、正常系を主とする。異常系の網羅は `ErrorAdviceTest`(`ApiException → HTTP マップ` を `code` 別に網羅)と各 Service テスト(例外発生条件の網羅)で担う。各 Controller では「経路保証 + API 仕様固定」のために**代表的な異常系を 1〜2 件**だけ含める。

#### `AppLoginControllerTest` (新規)

- `loginWithValidCredentialsReturnsUserInfoAndCreatesSession`: 200・JSON 形状確認・cookie でセッション維持
- `loginWithMissingFieldsReturns401`: email / password が `null` で 401
- `loginWithInvalidCredentialsReturns401`: `INVALID_LOGIN` ApiException 経由で 401

#### `MeControllerTest` (新規)

- `meReturnsCurrentUserWhenAuthenticated`
- `meReturnsUnauthorizedWhenNoSession`

#### `QueryControllerTest` (新規)

- `postQueryReturnsResultJson`
- `postCsvReturnsCsvWithUtf8ByDefault`: `Content-Type: text/csv;charset=UTF-8`、`Content-Disposition` に `query.csv`
- `postCsvWithShiftJisEncodesBodyInWindows31j`: バイト列を `Charset.forName("Windows-31J")` でデコードした結果がモック CSV と一致
- `postCsvWithUnsupportedEncodingReturns400`
- `postQueryWithMalformedSoqlReturns400`: `ErrorAdvice` 経由で `MALFORMED_QUERY` JSON

#### `DescribeControllerTest` (新規)

- `getDescribeGlobalReturns200`
- `getDescribeSObjectReturns200ForKnownObject`
- `getDescribeSObjectReturns404ForUnknownObject`: `MOCK_DATA_NOT_FOUND` → 404

#### `ErrorAdviceTest` (新規・薄め)

`@WebMvcTest` で適当なダミーコントローラから `ApiException` を投げ、`ErrorAdvice` が JSON ボディと HTTP ステータスを正しくマップしていることを確認する。

### スコープ外 (本 spec で明示)

- `SoapSalesforceClient` (実 SOAP 呼び出し)
- `PartnerConnectionFactory` (Salesforce SDK のラッパ。実接続検証は別途手動)
- `SecurityConfig` / `SpaForwardingConfig` (フレームワーク設定)
- `Application#main` (起動確認は `mvn package` で間接的に成立)

## 影響ファイル

### 新規

- `docs/specs/007-backend-test-policy/spec.md` (本ファイル)
- `backend/AGENTS.md`
  - フロント側 `frontend/AGENTS.md` と同じ位置付けで、バックエンド固有のコーディング規約・テスト方針を集約
  - 内容: 「テスト対象判定原則」「モック戦略」「命名・スタイル規則」「実行コマンド」「現時点で CI 対象外」

### 修正

なし。既存コードは無変更。`pom.xml` も `spring-boot-starter-test` を持っているため変更不要。

### バックエンド (テストコード)

「初期導入対象テストケース一覧」優先度 1〜3 を本 issue で追加する。テストファイルは対象クラスと同じパッケージ階層下の `backend/src/test/java/...` に配置する。

### フロントエンド

変更なし。

## 検証手順

本 issue は方針策定 + テストコード実装。検証は以下:

1. **テストが全件 PASS すること**

   ```powershell
   .\mvnw.cmd -B clean test
   ```

   優先度 1〜3 で追加したテストおよび既存 `SoqlQueryGuardTest` がすべて PASS する。

2. **ドキュメント整合性**

   - 本 spec と新規 `backend/AGENTS.md` の内容が一致している
   - ルート `AGENTS.md` の「自動テスト導入は低優先度」「private メソッド対象外」と矛盾していない(本 issue は「明示依頼下での導入」として位置づける)

3. **issue #5 完了条件のチェック**

   - [ ] バックエンド自動テストの導入方針が決まっている (本 spec「方針」節)
   - [ ] 初期導入対象のテストケース一覧が整理されている (本 spec「初期導入対象テストケース一覧」節)
   - [ ] テスト実行コマンドと CI での扱いが決まっている (本 spec「テスト実行コマンド」「CI での扱い」節)
   - [ ] 初期導入対象のテストコードが実装され、`.\mvnw.cmd -B clean test` が全件 PASS している

## 補足: 検討して採用しなかった案

- **本 issue を方針ドキュメントのみのスコープに留める**: 当初は方針確定とテスト実装を別 issue で分けることを検討した(spec 第1版時点)。方針確定の議論を進めた結果、明示依頼として実装まで連続して進めても規模・リスクが過大にならないと判断し、本 issue 内で実装まで完了させるスコープに変更(2026-05-10)。
- **CI (GitHub Actions) を本 issue 内で構築する**: ユーザ確認の結果スコープ外。リポジトリ運用設計 (Secrets / 課金 / 必須レビュー設定) が伴うため別 issue で扱う方が責務が明確。
- **Mockito を全面採用し `MockSalesforceClient` を非推奨化する**: `MockSalesforceClient` は `application-mock` プロファイルで本物の手動動作確認にも使われており、テスト専用に作り直すと二重実装になる。テストでは「まず `MockSalesforceClient` を再利用」「足りない時だけ Mockito」とすることで保守コストを抑える。
- **テストコードを `backend/src/test/groovy` 等で Spock を導入する**: 学習コスト追加・既存 `SoqlQueryGuardTest` (JUnit 5) との混在を避けたい。JUnit 5 + AssertJ で十分表現できる。
- **DTO / record の自動生成メソッドを網羅的にテストする**: 投資対効果が極めて低く、本物のロジック退行検出に貢献しない。スコープ外として明記する。
