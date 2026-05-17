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
  const loginMutation = useLogin();
  const error = loginMutation.error ? "ログインに失敗しました" : null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    loginMutation.mutate(
      { email, password },
      {
        onSuccess: () => {
          void navigate({ to: "/workbench" });
        },
      },
    );
  };

  return (
    <Box sx={{ maxWidth: 420, mx: "auto", mt: 8 }}>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack component="form" spacing={2} onSubmit={handleSubmit}>
          <Typography variant="h5" component="h1">
            ログイン
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="メールアドレス"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            fullWidth
          />
          <TextField
            label="パスワード"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
