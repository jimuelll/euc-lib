import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// In-memory token store (set this from AuthContext after login/refresh)
let inMemoryToken: string | null = null;

export function setInMemoryToken(token: string | null) {
  inMemoryToken = token;
}

axiosInstance.interceptors.request.use((config) => {
  if (inMemoryToken && config.headers) {
    config.headers["Authorization"] = `Bearer ${inMemoryToken}`;
  }
  return config;
});

export default axiosInstance;