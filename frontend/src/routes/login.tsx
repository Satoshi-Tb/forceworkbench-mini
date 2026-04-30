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
import { login } from "../api/auth";
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      await navigate({ to: "/query" });
    } catch {
      setError("ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 420, mx: "auto", mt: 8 }}>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack component="form" spacing={2} onSubmit={handleSubmit}>
          <Typography variant="h5" component="h1">
            Login
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            fullWidth
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            fullWidth
          />
          <Button type="submit" variant="contained" disabled={loading}>
            Login
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
