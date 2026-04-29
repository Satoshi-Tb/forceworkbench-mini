import { useMutation } from "@tanstack/react-query";
import { runQuery } from "../api/query";

export function useRunSoql() {
  return useMutation({
    mutationFn: runQuery,
  });
}
