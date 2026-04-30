import { createRoute } from "@tanstack/react-router";
import { DescribeWorkspace } from "../../components/DescribeWorkspace";
import { rootRoute } from "../__root";

export const describeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/describe",
  component: DescribePage,
});

function DescribePage() {
  return <DescribeWorkspace />;
}
