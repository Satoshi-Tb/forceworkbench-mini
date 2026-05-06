import {
  AppBar,
  Box,
  Button,
  Container,
  Toolbar,
  Typography,
} from "@mui/material";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  createRootRouteWithContext,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { Provider } from "jotai";
import { logout } from "../api/auth";
import {
  currentUserQueryKey,
  currentUserQueryOptions,
  useCurrentUser,
} from "../hooks/useCurrentUser";

type RouterContext = {
  queryClient: QueryClient;
};

export const rootRoute = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.fetchQuery(currentUserQueryOptions);
    if (location.pathname === "/login") return;
    if (!user) {
      throw redirect({ to: "/login" });
    }
  },
  component: RootLayout,
});

function RootLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();

  const handleLogout = async () => {
    await logout();
    queryClient.setQueryData(currentUserQueryKey, null);
    await navigate({ to: "/login" });
  };

  return (
    <Box>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar variant="dense">
          <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
            Force Workbench Mini
          </Typography>
          {user && (
            <>
              <Button component={Link} to="/query" color="inherit">
                クエリ
              </Button>
              <Button component={Link} to="/describe" color="inherit">
                参照情報
              </Button>
              <Button onClick={handleLogout} color="inherit">
                ログアウト
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>
      <Container
        maxWidth={false}
        sx={{ maxWidth: 1680, mx: "auto", px: 4, py: 3 }}
      >
        <Provider key={user?.userId ?? "anonymous"}>
          <Outlet />
        </Provider>
      </Container>
    </Box>
  );
}
