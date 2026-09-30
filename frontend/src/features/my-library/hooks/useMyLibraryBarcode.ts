import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMyLibraryBarcode } from "../api";
import { myLibraryKeys } from "../my-library.keys";

export function useMyLibraryBarcode(enabled: boolean) {
  const query = useQuery({
    queryKey: myLibraryKeys.barcode(),
    queryFn: ({ signal }) => fetchMyLibraryBarcode(signal),
    enabled,
    staleTime: Infinity,
  });
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!query.data) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(query.data);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [query.data]);
  const download = () => {
    if (!imageUrl) return;
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = "my-library-qr.png";
    link.click();
  };
  return {
    imageUrl,
    loading: enabled && (query.isPending || (Boolean(query.data) && !imageUrl)),
    error: query.isError,
    retrying: query.isFetching,
    retry: query.refetch,
    download,
  };
}
