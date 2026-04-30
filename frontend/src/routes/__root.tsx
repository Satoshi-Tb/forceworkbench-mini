import {
  AppBar,
  Box,
  Button,
  Container,
  Toolbar,
  Typography,
} from "@mui/material";
import {
  Link,
  Outlet,
  createRootRouteWithContext,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { logout, me } from "../api/auth";

type RouterContext = {
  queryClient: QueryClient;
};

export const rootRoute = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ location }) => {
    const user = await me();
    if (location.pathname === "/login") return;
    if (!user) {
      throw redirect({ to: "/login" });
    }
  },
  component: RootLayout,
});

function RootLayout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    await navigate({ to: "/login" });
  };

  return (
    <Box>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar variant="dense">
          <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
            Force Workbench Mini
          </Typography>
          <Button component={Link} to="/query" color="inherit">
            SOQL
          </Button>
          <Button component={Link} to="/describe" color="inherit">
            オブジェクト詳細
          </Button>
          <Button onClick={handleLogout} color="inherit">
            ログアウト
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
