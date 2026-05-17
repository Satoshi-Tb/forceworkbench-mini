import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
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
import type { SObjectSummary } from "../../api/describe";
import { useDescribeGlobal } from "../../hooks/useDescribeGlobal";
import {
  addDescribeTabAtom,
  treeSelectedSObjectAtom,
} from "../../state/workbenchAtoms";

export function ObjectTreePane() {
  const selectedObject = useAtomValue(treeSelectedSObjectAtom);
  const setSelectedObject = useSetAtom(treeSelectedSObjectAtom);
  const addDescribeTab = useSetAtom(addDescribeTabAtom);
  const { data, isLoading } = useDescribeGlobal();
  const [query, setQuery] = useState("");
  const filteredObjects = useMemo(() => {
    const objects = data?.sobjects ?? [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return objects;
    return objects.filter((object) => {
      return (
        object.name.toLowerCase().includes(normalized) ||
        object.label.toLowerCase().includes(normalized)
      );
    });
  }, [data?.sobjects, query]);

  const standardObjects = filteredObjects.filter((object) => !object.custom);
  const customObjects = filteredObjects.filter((object) => object.custom);

  return (
    <Paper
      variant="outlined"
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" component="h1" sx={{ mb: 1.5 }}>
          SObject
        </Typography>
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
        {isLoading ? (
          <Box sx={{ p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <>
            <ObjectSection
              title="カスタムオブジェクト"
              objects={customObjects}
              selectedObject={selectedObject}
              onSelect={(object) => setSelectedObject(object.name)}
              onOpen={(object) => addDescribeTab(object.name)}
            />
            <Divider />
            <ObjectSection
              title="標準オブジェクト"
              objects={standardObjects}
              selectedObject={selectedObject}
              onSelect={(object) => setSelectedObject(object.name)}
              onOpen={(object) => addDescribeTab(object.name)}
            />
          </>
        )}
      </Box>
    </Paper>
  );
}

function ObjectSection({
  title,
  objects,
  selectedObject,
  onSelect,
  onOpen,
}: {
  title: string;
  objects: SObjectSummary[];
  selectedObject: string | null;
  onSelect: (object: SObjectSummary) => void;
  onOpen: (object: SObjectSummary) => void;
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
          {expanded ? (
            <ExpandLessIcon fontSize="small" />
          ) : (
            <ExpandMoreIcon fontSize="small" />
          )}
        </IconButton>
      </Box>
      {expanded && (
        <List dense disablePadding>
          {objects.map((object) => (
            <ListItemButton
              key={object.name}
              selected={object.name === selectedObject}
              onClick={() => onSelect(object)}
              onDoubleClick={() => onOpen(object)}
              sx={{
                borderLeft: object.name === selectedObject ? 3 : 0,
                borderLeftColor: "primary.main",
                px: 2,
              }}
            >
              <ListItemText primary={object.label} secondary={object.name} />
            </ListItemButton>
          ))}
        </List>
      )}
    </Box>
  );
}
