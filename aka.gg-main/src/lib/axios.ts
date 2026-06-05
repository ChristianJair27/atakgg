// src/lib/axios.ts
import axios, { AxiosHeaders, InternalAxiosRequestConfig } from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true, // necesario para cookies de sesión
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

// Soporte opcional para JWT en header
let accessToken: string | null = localStorage.getItem("access_token");
export const setAccessToken = (token: string | null) => {
  accessToken = token;
  if (token) localStorage.setItem("access_token", token);
  else localStorage.removeItem("access_token");
};

axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    config.withCredentials = true;

    const token = accessToken || localStorage.getItem("access_token");
    if (token) {
      // headers puede ser AxiosHeaders (v1) o un objeto plano
      const h = config.headers as AxiosHeaders | Record<string, any>;
      if (typeof (h as AxiosHeaders).set === "function") {
        // Caso AxiosHeaders
        (h as AxiosHeaders).set("Authorization", `Bearer ${token}`);
      } else {
        // Caso objeto plano
        const plain = (config.headers ?? {}) as Record<string, any>;
        plain.Authorization = `Bearer ${token}`;
        config.headers = plain as any;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const url = String(error?.config?.url || "");
    if (status === 401 && !url.startsWith("/auth/")) {
      setAccessToken(null);
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;