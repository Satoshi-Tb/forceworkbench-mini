import { z } from "zod";

export const loginFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "メールアドレスを入力してください")
    .email("メールアドレスの形式で入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

export type LoginFormInput = z.input<typeof loginFormSchema>;
export type LoginFormValues = z.infer<typeof loginFormSchema>;

export type LoginFormErrors = Partial<Record<keyof LoginFormInput, string>>;

type LoginFormParseResult =
  | { success: true; data: LoginFormValues }
  | { success: false; errors: LoginFormErrors };

export function parseLoginForm(input: LoginFormInput): LoginFormParseResult {
  const result = loginFormSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.issues.reduce<LoginFormErrors>((errors, issue) => {
      const fieldName = issue.path[0];
      if (fieldName === "email" || fieldName === "password") {
        errors[fieldName] ??= issue.message;
      }
      return errors;
    }, {}),
  };
}
