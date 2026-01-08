/**
 * Keycloak Admin Service
 * Handles admin operations like role assignments
 */

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:32645';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'ankiya';
const KEYCLOAK_ADMIN_USER = process.env.KEYCLOAK_ADMIN_USER || 'admin';
const KEYCLOAK_ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin_dev_password';

interface KeycloakRole {
  id: string;
  name: string;
}

class KeycloakAdminService {
  private adminToken: string | null = null;
  private tokenExpiry: number = 0;

  /**
   * Get admin access token
   */
  private async getAdminToken(): Promise<string> {
    // Check if we have a valid token
    if (this.adminToken && Date.now() < this.tokenExpiry) {
      return this.adminToken;
    }

    try {
      const response = await fetch(
        `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'password',
            client_id: 'admin-cli',
            username: KEYCLOAK_ADMIN_USER,
            password: KEYCLOAK_ADMIN_PASSWORD,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get admin token: ${response.status}`);
      }

      const data = await response.json();
      this.adminToken = data.access_token;
      // Token expires in expires_in seconds, subtract 60s buffer
      this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

      return this.adminToken!;
    } catch (error) {
      console.error('Error getting Keycloak admin token:', error);
      throw error;
    }
  }

  /**
   * Get all realm roles
   */
  async getRealmRoles(): Promise<KeycloakRole[]> {
    try {
      const token = await this.getAdminToken();
      const response = await fetch(
        `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/roles`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get roles: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting realm roles:', error);
      throw error;
    }
  }

  /**
   * Get a specific realm role by name
   */
  async getRoleByName(roleName: string): Promise<KeycloakRole | null> {
    try {
      const roles = await this.getRealmRoles();
      return roles.find(r => r.name === roleName) || null;
    } catch (error) {
      console.error(`Error getting role ${roleName}:`, error);
      return null;
    }
  }

  /**
   * Assign a realm role to a user
   */
  async assignRoleToUser(userId: string, roleName: string): Promise<boolean> {
    try {
      const token = await this.getAdminToken();
      
      // First get the role
      const role = await this.getRoleByName(roleName);
      if (!role) {
        console.error(`Role ${roleName} not found`);
        return false;
      }

      const response = await fetch(
        `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${userId}/role-mappings/realm`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([{ id: role.id, name: role.name }]),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        console.error(`Failed to assign role: ${response.status} - ${text}`);
        return false;
      }

      console.log(`Successfully assigned role ${roleName} to user ${userId}`);
      return true;
    } catch (error) {
      console.error(`Error assigning role ${roleName} to user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Remove a realm role from a user
   */
  async removeRoleFromUser(userId: string, roleName: string): Promise<boolean> {
    try {
      const token = await this.getAdminToken();
      
      const role = await this.getRoleByName(roleName);
      if (!role) {
        console.error(`Role ${roleName} not found`);
        return false;
      }

      const response = await fetch(
        `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${userId}/role-mappings/realm`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([{ id: role.id, name: role.name }]),
        }
      );

      if (!response.ok) {
        console.error(`Failed to remove role: ${response.status}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`Error removing role ${roleName} from user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Get user's current realm roles
   */
  async getUserRoles(userId: string): Promise<KeycloakRole[]> {
    try {
      const token = await this.getAdminToken();
      
      const response = await fetch(
        `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${userId}/role-mappings/realm`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get user roles: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error getting roles for user ${userId}:`, error);
      return [];
    }
  }
}

export const keycloakAdminService = new KeycloakAdminService();
