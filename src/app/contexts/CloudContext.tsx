import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';

const API_BASE_URL = 'http://localhost:5000/api';

export interface MachineConfig {
  id: string;
  name: string;
  cpu: string;
  ram: string;
  storage: string;
  price: number;
  quantity: number;
}

export interface Machine {
  id: string;
  name: string;
  cpu: string;
  ram: string;
  storage: string;
  status: 'running' | 'free' | 'expired' | 'provisioning' | 'stopped';
  assignedTo?: string;
  assignedUserName?: string;
  task?: string;
  startDate: string;
  expiryDate?: string;
  dcvLink?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  assignedMachines: string[];
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  items: { name: string; quantity: number; price: number }[];
  organizationId?: string;
  organizationName?: string;
}

export interface MachineOrder {
  id: string;
  orderNumber: string;
  status: string;
  quantity: number;
  duration: number;
  totalAmount: number;
  machineConfig: {
    name: string;
    cpu: string;
    ram: string;
  };
  createdAt: string;
  paidAt?: string;
}

interface CloudContextType {
  machines: Machine[];
  users: User[];
  invoices: Invoice[];
  orders: MachineOrder[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  addMachine: (machine: Machine) => void;
  updateMachine: (id: string, updates: Partial<Machine>) => void;
  addUser: (user: User) => void;
  removeUser: (id: string) => void;
  assignMachineToUser: (machineId: string, userId: string, task?: string) => Promise<boolean>;
  addInvoice: (invoice: Invoice) => void;
}

const CloudContext = createContext<CloudContextType | undefined>(undefined);

// Helper to map API machine status to frontend status
function mapMachineStatus(apiStatus: string): Machine['status'] {
  const statusMap: Record<string, Machine['status']> = {
    'ACTIVE': 'free',
    'RUNNING': 'running',
    'PROVISIONING': 'provisioning',
    'STOPPED': 'stopped',
    'EXPIRED': 'expired',
    'MAINTENANCE': 'stopped',
    'TERMINATED': 'expired',
  };
  return statusMap[apiStatus] || 'free';
}

// Helper to map API invoice status to frontend status
function mapInvoiceStatus(apiStatus: string): Invoice['status'] {
  const statusMap: Record<string, Invoice['status']> = {
    'PAID': 'paid',
    'PENDING': 'pending',
    'OVERDUE': 'overdue',
    'CANCELLED': 'pending',
  };
  return statusMap[apiStatus] || 'pending';
}

export function CloudProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, token, user: authUser } = useAuth();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orders, setOrders] = useState<MachineOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch machines from API
  const fetchMachines = useCallback(async () => {
    if (!token || !authUser?.organizationId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/machines`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const mappedMachines: Machine[] = data.map((m: any) => ({
          id: m.id,
          name: m.name,
          cpu: m.machineConfig?.cpu || 'N/A',
          ram: m.machineConfig?.ram || 'N/A',
          storage: m.machineConfig?.storage || 'N/A',
          status: mapMachineStatus(m.status),
          assignedTo: m.assignments?.[0]?.userId,
          assignedUserName: m.assignments?.[0]?.user?.firstName 
            ? `${m.assignments[0].user.firstName} ${m.assignments[0].user.lastName || ''}`
            : m.assignments?.[0]?.user?.email,
          task: m.assignments?.[0]?.task,
          startDate: new Date(m.startDate).toLocaleDateString(),
          expiryDate: m.expiryDate ? new Date(m.expiryDate).toLocaleDateString() : undefined,
          dcvLink: m.dcvLink,
        }));
        setMachines(mappedMachines);
      }
    } catch (err) {
      console.error('Failed to fetch machines:', err);
    }
  }, [token, authUser?.organizationId]);

  // Fetch users from API
  const fetchUsers = useCallback(async () => {
    if (!token || !authUser?.organizationId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/machines/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const mappedUsers: User[] = data.map((u: any) => ({
          id: u.id,
          name: u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : u.email,
          email: u.email,
          role: u.role || 'USER',
          assignedMachines: u.assignedMachines?.map((a: any) => a.machineId) || [],
        }));
        setUsers(mappedUsers);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }, [token, authUser?.organizationId]);

  // Fetch orders (which represent invoices in our system)
  const fetchOrders = useCallback(async () => {
    if (!token) return;

    try {
      // Check if user is admin - use admin endpoint to get ALL orders from ALL organizations
      const isAdmin = authUser?.roles?.some(role => 
        role === 'SUPER_ADMIN' || role === 'admin' || role === 'realm-admin'
      );
      const endpoint = isAdmin ? `${API_BASE_URL}/admin/orders` : `${API_BASE_URL}/orders`;

      console.log('Fetching orders as admin:', isAdmin, 'from:', endpoint, 'roles:', authUser?.roles);

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Orders fetched:', data.length, 'orders');
        setOrders(data);
      } else {
        console.error('Failed to fetch orders:', response.status, response.statusText);
      }

      // Fetch actual invoices from invoice endpoint
      const invoiceEndpoint = isAdmin ? `${API_BASE_URL}/admin/invoices` : `${API_BASE_URL}/invoices`;
      const invoiceResponse = await fetch(invoiceEndpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (invoiceResponse.ok) {
        const invoiceData = await invoiceResponse.json();
        console.log('Invoices fetched:', invoiceData.length, 'invoices');
        
        // Map invoice data to Invoice type
        const mappedInvoices: Invoice[] = invoiceData.map((inv: any) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          date: new Date(inv.createdAt).toLocaleDateString(),
          amount: Number(inv.amount),
          status: mapInvoiceStatus(inv.status),
          items: inv.items?.map((item: any) => ({
            name: item.description,
            quantity: item.quantity,
            price: Number(item.unitPrice),
          })) || [],
          organizationId: inv.organization?.id || inv.organizationId,
          organizationName: inv.organization?.name || 'Unknown Organization',
        }));
        setInvoices(mappedInvoices);
      } else {
        console.error('Failed to fetch invoices:', invoiceResponse.status);
        setInvoices([]);
      }
    } catch (err) {
      console.error('Failed to fetch orders/invoices:', err);
    }
  }, [token, authUser?.organizationId, authUser?.roles]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    // For admin users without organizationId, still allow fetching data
    const isAdmin = authUser?.roles?.some(role => 
      role === 'SUPER_ADMIN' || role === 'admin' || role === 'realm-admin'
    );

    if (!isAuthenticated) {
      setMachines([]);
      setUsers([]);
      setInvoices([]);
      setOrders([]);
      return;
    }

    // If not admin and no organizationId, clear data
    if (!isAdmin && !authUser?.organizationId) {
      setMachines([]);
      setUsers([]);
      setInvoices([]);
      setOrders([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Admins only need to fetch orders/invoices, not machines/users
      if (isAdmin) {
        await fetchOrders();
      } else {
        await Promise.all([
          fetchMachines(),
          fetchUsers(),
          fetchOrders(),
        ]);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error('Failed to refresh data:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, authUser?.organizationId, authUser?.roles, fetchMachines, fetchUsers, fetchOrders]);

  // Fetch data on mount and when auth changes
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const addMachine = (machine: Machine) => {
    setMachines((prev) => [...prev, machine]);
  };

  const updateMachine = (id: string, updates: Partial<Machine>) => {
    setMachines((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
    );
  };

  const addUser = (user: User) => {
    setUsers((prev) => [...prev, user]);
  };

  const removeUser = (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  // Assign machine to user via API
  const assignMachineToUser = async (machineId: string, userId: string, task?: string): Promise<boolean> => {
    if (!token) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/admin/machines/assign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          machineId,
          userId,
          task,
        }),
      });

      if (response.ok) {
        // Refresh data to get updated state
        await refreshData();
        return true;
      } else {
        const errorData = await response.json();
        console.error('Assign machine error:', errorData);
        return false;
      }
    } catch (err) {
      console.error('Failed to assign machine:', err);
      return false;
    }
  };

  const addInvoice = (invoice: Invoice) => {
    setInvoices((prev) => [...prev, invoice]);
  };

  return (
    <CloudContext.Provider
      value={{
        machines,
        users,
        invoices,
        orders,
        loading,
        error,
        refreshData,
        addMachine,
        updateMachine,
        addUser,
        removeUser,
        assignMachineToUser,
        addInvoice,
      }}
    >
      {children}
    </CloudContext.Provider>
  );
}

export function useCloud() {
  const context = useContext(CloudContext);
  if (context === undefined) {
    throw new Error('useCloud must be used within a CloudProvider');
  }
  return context;
}
