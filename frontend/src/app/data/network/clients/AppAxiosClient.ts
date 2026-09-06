import {
  AxiosHttpClient,
  getAxiosRequestPath,
  isRequestCanceled,
  postPagedSearch,
  type PagedSearchRequest,
  type PageableResponse,
  type SearchableFilters,
} from "@vireocodedev/infrastructure";
import axios from "axios";
import { appSessionExpiry } from "@/app/data/network/services/appSessionExpiry";
import { appConfig } from "@/app/config/app-config";

export const appAxios = axios.create({
  baseURL: appConfig.apiBaseUrl,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

function isAuthRequest(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const path = getAxiosRequestPath(error);
  return (
    path === "/auth" ||
    path?.startsWith("/auth/") === true ||
    path === "/api/auth" ||
    path?.startsWith("/api/auth/") === true
  );
}

appAxios.interceptors.response.use(undefined, error => {
  if (
    axios.isAxiosError(error) &&
    error.response?.status === 401 &&
    !isAuthRequest(error) &&
    !isRequestCanceled(error)
  ) {
    appSessionExpiry.notifySessionExpired();
  }

  return Promise.reject(error);
});

/** Binds Starter's Zod-validating HTTP primitives to this application's configured Axios instance. */
export abstract class AppAxiosHttpClient extends AxiosHttpClient {
  constructor(base: string) {
    super(base, appAxios);
  }
}

/** Runs Starter's standard validated pageable-search transaction with the application client. */
export function postAppPagedSearch<TEntity, TFilters extends SearchableFilters>(
  request: Omit<PagedSearchRequest<TEntity, TFilters>, "client">,
): Promise<PageableResponse<TEntity>> {
  return postPagedSearch({ ...request, client: appAxios });
}
