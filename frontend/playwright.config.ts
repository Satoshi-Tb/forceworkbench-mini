import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(frontendDir, "..", "backend");
const staticDir = path.join(frontendDir, "e2e-static");
const staticUrl = pathToFileURL(`${staticDir}${path.sep}`).href;
const backendCommand =
  process.platform === "win32"
    ? "mvnw.cmd -B spring-boot:run"
    : "./mvnw -B spring-boot:run";

export default defineConfig({
  // E2E テストは単体テストと分離し、Playwright 専用ディレクトリだけを対象にする。
  testDir: "./e2e",
  // backend を共有するため、テスト同士のセッションやサーバ状態の競合を避けて直列実行する。
  fullyParallel: false,
  // CI では一時的な起動遅延やブラウザ要因を吸収する。ローカルでは失敗を即時確認する。
  retries: process.env.CI ? 2 : 0,
  // ローカルでも CI でも読みやすい最小限のテキスト出力にする。
  reporter: "list",
  use: {
    // Spring Boot が配信する SPA と API を同じ origin で検証する。
    baseURL: "http://127.0.0.1:8080",
    // 失敗時だけ trace を残し、通常実行時の生成物を増やさない。
    trace: "retain-on-failure",
  },
  webServer: {
    // Playwright から Spring Boot backend を application-mock プロファイルで起動する。
    command: backendCommand,
    // Maven wrapper は backend ディレクトリを起点に実行する。
    cwd: backendDir,
    env: {
      ...process.env,
      // 実 Salesforce 接続を使わず、mock データだけで E2E を完結させる。
      SPRING_PROFILES_ACTIVE: "mock",
      // test:e2e 前にビルドした静的ファイルを Spring Boot から配信する。
      SPRING_WEB_RESOURCES_STATIC_LOCATIONS: staticUrl,
    },
    // ローカルでは既存の 8080 サーバを再利用し、CI では毎回 fresh に起動する。
    reuseExistingServer: !process.env.CI,
    // Maven/Spring Boot 初回起動を考慮して長めに待つ。
    timeout: 120_000,
    // SPA のログイン画面が返るまで webServer 起動完了とみなさない。
    url: "http://127.0.0.1:8080/login",
  },
  projects: [
    {
      // テストターゲットは Chromium のみ
      name: "chromium",
      // Playwright 標準の Desktop Chrome 相当の viewport/userAgent を使う。
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
