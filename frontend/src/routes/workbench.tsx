import { createRoute } from "@tanstack/react-router";
import { WorkbenchLayout } from "../components/WorkbenchLayout";
import { rootRoute } from "./__root";

export const workbenchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workbench",
  component: WorkbenchPage,
});

function WorkbenchPage() {
  return <WorkbenchLayout />;
}
