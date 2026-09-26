import { useQuery } from "@tanstack/react-query";
import { getAboutSettings } from "@/features/about/api/about.service";
import type { AboutSettings } from "@/features/about/api/about.service";
import { ABOUT_DEFAULTS } from "../constants/defaults";
import { aboutKeys } from "../about.keys";

interface UseAboutSettingsReturn {
  data: AboutSettings;
  loading: boolean;
}

const useAboutSettings = (): UseAboutSettingsReturn => {
  const query = useQuery({ queryKey: aboutKeys.public(), queryFn: ({ signal }) => getAboutSettings(signal) });
  return { data: query.data ?? ABOUT_DEFAULTS, loading: query.isPending };
};

export default useAboutSettings;
