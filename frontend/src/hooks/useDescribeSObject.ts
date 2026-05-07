import { useQuery } from "@tanstack/react-query";
import { describeSObject } from "../api/describe";
import { queryKeys } from "./queryKeys";

export function useDescribeSObject(sobject: string | undefined) {
  const sobjectName = sobject ?? "";

  return useQuery({
    queryKey: queryKeys.describe.sobject(sobjectName),
    queryFn: () => describeSObject(sobjectName),
    enabled: Boolean(sobject),
  });
}
