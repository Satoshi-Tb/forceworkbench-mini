import { atom } from "jotai";
import { createInitialQueryBuilderState } from "../utils/soqlBuilder";

export type DescribeTab = "overview" | "fields" | "relationships";

export const builderStateAtom = atom(createInitialQueryBuilderState());
export const manualSoqlOverrideAtom = atom<string | null>(
  "SELECT Id, Name FROM Account LIMIT 10",
);
export const selectedSObjectAtom = atom<string | null>(null);
export const describeTabAtom = atom<DescribeTab>("overview");
export const selectedFieldNameAtom = atom("");
