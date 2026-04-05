import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

export const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = err instanceof AppError ? err.statusCode : 500;
  let message = err.message || 'Internal Server Error';

  // Handle Multer file size limit error
  if (err.code === 'LIMIT_FILE_SIZE' || message === 'File too large') {
    statusCode = 413;
    message = 'El archivo excede el tamaño máximo permitido de 4MB. Por favor, comprímelo o sube un archivo más pequeño.';
  }

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
