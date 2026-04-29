import { useQuery } from "@tanstack/react-query";
import { describeSObject } from "../api/describe";

export function useDescribeSObject(sobject: string) {
  return useQuery({
    queryKey: ["describe", sobject],
    queryFn: () => describeSObject(sobject),
  });
}
