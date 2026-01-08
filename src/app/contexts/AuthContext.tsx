import Keycloak from 'keycloak-js';
import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

// Keycloak configuration
const keycloakConfig = {
  url: 'http://localhost:32645',
  realm: 'ankiya',
  clientId: 'ankiya-frontend',
};

// API base URL
const API_BASE_URL = 'http://localhost:5000/api';

// Initialize Keycloak instance
const keycloak = new Keycloak(keycloakConfig);

// User interface with both Keycloak and database data
export interface User {
  id: string;           // Keycloak ID
  dbId?: string;        // Database ID
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  roles: string[];
  organizationId?: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
  emailVerified: boolean;
  status?: string;
}

// Auth context interface
interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  token: string | null;
  keycloak: Keycloak;
  login: () => void;
  logout: () => void;
  register: () => void;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Extract user info from Keycloak token
  const extractUserFromToken = useCallback((): User | null => {
    if (!keycloak.tokenParsed) return null;

    const tokenData = keycloak.tokenParsed as any;
    
    return {
      id: tokenData.sub,
      email: tokenData.email || tokenData.preferred_username,
      firstName: tokenData.given_name || '',
      lastName: tokenData.family_name || '',
      fullName: tokenData.name || `${tokenData.given_name || ''} ${tokenData.family_name || ''}`.trim(),
      roles: tokenData.realm_access?.roles || [],
      organizationId: tokenData.organization_id,
      emailVerified: tokenData.email_verified || false,
    };
  }, []);

  // Sync user with backend database
  const syncUserWithBackend = useCallback(async (): Promise<User | null> => {
    if (!keycloak.token) return null;
    
    try {
      const response = await fetch(`${API_BASE_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const dbUser = await response.json();
        const tokenData = keycloak.tokenParsed as any;
        
        // Combine Keycloak roles with database role
        const keycloakRoles = tokenData.realm_access?.roles || [];
        const dbRole = dbUser.role?.toLowerCase();
        const allRoles = dbRole && !keycloakRoles.includes(dbRole) 
          ? [...keycloakRoles, dbRole]
          : keycloakRoles;
        
        return {
          id: tokenData.sub,
          dbId: dbUser.id,
          email: dbUser.email || tokenData.email,
          firstName: dbUser.firstName || tokenData.given_name || '',
          lastName: dbUser.lastName || tokenData.family_name || '',
          fullName: `${dbUser.firstName || ''} ${dbUser.lastName || ''}`.trim() || tokenData.name,
          roles: allRoles,
          organizationId: dbUser.organization?.id,
          organization: dbUser.organization,
          emailVerified: tokenData.email_verified || false,
          status: dbUser.status,
        };
      } else {
        console.warn('Failed to sync user with backend:', response.status);
        return extractUserFromToken();
      }
    } catch (error) {
      console.error('Error syncing user with backend:', error);
      return extractUserFromToken();
    }
  }, [extractUserFromToken]);

  // Initialize Keycloak
  useEffect(() => {
    const initKeycloak = async () => {
      try {
        console.log('Initializing Keycloak...');
        const authenticated = await keycloak.init({
          onLoad: 'check-sso',
          pkceMethod: 'S256',
          checkLoginIframe: false,
          silentCheckSsoFallback: false,
        });

        console.log('Keycloak initialized, authenticated:', authenticated);
        setIsAuthenticated(authenticated);
        
        if (authenticated) {
          setToken(keycloak.token || null);
          // Sync with backend database to get full user profile
          const syncedUser = await syncUserWithBackend();
          setUser(syncedUser);
          console.log('User synced with backend:', syncedUser);
        }
      } catch (error) {
        console.error('Keycloak initialization failed:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    initKeycloak();

    // Setup token refresh
    keycloak.onTokenExpired = () => {
      console.log('Token expired, refreshing...');
      keycloak.updateToken(30).then(async (refreshed) => {
        if (refreshed) {
          setToken(keycloak.token || null);
          const syncedUser = await syncUserWithBackend();
          setUser(syncedUser);
        }
      }).catch(() => {
        console.error('Failed to refresh token');
        setIsAuthenticated(false);
        setUser(null);
        setToken(null);
      });
    };

    // Handle auth state changes
    keycloak.onAuthSuccess = async () => {
      console.log('Auth success');
      setIsAuthenticated(true);
      setToken(keycloak.token || null);
      const syncedUser = await syncUserWithBackend();
      setUser(syncedUser);
      
      // Check for pending invitation
      const pendingInvitation = sessionStorage.getItem('pendingInvitation');
      if (pendingInvitation) {
        sessionStorage.removeItem('pendingInvitation');
        sessionStorage.removeItem('invitationEmail');
        // Redirect to invitation page
        window.location.href = `/invite/accept?token=${pendingInvitation}`;
      }
    };

    keycloak.onAuthLogout = () => {
      console.log('Auth logout');
      setIsAuthenticated(false);
      setUser(null);
      setToken(null);
    };
  }, [extractUserFromToken, syncUserWithBackend]);

  // Login function
  const login = useCallback(() => {
    keycloak.login({
      redirectUri: window.location.origin,
    });
  }, []);

  // Logout function
  const logout = useCallback(() => {
    keycloak.logout({
      redirectUri: window.location.origin,
    });
  }, []);

  // Register function
  const register = useCallback(() => {
    keycloak.register({
      redirectUri: window.location.origin,
    });
  }, []);

  // Check if user has a specific role (checks both Keycloak and user.roles array)
  const hasRole = useCallback((role: string): boolean => {
    // Check Keycloak realm roles
    if (keycloak.hasRealmRole(role)) return true;
    
    // Also check the user's roles array (case-insensitive)
    const roleLower = role.toLowerCase();
    const userRoles = user?.roles || [];
    return userRoles.some(r => r.toLowerCase() === roleLower || r.toLowerCase().includes(roleLower));
  }, [user]);

  // Check if user has any of the specified roles
  const hasAnyRole = useCallback((roles: string[]): boolean => {
    return roles.some(role => hasRole(role));
  }, [hasRole]);

  // Manually refresh token
  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const refreshed = await keycloak.updateToken(30);
      if (refreshed) {
        setToken(keycloak.token || null);
        setUser(extractUserFromToken());
      }
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }, [extractUserFromToken]);

  const contextValue: AuthContextType = {
    isAuthenticated,
    isLoading,
    user,
    token,
    keycloak,
    login,
    logout,
    register,
    hasRole,
    hasAnyRole,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// HOC for protected routes
interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: string[];
  fallback?: ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRoles = [], 
  fallback = null 
}) => {
  const { isAuthenticated, isLoading, hasAnyRole, login } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      login();
    }
  }, [isLoading, isAuthenticated, login]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return fallback || null;
  }

  if (requiredRoles.length > 0 && !hasAnyRole(requiredRoles)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="text-muted-foreground mt-2">You don't have permission to access this page.</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default keycloak;
