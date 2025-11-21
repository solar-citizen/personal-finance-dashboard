import { isAxiosError } from 'axios';

import type { MonoBankErrorResponse } from '../monobank.types';

export function isAxiosErrorWithResponse(error: unknown): error is {
  response: {
    status: number;
    data: MonoBankErrorResponse;
  };
} {
  if (!isAxiosError(error)) {
    return false;
  }

  return (
    error.response != undefined &&
    typeof error.response === 'object' &&
    'status' in error.response &&
    typeof error.response.status === 'number' &&
    'data' in error.response
  );
}
