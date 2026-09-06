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
import type { AxiosRequestConfig } from "axios";
import type { z } from "zod";
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
  private readonly endpointBase: string;

  constructor(base: string) {
    super(base, appAxios);
    this.endpointBase = base;
  }

  /** PATCH is application-owned until the published infrastructure client exposes it. */
  protected httpPatch<TSchema extends z.ZodType>(schema: TSchema) {
    return async (url: string, data?: unknown, config?: AxiosRequestConfig): Promise<z.infer<TSchema>> => {
      const response = await appAxios.patch(`${this.endpointBase}/${url}`.replace(/\/$/u, ""), data, config);
      return schema.parse(response.data);
    };
  }
}

/** Runs Starter's standard validated pageable-search transaction with the application client. */
export function postAppPagedSearch<TEntity, TFilters extends SearchableFilters>(
  request: Omit<PagedSearchRequest<TEntity, TFilters>, "client">,
): Promise<PageableResponse<TEntity>> {
  return postPagedSearch({ ...request, client: appAxios });
}
