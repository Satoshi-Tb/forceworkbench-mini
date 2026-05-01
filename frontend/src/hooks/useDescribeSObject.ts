import { useQuery } from "@tanstack/react-query";
import { describeSObject } from "../api/describe";

export function useDescribeSObject(sobject: string | undefined) {
  return useQuery({
    queryKey: ["describe", sobject],
    queryFn: () => describeSObject(sobject ?? ""),
    enabled: Boolean(sobject),
  });
}
