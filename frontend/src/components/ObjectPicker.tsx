import {
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  Paper,
} from "@mui/material";
import { useNavigate } from "@tanstack/react-router";
import type { SObjectSummary } from "../api/describe";

export function ObjectPicker({
  objects,
  loading,
}: {
  objects: SObjectSummary[];
  loading: boolean;
}) {
  const navigate = useNavigate();

  if (loading) return <CircularProgress size={24} />;

  return (
    <Paper variant="outlined">
      <List dense>
        {objects.map((object) => (
          <ListItemButton
            key={object.name}
            onClick={() =>
              navigate({
                to: "/describe/$sobject",
                params: { sobject: object.name },
              })
            }
          >
            <ListItemText primary={object.label} secondary={object.name} />
          </ListItemButton>
        ))}
      </List>
    </Paper>
  );
}
