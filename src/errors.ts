import type { ErrorCode, FailureEnvelope } from './types.js';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;
  readonly status: number;

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      details?: unknown;
      status?: number;
    }
  ) {
    super(message);
    this.code = code;
    this.details = options?.details;
    this.name = 'AppError';
    this.status = options?.status ?? 500;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toFailureEnvelope(error: unknown): FailureEnvelope {
  if (isAppError(error)) {
    return {
      ok: false,
      error: {
        code: error.code,
        details: error.details,
        message: error.message,
      },
    };
  }

  if (error instanceof Error) {
    return {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
      },
    };
  }

  return {
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      details: error,
      message: 'Unexpected error',
    },
  };
}
