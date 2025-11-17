import axios, { type AxiosRequestConfig, isAxiosError, type RawAxiosRequestHeaders } from 'axios';
import { isError } from 'lodash-es';

export const axiosAgent = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
});

export type ErrorWrapper<TError> = TError | { status: 'unknown'; payload: string };

export type ApiFetcherOptions<TBody, THeaders, TQueryParams, TPathParams> = {
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
  pathParams: Record<string, string> = {},
): string {
  const resolvedUrl = url.replace(/\{(\w+)\}/g, (match, key) => {
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
}: ApiFetcherOptions<TBody, THeaders, TQueryParams, TPathParams>): Promise<TData> {
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
    };

    const response = await axiosAgent<TData>(axiosConfig);

    return response.data;
  } catch (e: unknown) {
    if (!isError(e)) {
      throw new Error('Unknown error occurred');
    }

    if (isAxiosError<TError>(e)) {
      const status = e.response?.status;
      const errorData = e.response?.data;

      if (status === 401 && typeof window !== 'undefined') {
        if (window.location.pathname !== '/login') {
          localStorage.removeItem('accessToken');
          window.location.href = '/login';
        }
      }

      const errorWrapper: ErrorWrapper<TError> = errorData
        ? errorData
        : {
            status: 'unknown' as const,
            payload: e.message || 'Request failed',
          };

      throw errorWrapper;
    }

    const errorWrapper: ErrorWrapper<TError> = {
      status: 'unknown' as const,
      payload: e.message || 'Network error occurred',
    };

    throw errorWrapper;
  }
}
