import { useMutation, useQueryClient } from "@tanstack/react-query";
import { login } from "../api/auth";
import { queryKeys } from "./queryKeys";

type LoginVariables = {
  email: string;
  password: string;
};

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, password }: LoginVariables) => login(email, password),
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.auth.me, user);
    },
  });
}
