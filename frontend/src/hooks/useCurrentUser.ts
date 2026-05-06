import { useQuery } from "@tanstack/react-query";
import { me } from "../api/auth";

export const currentUserQueryKey = ["auth", "me"] as const;

export const currentUserQueryOptions = {
  queryKey: currentUserQueryKey,
  queryFn: me,
};

export function useCurrentUser() {
  return useQuery(currentUserQueryOptions);
}
