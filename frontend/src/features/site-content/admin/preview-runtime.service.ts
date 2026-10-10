import axios, { AxiosError } from "axios";
import api, { setInMemoryToken } from "@/utils/AxiosInstance";
import { resolvePreviewData, type PreviewSnapshot } from "./preview-data";

let current: PreviewSnapshot;
const networkAdapter = axios.getAdapter(api.defaults.adapter);

// This module is loaded only by the separate iframe entry point.
api.defaults.adapter = async config => {
  if ((config.method ?? "get").toLowerCase() !== "get")
    throw new AxiosError("Saving is disabled in draft preview.", "ERR_PREVIEW_READ_ONLY", config);
  const url = new URL(config.url!, window.location.origin);
  const params = { ...Object.fromEntries(url.searchParams), ...config.params };
  const data = resolvePreviewData(current, url.pathname, params);
  if (data !== undefined) return { data, status: 200, statusText: "OK", headers: {}, config };
  return networkAdapter(config);
};

const networkFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  if (method.toUpperCase() !== "GET") return Promise.reject(new Error("Saving is disabled in draft preview."));
  return networkFetch(input, init);
};

export function setPreviewSnapshot(snapshot: PreviewSnapshot) {
  current = snapshot;
  setInMemoryToken(snapshot.token);
}
