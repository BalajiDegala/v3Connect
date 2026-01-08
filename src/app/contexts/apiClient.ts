import keycloak from './AuthContext';

const API_BASE_URL = 'http://localhost:5000/api';

// API Response types
interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// Request options
interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  requireAuth?: boolean;
}

// API Client class
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // Get auth headers
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (keycloak.authenticated && keycloak.token) {
      // Refresh token if it's about to expire
      try {
        await keycloak.updateToken(30);
      } catch (error) {
        console.error('Failed to refresh token:', error);
      }
      headers['Authorization'] = `Bearer ${keycloak.token}`;
    }

    return headers;
  }

  // Generic request method
  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { method = 'GET', body, headers = {}, requireAuth = true } = options;

    try {
      const authHeaders = requireAuth ? await this.getAuthHeaders() : { 'Content-Type': 'application/json' };
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: { ...authHeaders, ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          error: data.error || data.message || `Request failed with status ${response.status}`,
        };
      }

      return { data };
    } catch (error) {
      console.error('API request failed:', error);
      return {
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  // Convenience methods
  get<T>(endpoint: string, requireAuth = true) {
    return this.request<T>(endpoint, { method: 'GET', requireAuth });
  }

  post<T>(endpoint: string, body: any, requireAuth = true) {
    return this.request<T>(endpoint, { method: 'POST', body, requireAuth });
  }

  put<T>(endpoint: string, body: any, requireAuth = true) {
    return this.request<T>(endpoint, { method: 'PUT', body, requireAuth });
  }

  patch<T>(endpoint: string, body: any, requireAuth = true) {
    return this.request<T>(endpoint, { method: 'PATCH', body, requireAuth });
  }

  delete<T>(endpoint: string, requireAuth = true) {
    return this.request<T>(endpoint, { method: 'DELETE', requireAuth });
  }
}

// Create and export the API client instance
export const api = new ApiClient(API_BASE_URL);

// ==========================================
// API Service Functions
// ==========================================

// Organization/Studio APIs
export interface Organization {
  id: string;
  name: string;
  domain?: string;
  status: string;
  subscription: string;
  contactEmail: string;
  contactPhone?: string;
  createdAt: string;
}

export const organizationApi = {
  // Get current user's organization
  getMy: () => api.get<Organization>('/organizations/me'),
  
  // Create organization (during registration)
  create: (data: Partial<Organization>) => api.post<Organization>('/organizations', data),
  
  // Update organization
  update: (id: string, data: Partial<Organization>) => api.put<Organization>(`/organizations/${id}`, data),
  
  // Get organization by ID (admin only)
  getById: (id: string) => api.get<Organization>(`/organizations/${id}`),
  
  // List all organizations (admin only)
  list: () => api.get<Organization[]>('/organizations'),
};

// User APIs
export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: string;
  status: string;
  createdAt: string;
}

export const userApi = {
  // Get current user profile
  getProfile: () => api.get<UserProfile>('/users/me'),
  
  // Update profile
  updateProfile: (data: Partial<UserProfile>) => api.put<UserProfile>('/users/me', data),
  
  // List organization users (studio admin)
  listOrgUsers: () => api.get<UserProfile[]>('/users'),
  
  // Invite user to organization
  invite: (email: string, role: string) => api.post<void>('/users/invite', { email, role }),
  
  // Remove user from organization
  remove: (userId: string) => api.delete<void>(`/users/${userId}`),
};

// Machine APIs
export interface Machine {
  id: string;
  name: string;
  type: string;
  specs: {
    cpu: string;
    ram: string;
    gpu: string;
    storage: string;
  };
  pricePerHour: number;
  pricePerDay: number;
  pricePerMonth: number;
  status: string;
  region: string;
}

export interface MachineAllocation {
  id: string;
  machineId: string;
  machine: Machine;
  userId: string;
  organizationId: string;
  status: string;
  dcvLink?: string;
  dcvUsername?: string;
  startDate: string;
  endDate?: string;
}

