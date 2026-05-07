export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  describe: {
    global: ["describe", "global"] as const,
    sobject: (name: string) => ["describe", name] as const,
  },
} as const;
