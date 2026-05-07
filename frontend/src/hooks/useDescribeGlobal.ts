import { useQuery } from "@tanstack/react-query";
import { describeGlobal } from "../api/describe";
import { queryKeys } from "./queryKeys";

export function useDescribeGlobal() {
  return useQuery({
    queryKey: queryKeys.describe.global,
    queryFn: describeGlobal,
  });
}
