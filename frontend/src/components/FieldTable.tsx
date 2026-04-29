import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import type { DescribeSObject } from "../api/describe";

const fieldColumns: GridColDef[] = [
  { field: "name", headerName: "Name", flex: 1, minWidth: 160 },
  { field: "label", headerName: "Label", flex: 1, minWidth: 160 },
  { field: "type", headerName: "Type", flex: 1, minWidth: 120 },
];

const childColumns: GridColDef[] = [
  { field: "childSObject", headerName: "Child Object", flex: 1, minWidth: 160 },
  { field: "field", headerName: "Field", flex: 1, minWidth: 160 },
  {
    field: "relationshipName",
    headerName: "Relationship",
    flex: 1,
    minWidth: 160,
  },
];

export function FieldTable({
  describe,
  loading,
}: {
  describe: DescribeSObject | undefined;
  loading: boolean;
}) {
  if (loading) return <CircularProgress size={24} />;
  if (!describe) return null;

  const fields = describe.fields.map((field) => ({ id: field.name, ...field }));
  const children = describe.childRelationships.map((child, index) => ({
    id: `${child.childSObject}-${child.field}-${index}`,
    ...child,
  }));

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Fields</Typography>
      <Box sx={{ height: 420 }}>
        <DataGrid rows={fields} columns={fieldColumns} disableRowSelectionOnClick />
      </Box>
      <Typography variant="h6">Child Relationships</Typography>
      <Box sx={{ height: 320 }}>
        <DataGrid rows={children} columns={childColumns} disableRowSelectionOnClick />
      </Box>
    </Stack>
  );
}
