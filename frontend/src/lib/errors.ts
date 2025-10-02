// Error handling utilities for the frontend

export interface AppError {
  code: string;
  http: number;
  message: string;
  details?: unknown;
}

export function toAppError(
  http: number,
  message: string,
  code: string,
  details?: unknown
): AppError {
  return {
    code,
    http,
    message,
    details,
  };
}
