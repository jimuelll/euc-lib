import { useQuery } from "@tanstack/react-query";
import { getSiteContent } from "./site-content.service";
import { siteContentKeys } from "./site-content.keys";

export const useSiteContent = () => useQuery({
  queryKey: siteContentKeys.home(),
  queryFn: ({ signal }) => getSiteContent(signal),
});
