import { describe, expect, it } from "vitest";
import { ApiError } from "../api/client";
import { getApiErrorMessage } from "./apiErrorMessage";

describe("APIエラーメッセージ変換", () => {
  it("ApiError のメッセージを返す", () => {
    const error = new ApiError("INVALID_FIELD", "項目が不正です", 400);

    expect(getApiErrorMessage(error, "fallback")).toBe("項目が不正です");
  });

  it.each([new Error("network error"), "error", null])(
    "ApiError 以外ではフォールバックメッセージを返す",
    (error) => {
      expect(getApiErrorMessage(error, "fallback")).toBe("fallback");
    },
  );
});
