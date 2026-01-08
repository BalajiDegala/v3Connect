import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PageLayout } from '../components/PageLayout';
import { SearchSortBar, applySearchSortFilter, SortOption, FilterOption } from '../components/ui/SearchSortBar';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

// Razorpay types
declare global {
  interface Window {
    Razorpay: any;
  }
}
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { 
  Server, 
  User, 
  Calendar, 
  Activity, 
  ExternalLink,
  UserPlus,
  UserMinus,
  RefreshCw,
  Loader2,
  MonitorPlay,
  Key,
  Eye,
  EyeOff,
  Copy,
  LayoutGrid,
  List,
  Film,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';

interface Machine {
  id: string;
  name: string;
  status: string;
  dcvLink: string | null;
  dcvHost: string | null;
  loginUsername: string | null;
  loginPassword: string | null;
  startDate: string;
  expiryDate: string;
  machineConfig: {
    id: string;
    name: string;
    cpu: string;
    ram: string;
    storage: string;
    gpu: string | null;
    pricePerMonth: number;
  };
  organization?: {
    id: string;
    name: string;
  };
  assignments: {
    id: string;
    task: string | null;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    show?: {
      id: string;
      name: string;
      code: string;
    } | null;
  }[];
}

interface OrgUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
}

interface Show {
  id: string;
  name: string;
  code: string;
  status: string;
}

interface MachineOrder {
  id: string;
  orderNumber: string;
  status: string;
  quantity: number;
  duration: number;
  totalAmount: number;
  createdAt: string;
  machineConfig: {
    id: string;
    name: string;
    cpu: string;
    ram: string;
    storage: string;
    gpu: string | null;
  };
  ticket?: {
    id: string;
    ticketNumber: string;
    status: string;
  } | null;
}

const API_BASE = 'http://localhost:5000/api';

