# バックエンド開発ルール

## テスト方針

- テスト対象は public なサービスメソッド、Controller API、純粋ロジックを中心にする。
- private メソッド、DTO / record の自動生成メソッド、Spring や Salesforce SDK 自体の挙動は直接テストしない。
- `SoapSalesforceClient` の実 SOAP 呼び出しは外部依存のため自動テスト対象外とする。
- Controller テストは `@SpringBootTest` + `@AutoConfigureMockMvc` を主軸とし、Spring MVC / Security / CSRF / Controller / Service までの経路を確認する。
- MockMvc は実ポートやネットワーク通信を使わない。実 HTTP 環境やブラウザ操作の確認は Playwright E2E 側で扱う。

## モック戦略

- Salesforce 依存は `SalesforceClient` を境界とする。
- 正常系と既存 mock シナリオで表現できるケースは `@ActiveProfiles("mock")` と `MockSalesforceClient` を使う。
- Controller テストでは必要に応じて `@ActiveProfiles({"mock", "test"})` を使い、`mock` で `MockSalesforceClient` を有効化し、`test` でテスト用プロパティを固定する。
- `MockSalesforceClient` で表現できない例外パスだけ、`@MockitoBean` などで限定的に差し替える。

## テストスタイル

- JUnit 5 + AssertJ を標準とする。
- `@DisplayName` は日本語で記載する。
- メソッド名は英語の動詞句で記載する。
- 同一観点の値違いが複数ある場合は `@ParameterizedTest` を優先する。1 ケースだけなら通常の `@Test` で素直に書く。
- 共通基底クラスや汎用 `TestUtils` は作らない。複数 Controller テストで実際に重複するログイン / CSRF 処理などは、目的を絞った `testsupport` helper に限って共通化する。
- `@WebMvcTest` は `ErrorAdvice` のように MVC の一部だけを薄く確認したい場合に限定する。Security / CSRF がテスト目的でない場合は `@AutoConfigureMockMvc(addFilters = false)` で意図をコメントする。

## 実行コマンド

```powershell
.\mvnw.cmd -B clean test
```

CI 自動化は現時点では本 issue の対象外とし、別 issue で扱う。
