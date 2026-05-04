import { Box } from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import type { QueryResult } from "../api/query";

export function ResultGrid({ result }: { result: QueryResult }) {
  const columns: GridColDef[] = result.columns.map((column) => ({
    field: column,
    headerName: column,
    flex: 1,
    minWidth: 150,
  }));
  const rows = result.rows.map((row, index) => {
    const recordId = row.Id?.trim();
    return {
      ...row,
      __rowId: recordId ? recordId : index,
    };
  });

  return (
    <Box sx={{ height: 420, width: "100%" }}>
      <DataGrid
        rows={rows}
        columns={columns}
        getRowId={(row) => row.__rowId}
        disableRowSelectionOnClick
      />
    </Box>
  );
}
