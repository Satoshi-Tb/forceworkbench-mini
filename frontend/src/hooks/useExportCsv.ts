import { useMutation } from "@tanstack/react-query";
import type { ApiError } from "../api/client";
import { downloadCsv, type CsvEncoding } from "../api/query";

export type { CsvEncoding };

type ExportCsvVariables = {
  soql: string;
  encoding: CsvEncoding;
  filename: string;
};

export function useExportCsv() {
  return useMutation<void, ApiError, ExportCsvVariables>({
    mutationFn: async ({ soql, encoding, filename }) => {
      const blob = await downloadCsv(soql, encoding);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    },
  });
}
