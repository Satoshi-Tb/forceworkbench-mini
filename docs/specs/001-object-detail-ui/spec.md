# オブジェクト詳細 UI 改善 修正方針

## 概要

参照情報画面を、左パネルでオブジェクトを選び、右側で `概要 / 項目 / リレーション` の3タブを切り替える Workbench 風レイアウトに刷新する。詳細仕様は `object-reference-redesign.md` 参照。

## 全体方針

- **Partner SOAP describe で取得可能な情報のみを対象とする**。SOAP で取れない属性 (`プラットフォーム暗黙共有 / 拡張ルール / 変更追跡 / 履歴追跡 / 検索レイアウト / レコードID形式 / マスターレコードID項目` 等) は表示しない
- 仕様書 `object-reference-redesign.md` 記載のうち、SOAP describe で取れないものはすべてスコープ外

## 現状とのギャップ

### 現状

- ルートが2つに分かれている: `/describe` (オブジェクト一覧) → `/describe/$sobject` (詳細)
- 詳細画面はタイトル + `項目` 表 + `子リレーション` 表の縦並び
- `ObjectPicker` はフラットなリスト (検索なし、標準/カスタム分類なし、件数表示なし)
- バックエンドDTOが最小限:
  - `SObjectSummaryDto(name, label)` — `custom` フラグ無し
  - `FieldDto(name, label, type)` — 詳細属性なし
  - `DescribeSObjectDto(name, label, fields, childRelationships)` — 概要タブ用属性なし

### 目指す状態

- ルートは `/describe`(または `/describe/$sobject`) の単一画面で、左右2ペインレイアウト
- 左パネル: 検索ボックス + 標準/カスタム分類 + 件数バッジ
- 右ペイン: ヘッダ(オブジェクト名・バッジ・ボタン) + 3タブ(概要/項目/リレーション)
- 項目タブ内はさらに左右2ペイン (項目一覧 + 選択項目の全属性詳細)

## 影響範囲

### バックエンド

- `describe/dto/DescribeGlobalDto.java` (`SObjectSummaryDto` に `custom` 追加)
- `describe/dto/FieldDto.java` (項目詳細タブ用に属性多数追加)
- `describe/dto/DescribeSObjectDto.java` (概要タブ用に属性追加)
- `common/SoapSalesforceClient.java` (上記DTO拡張に合わせ `DescribeSObjectResult` / `Field` から属性転写)
- `common/MockSalesforceClient.java` (同上、モック値追加)
- ※ `@Cacheable` のキャッシュは形式変更のため再起動で無効化される。コード変更不要

### フロントエンド

- `api/describe.ts` (型定義をDTOに合わせ拡張)
- `routes/describe/index.tsx` (2ペインレイアウトに刷新)
- `routes/describe/$sobject.tsx` (削除 or `index.tsx` に統合)
- `components/ObjectPicker.tsx` (検索・分類・件数バッジ対応に刷新)
- `components/FieldTable.tsx` (項目タブ用に簡素化、または分割)
- 新規: 概要タブ / 項目タブ(2ペイン) / リレーションタブ のコンポーネント

## バックエンドDTO拡張

### `SObjectSummaryDto`

`custom: boolean` を追加。`DescribeGlobalSObjectResult#isCustom()` から取得。

### `DescribeSObjectDto` (概要タブ用)

仕様書の「概要タブ」項目に対応する属性を追加。SOAP `DescribeSObjectResult` から取得可能なものに限定する。

| 表示名 | 属性 | 取得元 |
|---|---|---|
| API 参照名 | `name` | (既存) |
| ラベル | `label` | (既存) |
| カスタム | `custom` | `isCustom()` |
| 検索で使用可能 | `searchable` | `isSearchable()` |
| レポートで使用可能 | `layoutable` | `isLayoutable()` (代替) |
| 取得可能 | `retrieveable` | `isRetrieveable()` |
| 作成可能 | `createable` | `isCreateable()` |
| 更新可能 | `updateable` | `isUpdateable()` |
| 削除可能 | `deletable` | `isDeletable()` |
| マージ可能 | `mergeable` | `isMergeable()` |
| クエリ可能 | `queryable` | `isQueryable()` |
| トリガー可能 | `triggerable` | `isTriggerable()` |
| 名前空間プレフィックス | `keyPrefix` | `getKeyPrefix()` (3桁プレフィックス) |

