import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useLogin } from "../hooks/useLogin";
import {
  getLoginFormErrors,
  loginFormSchema,
  type LoginFormErrors,
} from "../utils/loginValidation";
import { rootRoute } from "./__root";

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formErrors, setFormErrors] = useState<LoginFormErrors>({});
  const loginMutation = useLogin();
  const error = loginMutation.error ? "ログインに失敗しました" : null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const input = { email, password };
    const result = loginFormSchema.safeParse(input);
    if (!result.success) {
      setFormErrors(getLoginFormErrors(input));
      return;
    }

    setFormErrors({});
    loginMutation.mutate(result.data, {
      onSuccess: () => {
        void navigate({ to: "/workbench" });
      },
    });
  };

  return (
    <Box sx={{ maxWidth: 420, mx: "auto", mt: 8 }}>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack component="form" spacing={2} onSubmit={handleSubmit} noValidate>
          <Typography variant="h5" component="h1">
            ログイン
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="メールアドレス"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setFormErrors((current) => ({ ...current, email: undefined }));
            }}
            error={Boolean(formErrors.email)}
            helperText={formErrors.email ?? " "}
            required
            fullWidth
          />
          <TextField
            label="パスワード"
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setFormErrors((current) => ({
                ...current,
                password: undefined,
              }));
            }}
            error={Boolean(formErrors.password)}
            helperText={formErrors.password ?? " "}
            required
            fullWidth
          />
          <Button
            type="submit"
            variant="contained"
            disabled={loginMutation.isPending}
          >
            ログイン
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
