import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("ログイン画面で空送信時に入力エラーを表示する", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "ログイン" }).click();

  await expect(
    page.getByText("メールアドレスを入力してください"),
  ).toBeVisible();
  await expect(page.getByText("パスワードを入力してください")).toBeVisible();
});

test("SOQL実行からページ送り・CSVダウンロード・Describe表示・ログアウトまで正常に操作できる", async ({
  page,
}) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "SObject" })).toBeVisible();

  await page.getByRole("button", { name: "新規SOQL" }).click();
  await selectAutocompleteOption(page, "オブジェクト", "Account", "Account");
  await expect(page.getByLabel("フィールド")).toBeEnabled();
  await selectAutocompleteOption(page, "フィールド", "Id", /Account ID\s+Id/);
  await selectAutocompleteOption(
    page,
    "フィールド",
    "Name",
    /Account Name\s+Name/,
  );

  await page.getByLabel("LIMIT").fill("0");
  await page.getByRole("button", { name: "実行" }).click();
  await expect(
    page.getByText("LIMIT は正の整数で入力してください"),
  ).toBeVisible();

  await page.getByLabel("LIMIT").fill("");
  await page.getByRole("button", { name: "実行" }).click();
  await expect(
    page.getByRole("gridcell", { name: "Acme Corporation" }),
  ).toBeVisible();
  await expect(page.getByText(/取得結果が\s*2,000\s*件/)).toBeVisible();

  await page.getByRole("button", { name: /go to next page/i }).click();
  await expect(
    page.getByRole("gridcell", { name: "Northern Trail Outfitters" }),
  ).toBeVisible();

  await selectCsvEncoding(page, "UTF-8");
  const utf8Buffer = await downloadCsv(page);
  const utf8Text = utf8Buffer.toString("utf8");
  expect(utf8Text).toContain("Burlington Textiles");
  expect(utf8Text).toContain("Grand Hotels & Resorts");

  await selectCsvEncoding(page, "Shift_JIS");
  const shiftJisBuffer = await downloadCsv(page);
  const shiftJisText = new TextDecoder("shift_jis").decode(shiftJisBuffer);
  expect(shiftJisText).toContain("東京サンプル株式会社");

  await page.getByLabel("検索").fill("Account");
  await page
    .locator(".MuiListItemButton-root")
    .filter({ hasText: "Account" })
    .first()
    .dblclick();
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
  await expect(page.getByText("基本情報")).toBeVisible();

  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
});

// mock プロファイルの既定ユーザーでログインする。認証後のワークベンチ操作を行う E2E でだけ使う。
async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill("test@example.com");
  await page.getByLabel("パスワード").fill("test");
  await page.getByRole("button", { name: "ログイン" }).click();
}

// MUI Autocomplete の入力と候補選択をまとめる。単一候補を選ぶフィールド操作に限定する。
async function selectAutocompleteOption(
  page: Page,
  label: string,
  filterText: string,
  optionName: string | RegExp,
): Promise<void> {
  const input = page.getByRole("combobox", { name: label });
  await input.click();
  await input.fill(filterText);
  await page.getByRole("option", { name: optionName }).click();
}

// CSV 文字コード Select の選択をまとめる。E2E で検証対象にする 2 種類だけを受け付ける。
async function selectCsvEncoding(
  page: Page,
  encoding: "UTF-8" | "Shift_JIS",
): Promise<void> {
  await page.getByLabel("CSV文字コード").click();
  await page.getByRole("option", { name: encoding }).click();
}

// CSV ボタン操作からダウンロードファイルの読み取りまでを扱う。
// CSV 内容を文字コード別に検証する E2E でだけ使う。
async function downloadCsv(page: Page): Promise<Buffer> {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "CSV" }).click(),
  ]);
  const path = await download.path();
  if (!path) {
    throw new Error("Download path is unavailable");
  }
  return readFile(path);
}
