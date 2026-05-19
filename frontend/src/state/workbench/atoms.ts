import { atom } from "jotai";
import { atomFamily } from "jotai-family";
import { focusAtom } from "jotai-optics";
import { createInitialQueryBuilderState } from "../../utils/soqlBuilder";
import type { DescribeTabState, SoqlTabState, WorkbenchTab } from "./types";

export function createInitialDescribeTabState(): DescribeTabState {
  return {
    sobjectName: "",
    activeSubTab: "overview",
    selectedFieldName: "",
  };
}

export function createInitialSoqlTabState(): SoqlTabState {
  return {
    builderState: createInitialQueryBuilderState(),
    manualSoqlOverride: null,
    csvEncoding: "shift_jis",
  };
}

// 開いているワークベンチタブのメタ情報を順序付きで保持する。
export const tabsAtom = atom<WorkbenchTab[]>([]);
// 右ペインで現在表示しているタブ ID を保持する。
export const activeTabIdAtom = atom<string | null>(null);
// 左ペインの SObject ブラウザで選択中のオブジェクト名を保持する。
export const treeSelectedSObjectAtom = atom<string | null>(null);
// SOQL タブの採番を閉じたタブ数に影響されない連番として保持する。
export const nextSoqlTabNumberAtom = atom(1);

// describe タブごとの状態を tabId 単位で分離して保持する。
export const describeTabStateFamily = atomFamily(() =>
  atom<DescribeTabState>(createInitialDescribeTabState()),
);
// SOQL タブごとの状態を tabId 単位で分離して保持する。
export const soqlTabStateFamily = atomFamily(() =>
  atom<SoqlTabState>(createInitialSoqlTabState()),
);

// describe タブが参照する SObject API 参照名だけを部分購読する。
export const describeSObjectNameAtomFamily = atomFamily((tabId: string) =>
  focusAtom(describeTabStateFamily(tabId), (optic) =>
    optic.prop("sobjectName"),
  ),
);
// describe タブ内のサブタブ選択状態だけを部分購読する。
export const describeActiveSubTabAtomFamily = atomFamily((tabId: string) =>
  focusAtom(describeTabStateFamily(tabId), (optic) =>
    optic.prop("activeSubTab"),
  ),
);
// describe タブ内の選択フィールド名だけを部分購読する。
export const describeSelectedFieldNameAtomFamily = atomFamily((tabId: string) =>
  focusAtom(describeTabStateFamily(tabId), (optic) =>
    optic.prop("selectedFieldName"),
  ),
);
// SOQL タブ内のクエリビルダー状態だけを部分購読する。
export const soqlBuilderStateAtomFamily = atomFamily((tabId: string) =>
  focusAtom(soqlTabStateFamily(tabId), (optic) => optic.prop("builderState")),
);
// SOQL タブ内の手入力 SOQL 上書き値だけを部分購読する。
export const soqlManualSoqlOverrideAtomFamily = atomFamily((tabId: string) =>
  focusAtom(soqlTabStateFamily(tabId), (optic) =>
    optic.prop("manualSoqlOverride"),
  ),
);
// SOQL タブ内の CSV 文字コード選択だけを部分購読する。
export const soqlCsvEncodingAtomFamily = atomFamily((tabId: string) =>
  focusAtom(soqlTabStateFamily(tabId), (optic) => optic.prop("csvEncoding")),
);

export function updateWorkbenchTab(
  tabs: WorkbenchTab[],
  tabId: string,
  updater: (tab: WorkbenchTab) => WorkbenchTab,
): WorkbenchTab[] {
  return tabs.map((tab) => (tab.id === tabId ? updater(tab) : tab));
}
