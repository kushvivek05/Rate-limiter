import type {Request, Response, NextFunction} from 'express';

export function route404Middleware(req: Request, res: Response, next: NextFunction): void {
  res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
}