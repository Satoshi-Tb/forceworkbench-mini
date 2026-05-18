import { atom } from "jotai";
import { focusAtom } from "jotai-optics";
import { atomFamily } from "jotai-family";
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
  csvEncoding: CsvEncoding;
};

export type WorkbenchTab =
  | { id: string; kind: "describe"; title: string }
  | { id: string; kind: "soql"; title: string };

function createInitialDescribeTabState(): DescribeTabState {
  return {
    sobjectName: "",
    activeSubTab: "overview",
    selectedFieldName: "",
  };
}

function createInitialSoqlTabState(): SoqlTabState {
  return {
    builderState: createInitialQueryBuilderState(),
    manualSoqlOverride: null,
    csvEncoding: "shift_jis",
  };
}

export const tabsAtom = atom<WorkbenchTab[]>([]);
export const activeTabIdAtom = atom<string | null>(null);
export const treeSelectedSObjectAtom = atom<string | null>(null);
export const nextSoqlTabNumberAtom = atom(1);

export const describeTabStateFamily = atomFamily(() =>
  atom<DescribeTabState>(createInitialDescribeTabState()),
);
export const soqlTabStateFamily = atomFamily(() =>
  atom<SoqlTabState>(createInitialSoqlTabState()),
);

export const describeSObjectNameAtomFamily = atomFamily((tabId: string) =>
  focusAtom(describeTabStateFamily(tabId), (optic) =>
    optic.prop("sobjectName"),
  ),
);
export const describeActiveSubTabAtomFamily = atomFamily((tabId: string) =>
  focusAtom(describeTabStateFamily(tabId), (optic) =>
    optic.prop("activeSubTab"),
  ),
);
export const describeSelectedFieldNameAtomFamily = atomFamily((tabId: string) =>
  focusAtom(describeTabStateFamily(tabId), (optic) =>
    optic.prop("selectedFieldName"),
  ),
);
export const soqlBuilderStateAtomFamily = atomFamily((tabId: string) =>
  focusAtom(soqlTabStateFamily(tabId), (optic) => optic.prop("builderState")),
);
export const soqlManualSoqlOverrideAtomFamily = atomFamily((tabId: string) =>
  focusAtom(soqlTabStateFamily(tabId), (optic) =>
    optic.prop("manualSoqlOverride"),
  ),
);
export const soqlCsvEncodingAtomFamily = atomFamily((tabId: string) =>
  focusAtom(soqlTabStateFamily(tabId), (optic) => optic.prop("csvEncoding")),
);

export const addDescribeTabAtom = atom(
  null,
  (get, set, sobjectName: string) => {
    const tabs = get(tabsAtom);
    const existingTab = tabs.find(
      (tab) =>
        tab.kind === "describe" &&
        get(describeSObjectNameAtomFamily(tab.id)) === sobjectName,
    );

    if (existingTab) {
      set(activeTabIdAtom, existingTab.id);
      return;
    }

    const nextTab: WorkbenchTab = {
      id: `describe-${sobjectName}-${Date.now()}`,
      kind: "describe",
      title: sobjectName,
    };
    set(describeTabStateFamily(nextTab.id), {
      sobjectName,
      activeSubTab: "overview",
      selectedFieldName: "",
    });
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
  };

  set(soqlTabStateFamily(nextTab.id), createInitialSoqlTabState());
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

  const closingTab = tabs[closingIndex];
  const nextTabs = tabs.filter((tab) => tab.id !== tabId);
  set(tabsAtom, nextTabs);

  // atomFamily は tabId ごとに atom をキャッシュするため、閉じたタブの状態は明示的に破棄する。
  if (closingTab.kind === "describe") {
    describeTabStateFamily.remove(tabId);
    describeSObjectNameAtomFamily.remove(tabId);
    describeActiveSubTabAtomFamily.remove(tabId);
    describeSelectedFieldNameAtomFamily.remove(tabId);
  } else {
    soqlTabStateFamily.remove(tabId);
    soqlBuilderStateAtomFamily.remove(tabId);
    soqlManualSoqlOverrideAtomFamily.remove(tabId);
    soqlCsvEncodingAtomFamily.remove(tabId);
  }

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
