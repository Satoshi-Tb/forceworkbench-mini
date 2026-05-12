# バックエンド開発ルール

## テスト方針

- テスト対象は「純粋ロジック / Service クラス / Controller クラス」の 3 カテゴリのいずれかに 1 つだけ分類する。詳細は後述「テスト対象カテゴリ」を参照。
- private メソッド、DTO / record の自動生成メソッド、Spring や Salesforce SDK 自体の挙動は直接テストしない。
- Spring の AOP 経由で提供される横断機能（`@Cacheable` / `@Transactional` / `@Async` など）の動作はフレームワーク側の責務とし、自動テストでは検証しない。
- `SoapSalesforceClient` の実 SOAP 呼び出しは外部依存のため自動テスト対象外とする。

## テスト対象カテゴリ

### 1. 純粋ロジック

以下を**全て**満たすクラス / static メソッド / メソッド:

- 外部 I/O（HTTP / DB / ファイル / Salesforce SDK / 環境変数）に一切依存しない
- Spring DI コンテナを起動しなくても `new` または直接 static 呼び出しでテストできる
- 同じ入力に対して常に同じ出力を返す（時刻 / 乱数 / グローバル可変状態に依存しない）

例: `SoqlQueryGuard`, `CsvEncoding`
非例: `DescribeService`(`SalesforceClient` 経由 → カテゴリ 2), `*Dto` / `record`(自動生成 → 対象外), `SoapSalesforceClient`(実 SOAP → 対象外)

### 2. Service クラス

対象: `@Service` で登録されるドメイン層のクラス（infra 層の `SalesforceClient` 実装は除く）。

- 単位: クラス単位で `*ServiceTest` を作成する。
- 起動方式: Spring コンテナを起動せず、コンストラクタ注入による単体テストを基本とする (`new XxxService(mockClient, ...)`)。
  - 理由: AOP 機能を検証対象外としたため、Spring プロキシは不要。
- 境界の置換: `SalesforceClient` は `MockSalesforceClient` を直接 `new` して渡すことを基本とする。詳細は「モック戦略」節を参照。

### 3. Controller クラス

- `@SpringBootTest` + `@AutoConfigureMockMvc` を主軸とし、Spring MVC / Security / CSRF / Controller / Service までの経路を確認する。
- MockMvc は実ポートやネットワーク通信を使わない。実 HTTP 環境やブラウザ操作の確認は Playwright E2E 側で扱う。
- `@WebMvcTest` は `ErrorAdvice` のように MVC の一部だけを薄く確認したい場合に限定する。Security / CSRF がテスト目的でない場合は `@AutoConfigureMockMvc(addFilters = false)` で意図をコメントする。

## モック戦略

- Salesforce 依存は `SalesforceClient` を境界とする。
- **Service テスト**: コンストラクタ注入で `MockSalesforceClient` を直接 `new` して渡すことを基本とする。Spring も `@MockitoBean` も使わない。
  - 例: `new QueryService(new MockSalesforceClient(new ObjectMapper(), "test@example.com", "test"), sessionContext)`
  - 利点: DTO/record の手組みを避けられ、Controller テストと同じ fixture を共有できる。
  - 例外として `Mockito.mock(SalesforceClient.class)` または `Mockito.spy(mockSalesforceClient)` を使ってよいのは、以下のいずれかに該当する場合のみ。
    - `SalesforceClient` が例外を投げた場合の分岐を検証したい
    - 呼び出し引数 / 回数 (`verify`) を検証したい
    - `MockSalesforceClient` が表現していないシナリオを検証したい
- **Controller テスト**: Spring 起動が必須のため、以下を使い分ける。
  - 正常系の幅広いシナリオは `@ActiveProfiles({"mock", "test"})` を使い、`mock` で `MockSalesforceClient` を有効化し、`test` でテスト用プロパティを固定する。
  - `MockSalesforceClient` で表現できない例外パスだけ `@MockitoBean` で限定的に差し替える。

### `MockSalesforceClient` 拡張の禁止

- `MockSalesforceClient` は本番コードとして `@Service` 登録されている実装である。テスト都合でロジック（例: 特定 SObject 名で例外を投げる分岐）を追加してはならない。
- テスト固有のシナリオが必要な場合は、上記の例外ルールに従い `Mockito.mock` / `Mockito.spy` で対応する。
- fixture (`src/main/resources/mock/**`) の追加・更新は、本番 mock プロファイルとしての挙動が許容できる範囲に限る。

## テストスタイル

- JUnit 5 + AssertJ を標準とする。
- `@DisplayName` は日本語で記載する。
- メソッド名は英語の動詞句で記載する。
- 同一観点の値違いが複数ある場合は `@ParameterizedTest` を優先する。1 ケースだけなら通常の `@Test` で素直に書く。
- 共通基底クラスや汎用 `TestUtils` は作らない。複数 Controller テストで実際に重複するログイン / CSRF 処理などは、目的を絞った `testsupport` helper に限って共通化する。

## 実行コマンド

```powershell
.\mvnw.cmd -B clean test
```
