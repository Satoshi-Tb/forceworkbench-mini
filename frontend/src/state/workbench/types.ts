import type { CsvEncoding } from "../../hooks/useExportCsv";
import type { QueryBuilderState } from "../../utils/soqlBuilder";

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
