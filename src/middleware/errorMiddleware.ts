import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

export const errorMiddleware = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err.message || 'Internal Server Error';

  // Log error for developers
  if (statusCode === 500) {
    console.error('💥 ERROR:', err);
  }

  res.status(statusCode).json({
    status: statusCode >= 400 && statusCode < 500 ? 'fail' : 'error',
    error: {
        code: statusCode,
        message,
        path: req.originalUrl,
        timestamp: new Date().toISOString(),
        ...(err instanceof AppError && (err as any).details && { details: (err as any).details })
    },
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
