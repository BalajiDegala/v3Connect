import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

const isDevelopment = process.env.NODE_ENV !== 'production';

// Rate limiter - more relaxed in development
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : 100, // 1000 in dev, 100 in prod
  message: 'Too many requests from this IP, please try again later.',
  skip: () => isDevelopment, // Skip rate limiting entirely in development
});

// Strict rate limiter for payment endpoints
export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDevelopment ? 100 : 10, // 100 in dev, 10 in prod
  message: 'Too many payment requests, please try again later.',
});

// Error handler
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.message,
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
};

// Request logger
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
};

// Tenant isolation middleware - ensures users only access their org data
export const tenantIsolation = (req: Request, res: Response, next: NextFunction) => {
  const userOrgId = req.user?.organizationId;
  const roles = req.user?.roles || [];
  
  // Platform admins (admin or realm-admin role) bypass tenant isolation
  const isPlatformAdmin = roles.includes('admin') || roles.includes('realm-admin') || roles.includes('SUPER_ADMIN');
  
  if (!userOrgId && !isPlatformAdmin) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'No organization associated with user',
    });
  }

  // Add organizationId to request for easy access
  req.organizationId = userOrgId;
  next();
};

declare global {
  namespace Express {
    interface Request {
      organizationId?: string;
    }
  }
}
