export function usePublicTrack(_trackId: string | undefined) {
  return {
    isLoading: false,
    isError: true,
    data: undefined,
    refetch: async () => undefined,
  };
}
