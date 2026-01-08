import Keycloak from 'keycloak-connect';
import session from 'express-session';
import { config } from '../config/index.js';
import { Request, Response, NextFunction } from 'express';

// Initialize Keycloak
const memoryStore = new session.MemoryStore();

export const sessionMiddleware = session({
  secret: config.session.secret,
  resave: false,
  saveUninitialized: true,
  store: memoryStore,
});

export const keycloak = new Keycloak(
  { store: memoryStore },
  {
    'auth-server-url': config.keycloak.url,
    realm: config.keycloak.realm,
    resource: config.keycloak.clientId,
    'confidential-port': 0,
    credentials: {
      secret: config.keycloak.clientSecret,
    },
  }
);

// Middleware to protect routes
export const protect = keycloak.protect();

// Middleware to check roles
export const checkRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.kauth?.grant?.access_token;
    
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userRoles = token.content.realm_access?.roles || [];
    const hasRole = roles.some(role => userRoles.includes(role));

    // Debug logging
    console.log('checkRole - Required roles:', roles);
    console.log('checkRole - User roles:', userRoles);
    console.log('checkRole - Has required role:', hasRole);

    if (!hasRole) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions', requiredRoles: roles, userRoles });
    }

    next();
  };
};

// Middleware to extract user info
export const extractUserInfo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.kauth?.grant?.access_token;
    
    if (token) {
      const keycloakId = token.content.sub;
      
      // First, set basic info from token
      req.user = {
        id: keycloakId,
        email: token.content.email,
        name: token.content.name || token.content.preferred_username,
        roles: token.content.realm_access?.roles || [],
        organizationId: token.content.organizationId, // Custom claim from Keycloak (if set)
      };

      // If no organizationId from token, look up from database
      if (!req.user.organizationId) {
        const { prisma } = await import('../config/database.js');
        const dbUser = await prisma.user.findFirst({
          where: { keycloakId },
          select: { organizationId: true, role: true },
        });
        
        if (dbUser?.organizationId) {
          req.user.organizationId = dbUser.organizationId;
        }
        
        // Also add database roles if present
        if (dbUser?.role) {
          req.user.roles = [...req.user.roles, dbUser.role.toLowerCase()];
        }
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        roles: string[];
        organizationId?: string;
      };
      kauth?: any;
    }
  }
}
