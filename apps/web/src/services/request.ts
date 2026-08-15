import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { message } from "antd";
import { useAuthStore } from "../store/auth";
import type { ApiResponse } from "../types/api";

const baseURL = import.meta.env.VITE_API_BASE_URL || "/api";

const request = axios.create({
  baseURL,
  timeout: 15000,
});

/** 请求拦截：自动携带 Bearer token */
request.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** 响应拦截：统一处理错误提示与 401/403 */
request.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse<unknown>>) => {
    const status = error.response?.status;
    const serverMessage = error.response?.data?.error?.message;

    if (status === 401) {
      // 登录过期或凭证无效：清除本地状态并跳转登录页
      useAuthStore.getState().logout();
      if (window.location.pathname !== "/login") {
        message.warning("登录已过期，请重新登录");
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }

    if (status === 403) {
      message.error(serverMessage || "没有权限执行该操作");
      return Promise.reject(error);
    }

    if (status === 404) {
      message.error(serverMessage || "请求的资源不存在");
      return Promise.reject(error);
    }

    if (error.response) {
      message.error(serverMessage || "请求失败，请稍后重试");
    } else if (error.code === "ECONNABORTED") {
      message.error("请求超时，请稍后重试");
    } else {
      message.error("网络异常，请检查网络连接");
    }

    return Promise.reject(error);
  },
);

/** 统一 GET */
export function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return request.get<ApiResponse<T>>(url, config).then((res) => res.data.data);
}

/** 统一 POST */
export function post<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  return request
    .post<ApiResponse<T>>(url, data, config)
    .then((res) => res.data.data);
}

export default request;
