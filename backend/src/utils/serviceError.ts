import { ApiErrorCode } from '@shared';

/**
 * Service-level error class for consistent error handling
 */
export class ServiceError extends Error {
  constructor(
    public statusCode: number,
    public error: {
      code: ApiErrorCode;
      message: string;
      details?: unknown;
    }
  ) {
    super(error.message);
    this.name = 'ServiceError';
  }
}