export function MachinesPage() {
  const { token, user, hasRole } = useAuth();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [orders, setOrders] = useState<MachineOrder[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Assignment dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedShow, setSelectedShow] = useState<string>('');
  const [task, setTask] = useState<string>('');
  const [assigning, setAssigning] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'card'>('card');
  
  // Extend dialog state
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [machineToExtend, setMachineToExtend] = useState<Machine | null>(null);
  const [extensionDuration, setExtensionDuration] = useState<number>(1);
  const [extending, setExtending] = useState(false);
  const [extensionOrder, setExtensionOrder] = useState<any>(null);
  
  // Payment processing state
  const [processingPaymentOrderId, setProcessingPaymentOrderId] = useState<string | null>(null);
  
  // Search, sort, filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('startDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({ status: 'all' });

  const isStudioAdmin = hasRole('STUDIO_ADMIN') || hasRole('studio_admin') || hasRole('STUDIO_OWNER') || hasRole('studio_owner');
  const isPlatformAdmin = hasRole('SUPER_ADMIN') || hasRole('realm-admin') || hasRole('admin');
  const isRegularUser = !isStudioAdmin && !isPlatformAdmin;

  // Sort and filter options
  const sortOptions: SortOption[] = [
    { label: 'Start Date', value: 'startDate' },
    { label: 'Expiry Date', value: 'expiryDate' },
    { label: 'Machine Name', value: 'name' },
    { label: 'Assigned To', value: 'assignedTo' },
  ];

  const filterOptions: FilterOption[] = [
    {
      label: 'Status',
      value: 'status',
      options: [
        { label: 'Running', value: 'RUNNING' },
        { label: 'Active', value: 'ACTIVE' },
        { label: 'Expired', value: 'EXPIRED' },
      ],
    },
  ];

  useEffect(() => {
    fetchMachines();
    if (isStudioAdmin) {
      fetchOrders();
      fetchOrgUsers();
      fetchShows();
    }
  }, [token]);

  const fetchMachines = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/machines`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setMachines(data);
      }
    } catch (error) {
      console.error('Error fetching machines:', error);
      toast.error('Failed to fetch machines');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await fetch(`${API_BASE}/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const fetchOrgUsers = async () => {
    try {
      const response = await fetch(`${API_BASE}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setOrgUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchShows = async () => {
    try {
      const response = await fetch(`${API_BASE}/shows`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setShows(data);
      }
    } catch (error) {
      console.error('Error fetching shows:', error);
    }
  };

  const openAssignDialog = (machine: Machine) => {
    setSelectedMachine(machine);
    setSelectedUser('');
    setSelectedShow('');
    setTask('');
    setAssignDialogOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedMachine || !selectedUser) {
      toast.error('Please select a user');
      return;
    }

    setAssigning(true);
    try {
      // Assign machine to user
      const response = await fetch(`${API_BASE}/machines/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          machineId: selectedMachine.id,
          userId: selectedUser,
          task: task || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || 'Failed to assign machine');
        setAssigning(false);
        return;
      }

      // If show is selected, also assign to show
      if (selectedShow) {
        const showResponse = await fetch(`${API_BASE}/shows/${selectedShow}/machines`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            machineId: selectedMachine.id,
          }),
        });

        if (!showResponse.ok) {
          toast.warning('Machine assigned to user, but failed to assign to show');
        } else {
          toast.success('Machine assigned to user and show');
        }
      } else {
        toast.success('Machine assigned successfully');
      }

      setAssignDialogOpen(false);
      fetchMachines();
    } catch (error) {
      toast.error('Failed to assign machine');
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (machine: Machine) => {
    if (!machine.assignments[0]) return;
    
    try {
      const response = await fetch(`${API_BASE}/machines/${machine.id}/unassign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          assignmentId: machine.assignments[0].id,
        }),
      });

      if (response.ok) {
        toast.success('Machine unassigned');
        fetchMachines();
      } else {
        toast.error('Failed to unassign machine');
      }
    } catch (error) {
      toast.error('Failed to unassign machine');
    }
  };

  const handleConnect = (machine: Machine) => {
    if (machine.dcvLink) {
      window.open(machine.dcvLink, '_blank');
    } else {
      toast.error('No DCV link available for this machine');
    }
  };

  // Complete pending payment for an order (mock mode)
  const handleCompletePayment = async (order: MachineOrder) => {
    setProcessingPaymentOrderId(order.id);
    try {
      // Get fresh token
      const freshToken = await new Promise<string>((resolve, reject) => {
        import('../contexts/AuthContext').then(module => {
          const keycloak = module.default;
          keycloak.updateToken(30).then(() => {
            resolve(keycloak.token || '');
          }).catch(reject);
        });
      });

      // Check if this is an extension order (starts with EXT-)
      const isExtensionOrder = order.orderNumber.startsWith('EXT-');

      toast.info('Processing payment...');
      
      // Simulate payment delay
      await new Promise(r => setTimeout(r, 1000));

      // Find the razorpay order ID from the order (we need to get it from backend)
      // For now, use the mock payment endpoint
      const mockResponse = await fetch(`${API_BASE}/orders/${order.id}/mock-complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${freshToken}`,
        },
      });

      if (mockResponse.ok) {
        const result = await mockResponse.json();
        if (result.invoiceNumber) {
          toast.success(`Payment completed! Invoice: ${result.invoiceNumber}`, { duration: 5000 });
        } else {
          toast.success('Payment completed successfully!');
        }
        if (result.ticketNumber) {
          toast.info(`Ticket created: ${result.ticketNumber}`, { duration: 5000 });
        }
        fetchOrders();
        fetchMachines();
      } else {
        const error = await mockResponse.json();
        toast.error(error.error || 'Payment failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to process payment');
    } finally {
      setProcessingPaymentOrderId(null);
    }
  };

  // Cancel pending order
  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/orders/${orderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success('Order cancelled');
        fetchOrders();
      } else {
        toast.error('Failed to cancel order');
      }
    } catch (error) {
      toast.error('Failed to cancel order');
    }
  };

  // Check if machine is expiring soon (within 7 days) or expired
  const isExpiringSoon = (machine: Machine) => {
    const expiryDate = new Date(machine.expiryDate);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  };

  const isExpired = (machine: Machine) => {
    return machine.status === 'EXPIRED' || new Date(machine.expiryDate) < new Date();
  };

  const getDaysUntilExpiry = (machine: Machine) => {
    const expiryDate = new Date(machine.expiryDate);
    const now = new Date();
    return Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Open extend dialog
  const openExtendDialog = (machine: Machine) => {
    setMachineToExtend(machine);
    setExtensionDuration(1);
    setExtensionOrder(null);
    setExtendDialogOpen(true);
  };

  // Calculate extension price
  const getExtensionPrice = () => {
    if (!machineToExtend) return 0;
    const monthlyPrice = Number(machineToExtend.machineConfig.pricePerMonth || 0);
    return monthlyPrice * extensionDuration;
  };

  // Handle extend machine
  const handleExtendMachine = async () => {
    if (!machineToExtend) return;

    setExtending(true);
    try {
      // Get fresh token
      const freshToken = await new Promise<string>((resolve, reject) => {
        import('../contexts/AuthContext').then(module => {
          const keycloak = module.default;
          keycloak.updateToken(30).then(() => {
            resolve(keycloak.token || '');
          }).catch(reject);
        });
      });

      // Check if mock mode is enabled
      let useMockPayment = true; // Default to mock
      try {
        const configResponse = await fetch(`${API_BASE}/config`);
        if (configResponse.ok) {
          const config = await configResponse.json();
          useMockPayment = config.payment?.mockMode ?? true;
        }
      } catch (e) {
        console.log('Could not fetch config, using mock payment');
      }

      // Create extension order
      const response = await fetch(`${API_BASE}/machines/${machineToExtend.id}/extend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${freshToken}`,
        },
        body: JSON.stringify({ duration: extensionDuration }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create extension order');
      }

      const data = await response.json();
      setExtensionOrder(data);

      // Use mock payment if enabled in config
      if (useMockPayment) {
        console.log('Using mock payment (mock mode enabled)');
        toast.info('Processing mock payment...');
        
        // Simulate payment delay
        await new Promise(r => setTimeout(r, 1000));
        
        // Call mock payment complete endpoint
        const mockResponse = await fetch(`${API_BASE}/mock-payment/${data.razorpayOrder.id}/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${freshToken}`,
          },
        });

        if (mockResponse.ok) {
          const mockResult = await mockResponse.json();
          
          // Now verify the extension payment
          const verifyResponse = await fetch(
            `${API_BASE}/machines/${machineToExtend.id}/extend/verify`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${freshToken}`,
              },
              body: JSON.stringify({
                orderId: data.razorpayOrder.id,
                paymentId: mockResult.paymentId || `mock_${Date.now()}`,
                signature: mockResult.signature || 'mock_signature',
              }),
            }
          );

          if (verifyResponse.ok) {
            const result = await verifyResponse.json();
            toast.success(`Machine extended! New expiry: ${new Date(result.machine.newExpiryDate).toLocaleDateString()}`);
            if (result.invoiceNumber) {
              toast.info(`Invoice: ${result.invoiceNumber}`);
            }
            setExtendDialogOpen(false);
            fetchMachines();
          } else {
            toast.error('Extension verification failed');
          }
        } else {
          toast.error('Mock payment failed');
        }
      } else if (typeof window.Razorpay !== 'undefined') {
        // Use real Razorpay
        const options = {
          key: 'rzp_test_key', // Will be replaced with actual key from config
          amount: data.razorpayOrder.amount,
          currency: data.razorpayOrder.currency,
          name: 'Ankiya Cloud',
          description: `Extend ${machineToExtend.name} - ${extensionDuration} month(s)`,
          order_id: data.razorpayOrder.id,
          handler: async (response: any) => {
            // Verify payment
            try {
              const verifyResponse = await fetch(
                `${API_BASE}/machines/${machineToExtend.id}/extend/verify`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${freshToken}`,
                  },
                  body: JSON.stringify({
                    orderId: response.razorpay_order_id,
                    paymentId: response.razorpay_payment_id,
                    signature: response.razorpay_signature,
                  }),
                }
              );

              if (verifyResponse.ok) {
                const result = await verifyResponse.json();
                toast.success(`Machine extended! New expiry: ${new Date(result.machine.newExpiryDate).toLocaleDateString()}`);
                if (result.invoiceNumber) {
                  toast.info(`Invoice: ${result.invoiceNumber}`);
                }
                setExtendDialogOpen(false);
                fetchMachines();
              } else {
                toast.error('Payment verification failed');
              }
            } catch (error) {
              toast.error('Payment verification failed');
            }
          },
          prefill: {
            email: user?.email || '',
          },
          theme: {
            color: '#667eea',
          },
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();
      } else {
        toast.error('Payment system not available');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to extend machine');
    } finally {
      setExtending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, string> = {
      ACTIVE: 'bg-gray-700 text-white',
      RUNNING: 'bg-green-600 text-white',
      PROVISIONING: 'bg-yellow-600 text-white',
      STOPPED: 'bg-secondary text-secondary-foreground',
      EXPIRED: 'bg-red-600 text-white',
      MAINTENANCE: 'bg-orange-600 text-white',
    };
    return <Badge className={configs[status] || 'bg-secondary text-secondary-foreground'}>{status}</Badge>;
  };

  const getOrderStatusBadge = (status: string) => {
    const configs: Record<string, string> = {
      PENDING_PAYMENT: 'bg-yellow-600 text-white',
      PAID: 'bg-blue-600 text-white',
      PROVISIONING: 'bg-orange-600 text-white',
      COMPLETED: 'bg-green-600 text-white',
      CANCELLED: 'bg-red-600 text-white',
    };
    const labels: Record<string, string> = {
      PENDING_PAYMENT: 'Awaiting Payment',
      PAID: 'Paid - Awaiting Provisioning',
      PROVISIONING: 'Being Provisioned',
      COMPLETED: 'Completed',
      CANCELLED: 'Cancelled',
    };
    return <Badge className={configs[status] || 'bg-secondary text-secondary-foreground'}>{labels[status] || status}</Badge>;
  };

  // Base visible machines (filter by user role)
  const baseMachines = isRegularUser
    ? machines.filter(m => m.assignments.some(a => a.user.id === user?.dbId))
    : machines;

  // Apply search, sort, and filter
  const filteredMachines = useMemo(() => {
    let result = [...baseMachines];

    // Apply search
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      result = result.filter((machine) => {
        const searchableFields = [
          machine.name,
          machine.assignments[0]?.user?.firstName || '',
          machine.assignments[0]?.user?.lastName || '',
          machine.machineConfig?.name || '',
        ];
        return searchableFields.some(field => 
          field.toLowerCase().includes(searchLower)
        );
      });
    }

    // Apply status filter
    if (filterValues.status && filterValues.status !== 'all') {
      result = result.filter(m => m.status === filterValues.status);
    }

    // Apply sort
    result.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortField) {
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'assignedTo':
          aVal = `${a.assignments[0]?.user?.firstName || ''} ${a.assignments[0]?.user?.lastName || ''}`;
          bVal = `${b.assignments[0]?.user?.firstName || ''} ${b.assignments[0]?.user?.lastName || ''}`;
          break;
        case 'expiryDate':
          aVal = a.expiryDate ? new Date(a.expiryDate).getTime() : 0;
          bVal = b.expiryDate ? new Date(b.expiryDate).getTime() : 0;
          break;
        case 'startDate':
        default:
          aVal = a.startDate ? new Date(a.startDate).getTime() : 0;
          bVal = b.startDate ? new Date(b.startDate).getTime() : 0;
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [baseMachines, searchQuery, sortField, sortDirection, filterValues]);

  const visibleMachines = filteredMachines;
  const activeMachines = filteredMachines.filter(m => m.status === 'ACTIVE');
  const runningMachines = filteredMachines.filter(m => m.status === 'RUNNING');
  const expiredMachines = filteredMachines.filter(m => m.status === 'EXPIRED');

  // Credentials Section Component
  const CredentialsSection = ({ machine }: { machine: Machine }) => {
    const [showPassword, setShowPassword] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);

    const copyToClipboard = async (text: string, field: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(field);
        setTimeout(() => setCopied(null), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    };

    return (
      <div className="pt-3 border-t border-border">
        <div className="flex items-center gap-2 mb-2">
          <Key className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Backup Login Credentials</span>
        </div>
        <div className="bg-muted rounded-lg p-3 space-y-2">
          {machine.loginUsername && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Username:</span>
                <span className="text-foreground font-mono">{machine.loginUsername}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => copyToClipboard(machine.loginUsername!, 'username')}
              >
                <Copy className={`w-3 h-3 ${copied === 'username' ? 'text-green-500' : 'text-muted-foreground'}`} />
              </Button>
            </div>
          )}
          {machine.loginPassword && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Password:</span>
                <span className="text-foreground font-mono">
                  {showPassword ? machine.loginPassword : '••••••••'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="w-3 h-3 text-muted-foreground" />
                  ) : (
                    <Eye className="w-3 h-3 text-muted-foreground" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => copyToClipboard(machine.loginPassword!, 'password')}
                >
                  <Copy className={`w-3 h-3 ${copied === 'password' ? 'text-green-500' : 'text-muted-foreground'}`} />
                </Button>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Use these credentials if your primary login doesn't work.
          </p>
        </div>
      </div>
    );
  };

  const MachineCard = ({ machine }: { machine: Machine }) => {
    const currentAssignment = machine.assignments[0];
    const isAssigned = !!currentAssignment;
    const isAssignedToMe = currentAssignment?.user.id === user?.dbId;
    const canAssign = isStudioAdmin && !isAssigned && (machine.status === 'ACTIVE');
    const canUnassign = isStudioAdmin && isAssigned;
    // Allow admin/owner to connect to any machine, or user if assigned to them
    const canConnect = machine.dcvLink && (isStudioAdmin || isAssignedToMe);

    return (
      <Card className="bg-secondary border-border">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Server className="w-5 h-5 text-gray-500" />
                {machine.name}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {machine.machineConfig.name}
              </p>
            </div>
            {getStatusBadge(machine.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Specs */}
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="text-center p-2 bg-muted rounded">
              <p className="text-muted-foreground text-xs">CPU</p>
              <p className="text-foreground">{machine.machineConfig.cpu}</p>
            </div>
            <div className="text-center p-2 bg-muted rounded">
              <p className="text-muted-foreground text-xs">RAM</p>
              <p className="text-foreground">{machine.machineConfig.ram}</p>
            </div>
            <div className="text-center p-2 bg-muted rounded">
              <p className="text-muted-foreground text-xs">Storage</p>
              <p className="text-foreground">{machine.machineConfig.storage}</p>
            </div>
          </div>

          {/* GPU if exists */}
          {machine.machineConfig.gpu && (
            <div className="text-sm p-2 bg-purple-900/30 border border-purple-700/50 rounded">
              <span className="text-purple-300">GPU:</span>
              <span className="text-foreground ml-2">{machine.machineConfig.gpu}</span>
            </div>
          )}

          {/* Assignment Info */}
          {isAssigned && (
            <div className="pt-3 border-t border-border">
              <div className="flex items-center gap-2 text-sm mb-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Assigned to:</span>
                <span className="text-foreground">
                  {currentAssignment.user.firstName} {currentAssignment.user.lastName}
                </span>
              </div>
              {currentAssignment.task && (
                <div className="flex items-center gap-2 text-sm mb-2">
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Task:</span>
                  <span className="text-foreground">{currentAssignment.task}</span>
                </div>
              )}
              {currentAssignment.show && (
                <div className="flex items-center gap-2 text-sm">
                  <Film className="w-4 h-4 text-blue-500" />
                  <span className="text-muted-foreground">Show:</span>
                  <Badge variant="outline" className="text-blue-500 border-blue-500">
                    {currentAssignment.show.code}
                  </Badge>
                </div>
              )}
            </div>
          )}

          {/* Dates */}
          <div className="pt-3 border-t border-border text-sm space-y-1">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Start:</span>
              <span className="text-foreground">{new Date(machine.startDate).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Expires:</span>
              <span className={`${isExpired(machine) ? 'text-red-500 font-medium' : isExpiringSoon(machine) ? 'text-yellow-500 font-medium' : 'text-foreground'}`}>
                {new Date(machine.expiryDate).toLocaleDateString()}
                {isExpiringSoon(machine) && ` (${getDaysUntilExpiry(machine)} days left)`}
                {isExpired(machine) && ' (Expired)'}
              </span>
            </div>
          </div>

          {/* Expiry Warning */}
          {isStudioAdmin && (isExpiringSoon(machine) || isExpired(machine)) && (
            <div className={`p-3 rounded-lg flex items-center justify-between ${isExpired(machine) ? 'bg-red-900/30 border border-red-700/50' : 'bg-yellow-900/30 border border-yellow-700/50'}`}>
              <div className="flex items-center gap-2">
                <Clock className={`w-4 h-4 ${isExpired(machine) ? 'text-red-400' : 'text-yellow-400'}`} />
                <span className={`text-sm ${isExpired(machine) ? 'text-red-300' : 'text-yellow-300'}`}>
                  {isExpired(machine) ? 'Machine has expired' : 'Expiring soon'}
                </span>
              </div>
              <Button 
                size="sm" 
                onClick={() => openExtendDialog(machine)}
                className={isExpired(machine) ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700'}
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Extend
              </Button>
            </div>
          )}

          {/* Login Credentials (if provided) */}
          {(machine.loginUsername || machine.loginPassword) && (isAssignedToMe || isStudioAdmin) && (
            <CredentialsSection machine={machine} />
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-border flex flex-wrap gap-2">
            {canConnect && (
              <Button onClick={() => handleConnect(machine)} className="flex-1 min-w-[100px]">
                <MonitorPlay className="w-4 h-4 mr-2" />
                Connect
              </Button>
            )}
            {canAssign && (
              <Button onClick={() => openAssignDialog(machine)} variant="outline" className="flex-1 min-w-[100px]">
                <UserPlus className="w-4 h-4 mr-2" />
                Assign
              </Button>
            )}
            {canUnassign && (
              <Button 
                onClick={() => handleUnassign(machine)} 
                variant="outline" 
                className="flex-1 min-w-[100px] text-red-400 hover:text-red-300"
              >
                <UserMinus className="w-4 h-4 mr-2" />
                Unassign
              </Button>
            )}
            {isStudioAdmin && !isExpiringSoon(machine) && !isExpired(machine) && (
              <Button 
                onClick={() => openExtendDialog(machine)} 
                variant="outline" 
                className="flex-1 min-w-[100px] text-green-400 hover:text-green-300 border-green-700"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Extend
              </Button>
            )}
            {machine.dcvLink && isStudioAdmin && (
              <Button 
                onClick={() => handleConnect(machine)} 
                variant="ghost" 
                size="icon"
                title="Open DCV"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const MachineListTable = ({ machines }: { machines: Machine[] }) => {
    if (machines.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No machines in this category</p>
        </div>
      );
    }

    return (
      <Card className="bg-secondary border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-muted-foreground">Machine</TableHead>
              <TableHead className="text-muted-foreground">Config</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground">Assigned To</TableHead>
              <TableHead className="text-muted-foreground">Start Date</TableHead>
              <TableHead className="text-muted-foreground">Expiry Date</TableHead>
              <TableHead className="text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {machines.map((machine) => {
              const currentAssignment = machine.assignments[0];
              const isAssigned = !!currentAssignment;
              const isAssignedToMe = currentAssignment?.user.id === user?.dbId;
              const canAssign = isStudioAdmin && !isAssigned && (machine.status === 'ACTIVE');
              const canUnassign = isStudioAdmin && isAssigned;
              // Allow admin/owner to connect to any machine, or user if assigned to them
              const canConnect = machine.dcvLink && (isStudioAdmin || isAssignedToMe);

              return (
                <TableRow key={machine.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-gray-500" />
                      <span className="font-medium text-foreground">{machine.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-foreground">
                      {machine.machineConfig.cpu} • {machine.machineConfig.ram} • {machine.machineConfig.storage}
                      {machine.machineConfig.gpu && <div className="text-purple-400">GPU: {machine.machineConfig.gpu}</div>}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(machine.status)}</TableCell>
                  <TableCell>
                    {isAssigned ? (
                      <div className="text-sm">
                        <div className="text-foreground">
                          {currentAssignment.user.firstName} {currentAssignment.user.lastName}
                        </div>
                        {currentAssignment.task && (
                          <div className="text-muted-foreground text-xs">{currentAssignment.task}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(machine.startDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className={`text-sm ${isExpired(machine) ? 'text-red-500 font-medium' : isExpiringSoon(machine) ? 'text-yellow-500 font-medium' : 'text-muted-foreground'}`}>
                    {new Date(machine.expiryDate).toLocaleDateString()}
                    {isExpiringSoon(machine) && <span className="ml-1">⚠️</span>}
                    {isExpired(machine) && <span className="ml-1">❌</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 flex-wrap">
                      {canConnect && (
                        <Button
                          size="sm"
                          onClick={() => window.open(machine.dcvLink!, '_blank')}
                          className="bg-gray-700 hover:bg-gray-800"
                        >
                          <MonitorPlay className="w-4 h-4 mr-1" />
                          Connect
                        </Button>
                      )}
                      {canAssign && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedMachine(machine);
                            setAssignDialogOpen(true);
                          }}
                          className="border-border"
                        >
                          <UserPlus className="w-4 h-4 mr-1" />
                          Assign
                        </Button>
                      )}
                      {canUnassign && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnassign(machine)}
                          className="border-border text-red-400 hover:text-red-300"
                        >
                          <UserMinus className="w-4 h-4 mr-1" />
                          Unassign
                        </Button>
                      )}
                      {isStudioAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openExtendDialog(machine)}
                          className={`border-border ${isExpired(machine) ? 'text-red-400 hover:text-red-300 border-red-700' : isExpiringSoon(machine) ? 'text-yellow-400 hover:text-yellow-300 border-yellow-700' : 'text-green-400 hover:text-green-300 border-green-700'}`}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Extend
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    );
  };

  const OrderCard = ({ order }: { order: MachineOrder }) => {
    return (
      <Card className="bg-secondary border-border border-dashed">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Server className="w-5 h-5 text-gray-500" />
                {order.machineConfig.name}
                <Badge variant="outline" className="ml-2">x{order.quantity}</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Order: {order.orderNumber}
              </p>
            </div>
            {getOrderStatusBadge(order.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Specs */}
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="text-center p-2 bg-muted rounded">
              <p className="text-muted-foreground text-xs">CPU</p>
              <p className="text-foreground">{order.machineConfig.cpu}</p>
            </div>
            <div className="text-center p-2 bg-muted rounded">
              <p className="text-muted-foreground text-xs">RAM</p>
              <p className="text-foreground">{order.machineConfig.ram}</p>
            </div>
            <div className="text-center p-2 bg-muted rounded">
              <p className="text-muted-foreground text-xs">Storage</p>
              <p className="text-foreground">{order.machineConfig.storage}</p>
            </div>
          </div>

          {/* GPU if exists */}
          {order.machineConfig.gpu && (
            <div className="text-sm p-2 bg-purple-900/30 border border-purple-700/50 rounded">
              <span className="text-purple-300">GPU:</span>
              <span className="text-foreground ml-2">{order.machineConfig.gpu}</span>
            </div>
          )}

          {/* Order Info */}
          <div className="pt-3 border-t border-border text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Duration:</span>
              <span className="text-foreground">{order.duration} month(s)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total:</span>
              <span className="text-foreground font-medium">₹{Number(order.totalAmount).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ordered:</span>
              <span className="text-foreground">{new Date(order.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Ticket Info */}
          {order.ticket && (
            <div className="pt-3 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Ticket: <span className="text-foreground">{order.ticket.ticketNumber}</span>
                {' - '}
                <span className={order.ticket.status === 'OPEN' ? 'text-yellow-500' : 'text-green-500'}>
                  {order.ticket.status}
                </span>
              </p>
            </div>
          )}

          {/* Actions for pending orders */}
          {order.status === 'PENDING_PAYMENT' && (
            <div className="pt-3 border-t border-border flex gap-2">
              <Button 
                onClick={() => handleCompletePayment(order)}
                disabled={processingPaymentOrderId === order.id}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {processingPaymentOrderId === order.id ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Complete Payment
                  </>
                )}
              </Button>
              <Button 
                onClick={() => handleCancelOrder(order.id)}
                variant="outline"
                className="text-red-400 hover:text-red-300 border-red-700"
              >
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Filter orders to show pending ones (only for studio admins)
  const pendingOrders = isStudioAdmin ? orders.filter(o => 
    o.status === 'PENDING_PAYMENT' || o.status === 'PAID' || o.status === 'PROVISIONING' || o.status === 'PROCESSING'
  ) : [];

  return (
    <PageLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {isRegularUser ? 'My Machines' : 'Machines'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isRegularUser 
              ? 'View your assigned cloud workstations' 
              : 'Manage and assign cloud machines to users'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === 'card' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('card')}
              className="rounded-none"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-none"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
          <Button onClick={fetchMachines} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {loading && baseMachines.length === 0 && pendingOrders.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        </div>
      ) : baseMachines.length === 0 && pendingOrders.length === 0 ? (
        <Card className="bg-secondary border-border">
          <CardContent className="py-12 text-center">
            <Server className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {isRegularUser ? 'No machines assigned to you' : 'No machines yet'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {isRegularUser 
                ? 'Contact your studio admin to get a machine assigned.'
                : 'Order machines from the Quote page to get started.'}
            </p>
            {!isRegularUser && (
              <Button onClick={() => window.location.href = '/quote'}>
                Go to Quote Page
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Pending Orders Section */}
          {pendingOrders.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <Server className="w-5 h-5" />
                Pending Requests ({pendingOrders.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {pendingOrders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            </div>
          )}

          {/* Active Machines Section */}
          {baseMachines.length > 0 && (
            <>
              {/* Search, Sort, Filter Bar */}
              <SearchSortBar
                searchPlaceholder="Search machines by name, user, or config..."
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
                sortOptions={sortOptions}
                sortValue={sortField}
                sortDirection={sortDirection}
                onSortChange={(field, direction) => {
                  setSortField(field);
                  setSortDirection(direction);
                }}
                filters={filterOptions}
                filterValues={filterValues}
                onFilterChange={(key, value) => setFilterValues(prev => ({ ...prev, [key]: value }))}
              />

              <Tabs defaultValue="all" className="w-full mt-6">
                <TabsList className="bg-secondary border-border">
                  <TabsTrigger value="all">All ({visibleMachines.length})</TabsTrigger>
                  <TabsTrigger value="running">Running ({runningMachines.length})</TabsTrigger>
                  <TabsTrigger value="active">Ready ({activeMachines.length})</TabsTrigger>
                  <TabsTrigger value="expired">Expired ({expiredMachines.length})</TabsTrigger>
                </TabsList>

          <TabsContent value="all" className="mt-6">
            {visibleMachines.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No machines found matching your filters</p>
              </div>
            ) : viewMode === 'card' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleMachines.map((machine) => (
                  <MachineCard key={machine.id} machine={machine} />
                ))}
              </div>
            ) : (
              <MachineListTable machines={visibleMachines} />
            )}
          </TabsContent>

          <TabsContent value="running" className="mt-6">
            {runningMachines.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No running machines</p>
              </div>
            ) : viewMode === 'card' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {runningMachines.map((machine) => (
                  <MachineCard key={machine.id} machine={machine} />
                ))}
              </div>
            ) : (
              <MachineListTable machines={runningMachines} />
            )}
          </TabsContent>

          <TabsContent value="active" className="mt-6">
            {activeMachines.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No ready machines</p>
              </div>
            ) : viewMode === 'card' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeMachines.map((machine) => (
                  <MachineCard key={machine.id} machine={machine} />
                ))}
              </div>
            ) : (
              <MachineListTable machines={activeMachines} />
            )}
          </TabsContent>

          <TabsContent value="expired" className="mt-6">
            {expiredMachines.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No expired machines</p>
              </div>
            ) : viewMode === 'card' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {expiredMachines.map((machine) => (
                  <MachineCard key={machine.id} machine={machine} />
                ))}
              </div>
            ) : (
              <MachineListTable machines={expiredMachines} />
            )}
          </TabsContent>
                </Tabs>
            </>
          )}
        </div>
      )}

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-foreground">Assign Machine</DialogTitle>
            <DialogDescription>
              Assign {selectedMachine?.name} to a user in your organization
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-muted-foreground">Select User *</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose user..." />
                </SelectTrigger>
                <SelectContent>
                  {orgUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-muted-foreground">Assign to Show (optional)</Label>
              <Select value={selectedShow} onValueChange={setSelectedShow}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose show (optional)..." />
                </SelectTrigger>
                <SelectContent>
                  {shows.map((show) => (
                    <SelectItem key={show.id} value={show.id}>
                      {show.name} ({show.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-muted-foreground">Task/Purpose (optional)</Label>
              <Input
                placeholder="e.g., VFX Compositing"
                value={task}
                onChange={(e) => setTask(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={assigning || !selectedUser}>
              {assigning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Assign Machine
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Machine Dialog */}
      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent className="bg-secondary border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-green-500" />
              Extend Machine Subscription
            </DialogTitle>
            <DialogDescription>
              Extend the subscription period for {machineToExtend?.name}
            </DialogDescription>
          </DialogHeader>

          {machineToExtend && (
            <div className="space-y-4 py-4">
              {/* Machine Info */}
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Machine:</span>
                  <span className="font-medium text-foreground">{machineToExtend.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Config:</span>
                  <span className="text-foreground">{machineToExtend.machineConfig.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Current Expiry:</span>
                  <span className={`${isExpired(machineToExtend) ? 'text-red-500' : isExpiringSoon(machineToExtend) ? 'text-yellow-500' : 'text-foreground'}`}>
                    {new Date(machineToExtend.expiryDate).toLocaleDateString()}
                    {isExpired(machineToExtend) && ' (Expired)'}
                    {isExpiringSoon(machineToExtend) && ` (${getDaysUntilExpiry(machineToExtend)} days left)`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Monthly Price:</span>
                  <span className="text-foreground">₹{Number(machineToExtend.machineConfig.pricePerMonth || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Duration Selection */}
              <div className="space-y-2">
                <Label htmlFor="extension-duration" className="text-foreground">Extension Duration</Label>
                <Select
                  value={extensionDuration.toString()}
                  onValueChange={(value) => setExtensionDuration(Number(value))}
                >
                  <SelectTrigger className="bg-muted border-border">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent className="bg-secondary border-border">
                    <SelectItem value="1">1 Month</SelectItem>
                    <SelectItem value="2">2 Months</SelectItem>
                    <SelectItem value="3">3 Months</SelectItem>
                    <SelectItem value="6">6 Months</SelectItem>
                    <SelectItem value="12">12 Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* New Expiry Date Preview */}
              <div className="p-4 bg-green-900/20 border border-green-700/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-green-400">New Expiry Date:</span>
                  <span className="font-medium text-green-300">
                    {(() => {
                      const currentExpiry = new Date(machineToExtend.expiryDate);
                      const now = new Date();
                      const baseDate = currentExpiry < now ? now : currentExpiry;
                      const newExpiry = new Date(baseDate);
                      newExpiry.setMonth(newExpiry.getMonth() + extensionDuration);
                      return newExpiry.toLocaleDateString();
                    })()}
                  </span>
                </div>
              </div>

              {/* Total Amount */}
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between text-lg">
                  <span className="text-muted-foreground">Total Amount:</span>
                  <span className="font-bold text-foreground">₹{getExtensionPrice().toLocaleString()}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {extensionDuration} month(s) × ₹{Number(machineToExtend.machineConfig.pricePerMonth || 0).toLocaleString()}/month
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleExtendMachine} 
              disabled={extending}
              className="bg-green-600 hover:bg-green-700"
            >
              {extending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>  
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Extend & Pay ₹{getExtensionPrice().toLocaleString()}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>
      </div>
    </PageLayout>
  );
}
