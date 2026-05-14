import { Request, Response, NextFunction, RequestHandler } from 'express';
import { createClient, type User as SupabaseUser } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null;

const allowDemoJwtFallback =
  process.env.ALLOW_UNVERIFIED_SUPABASE_JWT === 'true' ||
  (!supabaseAdmin && process.env.NODE_ENV !== 'production');

function parseJwt(token: string): Record<string, any> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(normalized, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function buildTokenContent(user: SupabaseUser, token: string) {
  const claims = parseJwt(token) || {};
  const appMetadataRoles = Array.isArray((claims as any)?.app_metadata?.roles)
    ? (claims as any).app_metadata.roles
    : [];
  const userMetadataRoles = Array.isArray((claims as any)?.user_metadata?.roles)
    ? (claims as any).user_metadata.roles
    : [];

  const roles = [...new Set([...appMetadataRoles, ...userMetadataRoles])];
  const name =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.user_metadata?.preferred_username ||
    user.email ||
    user.id;

  return {
    sub: user.id,
    email: user.email,
    name,
    preferred_username: user.email,
    realm_access: { roles },
    organizationId: (claims as any).organizationId || (claims as any).organization_id,
  };
}

function buildTokenContentFromClaims(claims: Record<string, any>) {
  const appMetadataRoles = Array.isArray((claims as any)?.app_metadata?.roles)
    ? (claims as any).app_metadata.roles
    : [];
  const userMetadataRoles = Array.isArray((claims as any)?.user_metadata?.roles)
    ? (claims as any).user_metadata.roles
    : [];

  const roles = [...new Set([...appMetadataRoles, ...userMetadataRoles])];
  const name =
    (claims as any)?.user_metadata?.full_name ||
    (claims as any)?.user_metadata?.name ||
    claims.email ||
    claims.sub;

  return {
    sub: claims.sub,
    email: claims.email,
    name,
    preferred_username: claims.email,
    realm_access: { roles },
    organizationId: claims.organizationId || claims.organization_id,
  };
}

export const sessionMiddleware: RequestHandler = (_req, _res, next) => next();

export const keycloak = {
  middleware: () => {
    const handler: RequestHandler = (_req, _res, next) => next();
    return handler;
  },
  protect: () => {
    const handler: RequestHandler = async (req, res, next) => {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length)
        : null;

      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!supabaseAdmin) {
        if (!allowDemoJwtFallback) {
          return res.status(500).json({ error: 'Auth server misconfigured' });
        }

        const claims = parseJwt(token);
        if (!claims?.sub) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        req.kauth = {
          grant: {
            access_token: {
              content: buildTokenContentFromClaims(claims),
            },
          },
        };

        return next();
      }

      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      req.kauth = {
        grant: {
          access_token: {
            content: buildTokenContent(data.user, token),
          },
        },
      };

      next();
    };

    return handler;
  },
};

export const protect = keycloak.protect();

const roleAliases: Record<string, string[]> = {
  studio_owner: ['studio_owner', 'studio_admin', 'STUDIO_ADMIN'],
  studio_admin: ['studio_admin', 'STUDIO_ADMIN', 'studio_owner'],
  admin: ['admin', 'SUPER_ADMIN', 'realm-admin', 'super_admin'],
  super_admin: ['SUPER_ADMIN', 'admin'],
};

function expandRequestedRoles(roles: string[]): string[] {
  const expanded = new Set<string>();
  for (const role of roles) {
    const key = role.toLowerCase();
    expanded.add(role);
    expanded.add(key);
    const aliasList = roleAliases[key] || [];
    for (const alias of aliasList) {
      expanded.add(alias);
      expanded.add(alias.toLowerCase());
    }
  }
  return [...expanded];
}

export const checkRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.kauth?.grant?.access_token;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const tokenRoles: string[] = token.content.realm_access?.roles || [];
    const userRoles = req.user?.roles || tokenRoles;
    const normalizedUserRoles = new Set(userRoles.map(r => r.toLowerCase()));
    const acceptableRoles = expandRequestedRoles(roles).map(r => r.toLowerCase());

    const hasRole = acceptableRoles.some(role => normalizedUserRoles.has(role));

    if (!hasRole) {
      return res.status(403).json({
        error: 'Forbidden: Insufficient permissions',
        requiredRoles: roles,
        userRoles,
      });
    }

    next();
  };
};

export const extractUserInfo = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = req.kauth?.grant?.access_token;

    if (token) {
      const authUserId = token.content.sub;

      req.user = {
        id: authUserId,
        email: token.content.email,
        name: token.content.name || token.content.preferred_username,
        roles: token.content.realm_access?.roles || [],
        organizationId: token.content.organizationId,
      };

      if (!req.user.organizationId) {
        const { prisma } = await import('../config/database.js');
        const dbUser = await prisma.user.findFirst({
          where: { keycloakId: authUserId },
          select: { organizationId: true, role: true },
        });

        if (dbUser?.organizationId) {
          req.user.organizationId = dbUser.organizationId;
        }

        if (dbUser?.role) {
          req.user.roles = [
            ...new Set([
              ...req.user.roles,
              dbUser.role,
              dbUser.role.toLowerCase(),
            ]),
          ];
        }
      }
    }

    next();
  } catch (error) {
    next(error as Error);
  }
};

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
