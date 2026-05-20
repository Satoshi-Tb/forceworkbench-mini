import { Box } from "@mui/material";
import { ObjectTreePane } from "./workbench/ObjectTreePane";
import { TabbedContentPane } from "./workbench/TabbedContentPane";

export function WorkbenchLayout() {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: { md: "360px minmax(0, 1fr)" },
        gridTemplateRows: {
          xs: "minmax(320px, 42vh) minmax(0, 1fr)",
          md: "minmax(0, 1fr)",
        },
        height: "calc(100vh - 112px)",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <ObjectTreePane />
      <TabbedContentPane />
    </Box>
  );
}
