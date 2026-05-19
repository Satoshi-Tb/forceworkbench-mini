import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useAtomValue, useSetAtom } from "jotai";
import {
  activateTabAtom,
  addSoqlTabAtom,
  closeTabAtom,
} from "../../state/workbench/actions";
import { activeTabIdAtom, tabsAtom } from "../../state/workbench/atoms";
import { DescribeTabContent } from "./DescribeTabContent";
import { SoqlTabContent } from "./SoqlTabContent";

export function TabbedContentPane() {
  const tabs = useAtomValue(tabsAtom);
  const activeTabId = useAtomValue(activeTabIdAtom);
  const activateTab = useSetAtom(activateTabAtom);
  const addSoqlTab = useSetAtom(addSoqlTabAtom);
  const closeTab = useSetAtom(closeTabAtom);
  const activeDescribeTab = tabs.find(
    (tab) => tab.id === activeTabId && tab.kind === "describe",
  ) as Extract<(typeof tabs)[number], { kind: "describe" }> | undefined;

  return (
    <Paper
      variant="outlined"
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          alignItems: "center",
          borderBottom: 1,
          borderColor: "divider",
          display: "flex",
          gap: 1,
          px: 1.5,
        }}
      >
        <Tabs
          value={activeTabId ?? false}
          onChange={(_, tabId: string) => activateTab(tabId)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ flex: 1, minWidth: 0 }}
        >
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              value={tab.id}
              sx={{
                bgcolor:
                  tab.id === activeTabId
                    ? "rgba(25, 118, 210, 0.08)"
                    : "transparent",
                borderTopLeftRadius: 1,
                borderTopRightRadius: 1,
                color: "text.primary",
                minHeight: 48,
                "&.Mui-selected": {
                  bgcolor: "rgba(25, 118, 210, 0.08)",
                  color: "text.primary",
                },
              }}
              label={
                <Stack direction="row" alignItems="center" gap={0.5}>
                  <Typography variant="body2" noWrap maxWidth={220}>
                    {tab.title}
                  </Typography>
                  <IconButton
                    aria-label={`${tab.title}を閉じる`}
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation();
                      closeTab(tab.id);
                    }}
                    sx={{ p: 0.25 }}
                  >
                    <CloseIcon fontSize="inherit" />
                  </IconButton>
                </Stack>
              }
            />
          ))}
        </Tabs>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => addSoqlTab()}
          sx={{ flexShrink: 0 }}
        >
          新規SOQL
        </Button>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", p: 2 }}>
        {tabs.length === 0 && (
          <Box
            sx={{
              alignItems: "center",
              display: "flex",
              minHeight: "calc(100vh - 220px)",
            }}
          >
            <Typography color="text.secondary">
              左のオブジェクトをダブルクリックするか「+
              新規SOQL」を押してください
            </Typography>
          </Box>
        )}

        {activeDescribeTab && <DescribeTabContent tab={activeDescribeTab} />}

        {/* 
        SOQL実行結果はグローバルキャッシュ化していない。よって、コンポーネントがアンマウントされるとSOQL実行結果がクリアされてしまう。
        これを防ぐため、アクティブ状態の有無にかかわらず、SOQLタブの内容は常にDOM上に存在させ、
        非アクティブなタブは display: none で非表示にする。
        SOQLタブの同時表示数は10～20程度と想定しているため、パフォーマンスへの影響は小さいと判断。
         */}
        {tabs
          .filter((tab) => tab.kind === "soql")
          .map((tab) => (
            <Box
              key={tab.id}
              sx={{ display: tab.id === activeTabId ? "block" : "none" }}
            >
              <SoqlTabContent tab={tab} />
            </Box>
          ))}
      </Box>
    </Paper>
  );
}
