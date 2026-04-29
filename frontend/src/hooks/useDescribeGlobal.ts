import { useQuery } from "@tanstack/react-query";
import { describeGlobal } from "../api/describe";

export function useDescribeGlobal() {
  return useQuery({
    queryKey: ["describe", "global"],
    queryFn: describeGlobal,
  });
}
