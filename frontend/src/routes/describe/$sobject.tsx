import { Stack, Typography } from "@mui/material";
import { createRoute } from "@tanstack/react-router";
import { FieldTable } from "../../components/FieldTable";
import { useDescribeSObject } from "../../hooks/useDescribeSObject";
import { rootRoute } from "../__root";

export const describeSObjectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/describe/$sobject",
  component: DescribeSObjectPage,
});

function DescribeSObjectPage() {
  const { sobject } = describeSObjectRoute.useParams();
  const { data, isLoading } = useDescribeSObject(sobject);

  return (
    <Stack spacing={2}>
      <Typography variant="h5" component="h1">
        {sobject}
      </Typography>
      <FieldTable describe={data} loading={isLoading} />
    </Stack>
  );
}
