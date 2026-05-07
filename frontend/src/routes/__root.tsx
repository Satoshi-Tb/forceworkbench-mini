import {
  AppBar,
  Box,
  Button,
  Container,
  Toolbar,
  Typography,
} from "@mui/material";
import type { QueryClient } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  createRootRouteWithContext,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { Provider } from "jotai";
import {
  currentUserQueryOptions,
  useCurrentUser,
} from "../hooks/useCurrentUser";
import { useLogout } from "../hooks/useLogout";

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
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { data: user } = useCurrentUser();
  const logoutMutation = useLogout();
  const queryActive = pathname.startsWith("/query");
  const describeActive = pathname.startsWith("/describe");

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        void navigate({ to: "/login" });
      },
    });
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
              <Button
                component={Link}
                to="/query"
                color="inherit"
                sx={navButtonSx(queryActive)}
              >
                クエリ
              </Button>
              <Button
                component={Link}
                to="/describe"
                color="inherit"
                sx={navButtonSx(describeActive)}
              >
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

function navButtonSx(active: boolean) {
  return {
    bgcolor: active ? "action.selected" : undefined,
    color: active ? "primary.main" : undefined,
    fontWeight: active ? 700 : 500,
  };
}