SOAP describe から取得できない属性 (`プラットフォーム暗黙共有 / 拡張ルールで使用可能 / 変更を追跡 / 履歴追跡 / 検索レイアウト / レコードID形式 / マスターレコードID項目`) はスコープ外。

### `FieldDto` (項目詳細タブ用)

仕様書「右ペイン: 項目詳細」記載の全属性を追加。Salesforce `Field` から取得可能なもの:

| 仕様の表示名 | 属性 | 取得元 |
|---|---|---|
| 名前 | `name` | (既存) |
| ラベル | `label` | (既存) |
| 型 | `type` | (既存) |
| 参照先 | `referenceTo: List<String>` | `getReferenceTo()` |
| relationshipName | `relationshipName` | `getRelationshipName()` |
| soapType | `soapType` | `getSoapType().name()` |
| 長さ | `length` | `getLength()` |
| バイト長 | `byteLength` | `getByteLength()` |
| 桁数 | `digits` | `getDigits()` |
| 小数点以下桁数 | `precision` | `getPrecision()` |
| scale | `scale` | `getScale()` |
| 必須 (nillable) | `nillable` | `isNillable()` |
| 作成可能 | `createable` | `isCreateable()` |
| 更新可能 | `updateable` | `isUpdateable()` |
| デフォルト値 | `defaultedOnCreate` | `isDefaultedOnCreate()` |
| 計算項目 | `calculated` | `isCalculated()` |
| 自動採番 | `autoNumber` | `isAutoNumber()` |
| AI 予測項目 | `aiPredictionField` | `isAiPredictionField()` |
| 集計可能 | `aggregatable` | `isAggregatable()` |
| 報告可能 | `groupable` | `isGroupable()` |
| 絞り込み可能 | `filterable` | `isFilterable()` |
| ソート可能 | `sortable` | `isSortable()` |
| ケースセンシティブ | `caseSensitive` | `isCaseSensitive()` |
| 検索プレフィックス | `searchPrefilterable` | `isSearchPrefilterable()` |
| ID ルックアップ | `idLookup` | `isIdLookup()` |
| 名前項目 | `nameField` | `isNameField()` |
| 名前参照 | `namePointing` | `isNamePointing()` |
| ポリモーフィック外部キー | `polymorphicForeignKey` | `isPolymorphicForeignKey()` |
| カスタム項目 | `custom` | `isCustom()` |
| System 項目 | `system` | (注: WSC v64で未提供。`isCustom()`の補集合相当か `name` が `__c` で終わるかで判定) |
| 非推奨・非表示 | `deprecatedAndHidden` | `isDeprecatedAndHidden()` |
| 制限付き選択リスト | `restrictedPicklist` | `isRestrictedPicklist()` |
| 許可対象 | `permissionable` | `isPermissionable()` |
| 一意 | `unique` | `isUnique()` |
| 読み取り専用 | (派生) | `!createable && !updateable` (専用フラグなし) |

WSC のバージョンで取れない属性は DTO から除外し、フロント側でも表示しない。実装時に欠けたものは本ファイルに追記する。

## フロントエンド構成

### ルーティング方針

`/describe` と `/describe/$sobject` の両方で同じコンポーネントを描画する。`$sobject` 未指定時は左パネルだけ表示し、右ペインは「オブジェクトを選択してください」のプレースホルダ。選択時は `navigate({ to: '/describe/$sobject', params })` で URL を更新する。

### 左パネル仕様

- 上部に検索 `TextField` (オブジェクトの `name` または `label` でフィルタ)
- セクション見出し: `標準オブジェクト (N)` / `カスタムオブジェクト (M)` (ヘッダ右に件数バッジ)
- 件数 `N`, `M` は `describeGlobal` レスポンスの `custom` フラグで分類しクライアント側で集計
- 各行は `label` を主表示、`name` を副表示。アイコン無し
- 選択行は薄い青背景

