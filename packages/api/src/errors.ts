import { type ErrorRequestHandler, type NextFunction, type Request, type Response } from 'express';
import { SuperGooseError } from 'supergoose-core';

/**
 * Checks whether an error came from invalid JSON parsing.
 */
function isJsonSyntaxError(error: unknown): error is SyntaxError {
  return error instanceof SyntaxError && 'body' in error;
}

/**
 * Maps domain and parsing errors to HTTP responses.
 */
export function handleApiError(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof SuperGooseError) {
    res.status(error.statusCode).json({
      error: error.code,
      message: error.message
    });
    return;
  }

  if (isJsonSyntaxError(error)) {
    res.status(400).json({
      error: 'InvalidJson',
      message: 'Request body must be valid JSON'
    });
    return;
  }

  res.status(500).json({
    error: 'InternalServerError',
    message: 'Internal Server Error'
  });
}

/**
 * Express-compatible error handler for API responses.
 */
export const errorRequestHandler = handleApiError as ErrorRequestHandler;
