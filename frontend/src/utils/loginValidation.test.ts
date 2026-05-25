import { describe, expect, it } from "vitest";
import { loginFormSchema, parseLoginForm } from "./loginValidation";

describe("ログインフォームスキーマ", () => {
  it("有効な入力を受け付け、メールアドレスを trim する", () => {
    expect(
      loginFormSchema.parse({
        email: " test@example.com ",
        password: "secret",
      }),
    ).toEqual({
      email: "test@example.com",
      password: "secret",
    });
  });

  it.each([
    ["", "メールアドレスを入力してください"],
    ["not-email", "メールアドレスの形式で入力してください"],
  ])("不正なメールアドレス %s を拒否する", (email, expectedMessage) => {
    const result = loginFormSchema.safeParse({
      email,
      password: "secret",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(expectedMessage);
    }
  });

  it("空のパスワードを拒否する", () => {
    const result = loginFormSchema.safeParse({
      email: "test@example.com",
      password: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "パスワードを入力してください",
      );
    }
  });
});

describe("ログインフォーム解析", () => {
  it("フィールドごとのエラーを返す", () => {
    expect(parseLoginForm({ email: "", password: "" })).toEqual({
      success: false,
      errors: {
        email: "メールアドレスを入力してください",
        password: "パスワードを入力してください",
      },
    });
  });
});
