import axios, { type AxiosRequestConfig, isAxiosError, type RawAxiosRequestHeaders } from 'axios';
import { isError } from 'lodash-es';

export const axiosAgent = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
});

type ErrorWrapper<TError> = TError | { status: 'unknown'; payload: string };

type ApiResult<TData, TError> =
  { success: true; data: TData } | { success: false; error: ErrorWrapper<TError> };

type ApiFetcherOptions<TBody, THeaders, TQueryParams, TPathParams> = {
  url: string;
  method: string;
  body?: TBody;
  headers?: THeaders;
  queryParams?: TQueryParams;
  pathParams?: TPathParams;
  signal?: AbortSignal;
};

function resolveUrl(
  url: string,
  queryParams: Record<string, unknown> = {},
  pathParams: Record<string, string | undefined> = {},
): string {
  const resolvedUrl = url.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = pathParams[key];
    return value !== undefined ? encodeURIComponent(value) : match;
  });

  const serializedParams = Object.entries(queryParams).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      if (value === undefined || value === null) {
        return acc;
      }

      if (Array.isArray(value)) {
        acc[key] = value.map(String).join(',');
      } else if (typeof value === 'object') {
        acc[key] = JSON.stringify(value);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        acc[key] = value.toString();
      } else if (typeof value === 'string') {
        acc[key] = value;
      }

      return acc;
    },
    {},
  );

  const query = new URLSearchParams(serializedParams).toString();

  return query ? `${resolvedUrl}?${query}` : resolvedUrl;
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return localStorage.getItem('accessToken');
}

export async function apiFetch<
  TData,
  TError,
  TBody extends Record<string, unknown> | FormData | undefined | null,
  THeaders extends RawAxiosRequestHeaders,
  TQueryParams extends Record<string, unknown> = Record<string, unknown>,
  TPathParams extends Record<string, string> = Record<string, string>,
>({
  url,
  method,
  body,
  headers,
  pathParams,
  queryParams,
  signal,
}: ApiFetcherOptions<TBody, THeaders, TQueryParams, TPathParams>): Promise<
  ApiResult<TData, TError>
> {
  try {
    const accessToken = getAuthToken();

    const axiosConfig: AxiosRequestConfig = {
      method: method.toUpperCase(),
      url: resolveUrl(url, queryParams, pathParams),
      headers: {
        ...headers,
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      data: body,
      signal,
      withCredentials: true,
    };

    const response = await axiosAgent<TData>(axiosConfig);

    return { success: true, data: response.data };
  } catch (err: unknown) {
    if (!isError(err)) {
      return {
        success: false,
        error: { status: 'unknown' as const, payload: 'Unknown error occurred' },
      };
    }

    if (isAxiosError<TError>(err)) {
      const status = err.response?.status;
      const errorData = err.response?.data;

      if (status === 401 && typeof window !== 'undefined') {
        if (window.location.pathname !== '/login') {
          localStorage.removeItem('accessToken');
          window.location.href = '/login';
        }
      }

      const errorWrapper: ErrorWrapper<TError> = errorData ?? {
        status: 'unknown' as const,
        payload: err.message || 'Request failed',
      };

      return { success: false, error: errorWrapper };
    }

    const errorWrapper: ErrorWrapper<TError> = {
      status: 'unknown' as const,
      payload: err.message || 'Network error occurred',
    };

    return { success: false, error: errorWrapper };
  }
}
