import {
  Box,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { useAtomValue, useSetAtom } from "jotai";
import { useMemo, useState } from "react";
import type { SObjectSummary } from "../api/describe";
import {
  selectedFieldNameAtom,
  selectedSObjectAtom,
} from "../state/uiStateAtoms";

export function ObjectPicker({
  objects,
  loading,
}: {
  objects: SObjectSummary[];
  loading: boolean;
}) {
  const selectedObject = useAtomValue(selectedSObjectAtom);
  const setSelectedObject = useSetAtom(selectedSObjectAtom);
  const setSelectedFieldName = useSetAtom(selectedFieldNameAtom);
  const [query, setQuery] = useState("");

  const filteredObjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return objects;
    return objects.filter((object) => {
      return (
        object.name.toLowerCase().includes(normalized) ||
        object.label.toLowerCase().includes(normalized)
      );
    });
  }, [objects, query]);

  const standardObjects = filteredObjects.filter((object) => !object.custom);
  const customObjects = filteredObjects.filter((object) => object.custom);

  if (loading) return <CircularProgress size={24} />;

  return (
    <Paper
      variant="outlined"
      sx={{
        display: "flex",
        flexDirection: "column",
        maxHeight: "calc(100vh - 180px)",
        overflow: "hidden",
      }}
    >
      <Box sx={{ p: 2 }}>
        <TextField
          fullWidth
          size="small"
          label="検索"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </Box>
      <Divider />
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <ObjectSection
          title="カスタムオブジェクト"
          objects={customObjects}
          selectedObject={selectedObject}
          onSelect={(object) => {
            setSelectedObject(object.name);
            setSelectedFieldName("");
          }}
        />
        <Divider />
        <ObjectSection
          title="標準オブジェクト"
          objects={standardObjects}
          selectedObject={selectedObject}
          onSelect={(object) => {
            setSelectedObject(object.name);
            setSelectedFieldName("");
          }}
        />
      </Box>
    </Paper>
  );
}

function ObjectSection({
  title,
  objects,
  selectedObject,
  onSelect,
}: {
  title: string;
  objects: SObjectSummary[];
  selectedObject: string | null;
  onSelect: (object: SObjectSummary) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Box>
      <Box
        sx={{
          alignItems: "center",
          display: "flex",
          justifyContent: "space-between",
          px: 2,
          py: 1,
        }}
      >
        <Typography variant="subtitle2" fontWeight={700}>
          {title} ({objects.length})
        </Typography>
        <IconButton
          size="small"
          onClick={() => setExpanded((current) => !current)}
          aria-label={`${title}を${expanded ? "閉じる" : "開く"}`}
        >
          <Typography aria-hidden color="text.secondary">
            {expanded ? "⌃" : "⌄"}
          </Typography>
        </IconButton>
      </Box>
      {expanded && (
        <Box sx={{ maxHeight: "min(320px, 38vh)", overflowY: "auto" }}>
          <List dense disablePadding>
            {objects.map((object) => (
              <ListItemButton
                key={object.name}
                selected={object.name === selectedObject}
                onClick={() => onSelect(object)}
                sx={{
                  borderLeft: object.name === selectedObject ? 3 : 0,
                  borderLeftColor: "primary.main",
                  px: 2,
                }}
              >
                <ListItemText primary={object.label} secondary={object.name} />
                <Typography color="text.secondary">›</Typography>
              </ListItemButton>
            ))}
          </List>
        </Box>
      )}
    </Box>
  );
}
