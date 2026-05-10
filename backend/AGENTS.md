# バックエンド開発ルール

## テスト方針

- ユーザから明示依頼がある場合のみ、新規テストコードを追加する。
- テスト対象は public なサービスメソッド、Controller API、純粋ロジックを中心にする。
- private メソッド、DTO / record の自動生成メソッド、Spring や Salesforce SDK 自体の挙動は直接テストしない。
- `SoapSalesforceClient` の実 SOAP 呼び出しは外部依存のため自動テスト対象外とする。

## モック戦略

- Salesforce 依存は `SalesforceClient` を境界とする。
- 正常系と既存 mock シナリオで表現できるケースは `@ActiveProfiles("mock")` と `MockSalesforceClient` を使う。
- `MockSalesforceClient` で表現できない例外パスだけ、`@MockitoBean` などで限定的に差し替える。

## テストスタイル

- JUnit 5 + AssertJ を標準とする。
- `@DisplayName` は日本語で記載する。
- メソッド名は英語の動詞句で記載する。
- 同一観点の値違いは `@ParameterizedTest` を優先する。
- 共通基底クラスや汎用 `TestUtils` は作らず、必要な補助は同一テストクラス内に留める。

## 実行コマンド

```powershell
.\mvnw.cmd -B clean test
```

CI 自動化は現時点では本 issue の対象外とし、別 issue で扱う。
