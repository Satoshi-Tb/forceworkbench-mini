import { useQuery } from "@tanstack/react-query";
import { me } from "../api/auth";
import { queryKeys } from "./queryKeys";

export const currentUserQueryOptions = {
  queryKey: queryKeys.auth.me,
  queryFn: me,
};

export function useCurrentUser() {
  return useQuery(currentUserQueryOptions);
}
