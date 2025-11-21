import { isAxiosError } from 'axios';

import type { MonoBankErrorResponse } from '../monobank.types';

export function isAxiosErrorWithResponse(err: unknown): err is {
  response: {
    status: number;
    data: MonoBankErrorResponse;
  };
} {
  if (!isAxiosError(err)) {
    return false;
  }

  return (
    err.response != undefined &&
    typeof err.response === 'object' &&
    'status' in err.response &&
    typeof err.response.status === 'number' &&
    'data' in err.response
  );
}
