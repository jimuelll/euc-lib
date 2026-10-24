import { useQuery } from "@tanstack/react-query";
import { getAboutSettings } from "../api/about.service";
import { aboutKeys } from "../about.keys";

const useAboutSettings = () => {
  const query = useQuery({
    queryKey: aboutKeys.public(),
    queryFn: async ({ signal }) => {
      try { return await getAboutSettings(signal); }
      catch (error) {
        if ((error as { response?: { status?: number } }).response?.status === 404) return null;
        throw error;
      }
    },
  });
  return { data: query.data ?? null, loading: query.isPending, error: query.isError, retry: query.refetch };
};

export default useAboutSettings;
