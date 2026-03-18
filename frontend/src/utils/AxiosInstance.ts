import axios from "axios";
import { useAuth } from "@/hooks/use-auth";

const axiosInstance = axios.create({
  baseURL: "http://localhost:4000",
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // send cookies
});

// Add request interceptor
axiosInstance.interceptors.request.use(async (config) => {
  const token = localStorage.getItem("token"); // or use in-memory token
  if (token && config.headers) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

export default axiosInstance;