### 右ヘッダ

- 大きい `Typography` でオブジェクト名 (`label` または `name`)
- `Chip` で `標準オブジェクト` / `カスタムオブジェクト` バッジ

(仕様書記載の「オブジェクト情報を表示」ボタンは実装しない)

### 概要タブ

- 「基本情報」見出し + key-value リスト (定義リスト or `Stack` で2列レイアウト)
- 取得不可属性は表示しない
- 「説明」セクションは情報ソース不在のため実装しない

### 項目タブ

- 右ペイン内を `Grid` で左右分割 (左:項目一覧 / 右:項目詳細)
- 左: `DataGrid` で `name / label / type / 参照先 / 必須` の5列
  - 「参照先」は `referenceTo` をカンマ区切りで並列表示 (例: polymorphic な `OwnerId` なら `User, Group`)
  - 「必須」は `!nillable`
  - ページャー / フッター / `rowsPerPage` を非表示 (`hideFooter`)
  - 行クリックで選択
- 右: 選択行の全属性を key-value で表示。`Paper` + `dl` 風レイアウト


### リレーションタブ

- 既存の子リレーション表 (`childSObject / field / relationshipName`) を流用
- ページャー非表示
- 親リレーション表示などの追加要件は本フェーズでは扱わない

## 実装ステップ

1. **バックエンドDTO/Mapper拡張** (`*Dto.java` + `SoapSalesforceClient` + `MockSalesforceClient`)
2. **フロントAPI型定義拡張** (`api/describe.ts`)
3. **左パネル刷新** (`ObjectPicker` に検索・分類・件数を実装)
4. **右ペイン骨格** (ヘッダ + タブ切替) を `routes/describe/index.tsx` に実装、`$sobject.tsx` を統合 or 削除
5. **概要タブ** 実装
6. **項目タブ** (2ペイン構造 + 項目一覧 + 項目詳細) 実装
7. **リレーションタブ** 実装 (既存 `FieldTable` の子リレーション部を抽出)
8. **動作確認** (mock + real 両プロファイル)

## 検証

- `cd frontend && npm run lint && npm run build && npm run test`
- バックエンド `cd backend && ./mvnw test` (テスト無しでも compile 確認)
- 手動: `Account` 選択 → 各タブで仕様書のキャプチャに近い表示になることを確認
- 手動: 検索ボックスでフィルタリング動作確認
- 手動: 標準/カスタムの件数が正しく表示されること

## 確認事項 (まとめ)

| ID | 確認内容 | 結論 |
|---|---|---|
| Q1 | 概要タブで SOAP describe から取れない属性の扱い | **解消**: スコープ外。表示しない |
| Q2 | `FieldDto` で WSC が提供しない属性の扱い | **解消**: DTO から除外。表示しない |
| Q3 | ルーティング方針 | **解消**: `/describe/$sobject` オプショナル方式 |
| Q4 | 「オブジェクト情報を表示」ボタンの動作 | **解消**: 実装しない (削除) |
| Q5 | 概要タブの「説明」セクション | **解消**: 実装しない (情報ソース不在) |
| Q6 | 項目一覧の「参照先」列の polymorphic 表記 | **解消**: `User, Group` のカンマ区切り並列表示 |
| Q7 | リレーションタブの追加要件 | **解消**: 現状仕様 (3列) のまま、本フェーズでは改善しない |

## 補足: スコープ外と判断したもの

- レスポンシブ対応 (モバイル幅で2ペインを縦積みにする等) — 既存サイトもPC前提のため
- 項目一覧の仮想スクロール — MUI DataGrid の標準動作で1000件は十分扱える
- バックエンドのキャッシュ無効化処理 — DTO形式変更時はサーバ再起動で対応する運用
- SOAP describe で取れない属性 (概要タブの一部 / `Field` の一部)
- 概要タブ末尾の「説明」セクション
- 右ヘッダの「オブジェクト情報を表示」ボタン
- リレーションタブの仕様改善 (親リレーション / 追加属性) — 後続フェーズへ
