import { createRoute } from "@tanstack/react-router";
import { DescribeWorkspace } from "../../components/DescribeWorkspace";
import { rootRoute } from "../__root";

export const describeSObjectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/describe/$sobject",
  component: DescribeSObjectPage,
});

function DescribeSObjectPage() {
  const { sobject } = describeSObjectRoute.useParams();
  return <DescribeWorkspace sobject={sobject} />;
}
