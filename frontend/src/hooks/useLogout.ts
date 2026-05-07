import { useMutation, useQueryClient } from "@tanstack/react-query";
import { logout } from "../api/auth";
import { queryKeys } from "./queryKeys";

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.auth.me, null);
    },
  });
}
