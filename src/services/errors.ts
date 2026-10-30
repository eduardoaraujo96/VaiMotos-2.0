import type { ServiceError } from '../types/database';

export class AppError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }

  toServiceError(): ServiceError {
    return { code: this.code, message: this.message };
  }
}

export function toAppError(error: unknown, fallback = 'Algo deu errado. Tente novamente.'): AppError {
  if (error instanceof AppError) return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: string }).message || fallback);
    const code = String((error as { code?: string }).code || 'unknown');
    return new AppError(code, message);
  }
  return new AppError('unknown', fallback);
}

export function fail<T>(error: unknown, fallback?: string): { ok: false; error: ServiceError } {
  return { ok: false, error: toAppError(error, fallback).toServiceError() };
}
