import { Stack, Typography } from "@mui/material";
import { createRoute } from "@tanstack/react-router";
import { ObjectPicker } from "../../components/ObjectPicker";
import { useDescribeGlobal } from "../../hooks/useDescribeGlobal";
import { rootRoute } from "../__root";

export const describeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/describe",
  component: DescribePage,
});

function DescribePage() {
  const { data, isLoading } = useDescribeGlobal();

  return (
    <Stack spacing={2}>
      <Typography variant="h5" component="h1">
        Describe
      </Typography>
      <ObjectPicker objects={data?.sobjects ?? []} loading={isLoading} />
    </Stack>
  );
}
