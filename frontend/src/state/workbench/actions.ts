import { atom } from "jotai";
import type { WorkbenchTab } from "./types";
import {
  activeTabIdAtom,
  createInitialSoqlTabState,
  describeActiveSubTabAtomFamily,
  describeSelectedFieldNameAtomFamily,
  describeSObjectNameAtomFamily,
  describeTabStateFamily,
  nextSoqlTabNumberAtom,
  soqlBuilderStateAtomFamily,
  soqlCsvEncodingAtomFamily,
  soqlManualSoqlOverrideAtomFamily,
  soqlTabStateFamily,
  tabsAtom,
} from "./atoms";

// SObject の describe タブを追加し、既に同じ SObject のタブがあればそこへフォーカスする。
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

// 新しい SOQL タブを連番付きで追加し、そのタブへフォーカスする。
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

// 指定されたタブ ID をアクティブタブとして設定する。
export const activateTabAtom = atom(null, (_get, set, tabId: string) => {
  set(activeTabIdAtom, tabId);
});

// 指定されたタブを閉じ、必要に応じて隣接タブへフォーカスを移す。
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
