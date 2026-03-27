import { useEffect, useState } from "react";
import { getAboutSettings } from "@/services/about.service";
import type { AboutSettings } from "@/services/about.service";
import { ABOUT_DEFAULTS } from "../constants/defaults";

interface UseAboutSettingsReturn {
  data: AboutSettings;
  loading: boolean;
}

const useAboutSettings = (): UseAboutSettingsReturn => {
  const [data, setData] = useState<AboutSettings>(ABOUT_DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAboutSettings()
      .then((json) => setData(json))
      .catch(() => { /* silently fall back to defaults */ })
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
};

export default useAboutSettings;