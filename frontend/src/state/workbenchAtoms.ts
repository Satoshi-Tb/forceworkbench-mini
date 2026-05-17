import { atom } from "jotai";
import type { CsvEncoding } from "../hooks/useExportCsv";
import {
  createInitialQueryBuilderState,
  type QueryBuilderState,
} from "../utils/soqlBuilder";

export type DescribeSubTab = "overview" | "fields" | "relationships";

export type DescribeTabState = {
  sobjectName: string;
  activeSubTab: DescribeSubTab;
  selectedFieldName: string;
};

export type SoqlTabState = {
  builderState: QueryBuilderState;
  manualSoqlOverride: string | null;
  lastRunSoql: string | null;
  csvEncoding: CsvEncoding;
};

export type WorkbenchTab =
  | {
      id: string;
      kind: "describe";
      title: string;
      state: DescribeTabState;
    }
  | {
      id: string;
      kind: "soql";
      title: string;
      state: SoqlTabState;
    };

export const tabsAtom = atom<WorkbenchTab[]>([]);
export const activeTabIdAtom = atom<string | null>(null);
export const treeSelectedSObjectAtom = atom<string | null>(null);
export const nextSoqlTabNumberAtom = atom(1);

export const addDescribeTabAtom = atom(
  null,
  (get, set, sobjectName: string) => {
    const tabs = get(tabsAtom);
    const existingTab = tabs.find(
      (tab) => tab.kind === "describe" && tab.state.sobjectName === sobjectName,
    );

    if (existingTab) {
      set(activeTabIdAtom, existingTab.id);
      return;
    }

    const nextTab: WorkbenchTab = {
      id: `describe-${sobjectName}-${Date.now()}`,
      kind: "describe",
      title: sobjectName,
      state: {
        sobjectName,
        activeSubTab: "overview",
        selectedFieldName: "",
      },
    };
    set(tabsAtom, [...tabs, nextTab]);
    set(activeTabIdAtom, nextTab.id);
  },
);

export const addSoqlTabAtom = atom(null, (get, set) => {
  const tabs = get(tabsAtom);
  const soqlTabNumber = get(nextSoqlTabNumberAtom);
  const nextTab: WorkbenchTab = {
    id: `soql-${Date.now()}-${soqlTabNumber}`,
    kind: "soql",
    title: `SOQL #${soqlTabNumber}`,
    state: {
      builderState: createInitialQueryBuilderState(),
      manualSoqlOverride: "SELECT Id, Name FROM Account LIMIT 10",
      lastRunSoql: null,
      csvEncoding: "shift_jis",
    },
  };

  set(tabsAtom, [...tabs, nextTab]);
  set(activeTabIdAtom, nextTab.id);
  set(nextSoqlTabNumberAtom, soqlTabNumber + 1);
});

export const activateTabAtom = atom(null, (_get, set, tabId: string) => {
  set(activeTabIdAtom, tabId);
});

export const closeTabAtom = atom(null, (get, set, tabId: string) => {
  const tabs = get(tabsAtom);
  const closingIndex = tabs.findIndex((tab) => tab.id === tabId);
  if (closingIndex === -1) return;

  const nextTabs = tabs.filter((tab) => tab.id !== tabId);
  set(tabsAtom, nextTabs);

  if (get(activeTabIdAtom) !== tabId) return;

  const nextActiveTab =
    nextTabs[Math.min(closingIndex, nextTabs.length - 1)] ?? null;
  set(activeTabIdAtom, nextActiveTab?.id ?? null);
});

export function updateWorkbenchTab(
  tabs: WorkbenchTab[],
  tabId: string,
  updater: (tab: WorkbenchTab) => WorkbenchTab,
): WorkbenchTab[] {
  return tabs.map((tab) => (tab.id === tabId ? updater(tab) : tab));
}