export const machineApi = {
  // List available machine types
  listTypes: () => api.get<Machine[]>('/machines/types', false),
  
  // Get machine details
  getById: (id: string) => api.get<Machine>(`/machines/${id}`),
  
  // Get user's allocations
  getMyAllocations: () => api.get<MachineAllocation[]>('/machines/allocations/me'),
  
  // Get organization allocations (admin)
  getOrgAllocations: () => api.get<MachineAllocation[]>('/machines/allocations'),
  
  // Request machine allocation
  requestAllocation: (machineTypeId: string, duration: string, task?: string) => 
    api.post<MachineAllocation>('/machines/allocations', { machineTypeId, duration, task }),
};

// Order APIs
export interface Order {
  id: string;
  organizationId: string;
  machineTypeId: string;
  quantity: number;
  duration: string;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
}

export const orderApi = {
  // Create new order
  create: (data: { machineTypeId: string; quantity: number; duration: string }) => 
    api.post<Order>('/orders', data),
  
  // Get order by ID
  getById: (id: string) => api.get<Order>(`/orders/${id}`),
  
  // List organization orders
  list: () => api.get<Order[]>('/orders'),
  
  // Cancel order
  cancel: (id: string) => api.post<Order>(`/orders/${id}/cancel`, {}),
};

// Payment APIs
export interface PaymentOrder {
  orderId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export const paymentApi = {
  // Create payment order
  createPaymentOrder: (orderId: string) => 
    api.post<PaymentOrder>('/payments/create-order', { orderId }),
  
  // Verify payment
  verifyPayment: (data: { 
    razorpay_order_id: string; 
    razorpay_payment_id: string; 
    razorpay_signature: string;
    orderId: string;
  }) => api.post<{ success: boolean }>('/payments/verify', data),
  
  // Get payment history
  getHistory: () => api.get<any[]>('/payments/history'),
};

// Support Ticket APIs
export interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export const supportApi = {
  // Create ticket
  create: (data: { subject: string; description: string; priority: string; category: string }) => 
    api.post<SupportTicket>('/support/tickets', data),
  
  // List tickets
  list: () => api.get<SupportTicket[]>('/support/tickets'),
  
  // Get ticket details
  getById: (id: string) => api.get<SupportTicket>(`/support/tickets/${id}`),
  
  // Add reply
  addReply: (id: string, message: string) => 
    api.post<void>(`/support/tickets/${id}/replies`, { message }),
  
  // Close ticket
  close: (id: string) => api.post<SupportTicket>(`/support/tickets/${id}/close`, {}),
};

// Admin APIs
export const adminApi = {
  // Dashboard stats
  getDashboardStats: () => api.get<{
    totalOrganizations: number;
    totalUsers: number;
    totalMachines: number;
    activeAllocations: number;
    pendingOrders: number;
    revenue: number;
  }>('/admin/dashboard'),
  
  // List all organizations
  listOrganizations: () => api.get<Organization[]>('/admin/organizations'),
  
  // Approve/reject organization
  updateOrgStatus: (id: string, status: string) => 
    api.patch<Organization>(`/admin/organizations/${id}/status`, { status }),
  
  // List pending allocations
  listPendingAllocations: () => api.get<MachineAllocation[]>('/admin/allocations/pending'),
  
  // Provision machine
  provisionMachine: (allocationId: string, dcvLink: string, dcvCredentials: { username: string; password: string }) => 
    api.post<MachineAllocation>(`/admin/allocations/${allocationId}/provision`, { dcvLink, dcvCredentials }),
  
  // Manage machine inventory
  listMachineInventory: () => api.get<any[]>('/admin/machines'),
  addMachine: (data: any) => api.post<any>('/admin/machines', data),
  updateMachine: (id: string, data: any) => api.put<any>(`/admin/machines/${id}`, data),
};

export default api;
