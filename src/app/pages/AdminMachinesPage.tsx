import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PageLayout } from '../components/PageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { SearchSortBar, applySearchSortFilter, SortOption, FilterOption } from '../components/ui/SearchSortBar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { 
  Server,
  Clock,
  CheckCircle,
  AlertCircle,
  MoreVertical,
  Plus,
  Building2,
  RefreshCw,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

interface MachineOrder {
  id: string;
  orderNumber: string;
  status: string;
  quantity: number;
  duration: number;
  totalAmount: number;
  createdAt: string;
  paidAt: string | null;
  organization: {
    id: string;
    name: string;
    contactEmail: string;
  };
  machineConfig: {
    id: string;
    name: string;
    cpu: string;
    ram: string;
    storage: string;
    gpu: string | null;
  };
  machines: Machine[];
}

interface Machine {
  id: string;
  name: string;
  status: string;
  dcvLink: string | null;
  ipAddress?: string;
  startDate: string;
  expiryDate: string;
  assignments: {
    id: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  }[];
}

const API_BASE = 'http://localhost:5000/api';

export function AdminMachinesPage() {
  const { token, hasRole } = useAuth();
  const [orders, setOrders] = useState<MachineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({
    status: 'all',
  });
  
  // Provision dialog
  const [provisionDialogOpen, setProvisionDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<MachineOrder | null>(null);
  const [provisioningMachine, setProvisioningMachine] = useState<number>(0);
  const [provisioning, setProvisioning] = useState(false);
  const [machineDetails, setMachineDetails] = useState({
    name: '',
    dcvLink: '',
    ipAddress: '',
    loginUsername: '',
    loginPassword: '',
  });

  const isPlatformAdmin = hasRole('admin') || hasRole('SUPER_ADMIN') || hasRole('realm-admin');

  // Sort options
  const sortOptions: SortOption[] = [
    { label: 'Order Date', value: 'createdAt' },
    { label: 'Order Number', value: 'orderNumber' },
    { label: 'Organization', value: 'organization.name' },
    { label: 'Amount', value: 'totalAmount' },
    { label: 'Quantity', value: 'quantity' },
  ];

  // Filter options
  const filterOptions: FilterOption[] = [
    {
      label: 'Status',
      value: 'status',
      options: [
        { label: 'Paid', value: 'PAID' },
        { label: 'Processing', value: 'PROCESSING' },
        { label: 'Completed', value: 'COMPLETED' },
        { label: 'Pending Payment', value: 'PENDING_PAYMENT' },
        { label: 'Cancelled', value: 'CANCELLED' },
      ],
    },
  ];

  useEffect(() => {
    if (isPlatformAdmin) {
      fetchOrders();
    }
  }, [token, isPlatformAdmin]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/admin/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const openProvisionDialog = (order: MachineOrder) => {
    setSelectedOrder(order);
    setProvisioningMachine(0);
    const existingCount = order.machines?.length || 0;
    setMachineDetails({
      name: `${order.organization.name.substring(0, 8).toUpperCase()}-${order.machineConfig.name.toUpperCase()}-${String(existingCount + 1).padStart(2, '0')}`,
      dcvLink: '',
      ipAddress: '',
      loginUsername: '',
      loginPassword: '',
    });
    setProvisionDialogOpen(true);
  };

  const handleProvisionMachine = async () => {
    if (!selectedOrder || !machineDetails.name || !machineDetails.dcvLink) {
      toast.error('Please fill in machine name and DCV link');
      return;
    }

    setProvisioning(true);
    try {
      const response = await fetch(`${API_BASE}/admin/machines/provision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          name: machineDetails.name,
          dcvLink: machineDetails.dcvLink,
          ipAddress: machineDetails.ipAddress,
          loginUsername: machineDetails.loginUsername,
          loginPassword: machineDetails.loginPassword,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Machine ${machineDetails.name} provisioned successfully`);
        
        // Update local state
        setOrders(prev => prev.map(order => {
          if (order.id === selectedOrder.id) {
            return {
              ...order,
              machines: [...(order.machines || []), result.machine],
              status: result.orderStatus,
            };
          }
          return order;
        }));

        // Check if more machines need provisioning
        const existingCount = (selectedOrder.machines?.length || 0) + 1;
        if (existingCount < selectedOrder.quantity) {
          // Set up for next machine
          setProvisioningMachine(existingCount);
          setMachineDetails({
            name: `${selectedOrder.organization.name.substring(0, 8).toUpperCase()}-${selectedOrder.machineConfig.name.toUpperCase()}-${String(existingCount + 1).padStart(2, '0')}`,
            dcvLink: '',
            ipAddress: '',
            loginUsername: '',
            loginPassword: '',
          });
        } else {
          // All done
          setProvisionDialogOpen(false);
          fetchOrders();
        }
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to provision machine');
      }
    } catch (error) {
      toast.error('Failed to provision machine');
    } finally {
      setProvisioning(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { color: string; icon: any }> = {
      PENDING_PAYMENT: { color: 'bg-gray-600 text-white', icon: Clock },
      PAID: { color: 'bg-gray-700 text-white', icon: AlertCircle },
      PROCESSING: { color: 'bg-gray-800 text-white', icon: RefreshCw },
      COMPLETED: { color: 'bg-gray-900 text-white', icon: CheckCircle },
      CANCELLED: { color: 'bg-gray-500 text-white', icon: AlertCircle },
    };
    const config = configs[status] || { color: 'bg-secondary text-secondary-foreground', icon: Clock };
    const Icon = config.icon;
    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const pendingOrders = orders.filter(o => o.status === 'PAID' || o.status === 'PROCESSING');
  const completedOrders = orders.filter(o => o.status === 'COMPLETED');
  const allOrders = orders;

  // Apply search, sort, and filter using useMemo
  const filterOrders = useMemo(() => {
    return (orderList: MachineOrder[]) => {
      // Create searchable fields
      const ordersWithSearchFields = orderList.map(o => ({
        ...o,
        organizationName: o.organization.name,
        configName: o.machineConfig.name,
      }));
      
      // Build filters config
      type OrderWithFields = typeof ordersWithSearchFields[0];
      const filtersConfig: Record<string, { field: keyof OrderWithFields; value: string }> = {};
      if (filterValues.status) {
        filtersConfig.status = { field: 'status', value: filterValues.status };
      }
      
      return applySearchSortFilter(
        ordersWithSearchFields,
        searchQuery,
        ['orderNumber', 'organizationName', 'configName'],
        sortField as keyof OrderWithFields,
        sortDirection,
        filtersConfig
      );
    };
  }, [searchQuery, sortField, sortDirection, filterValues]);

  const handleSortChange = (field: string, direction: 'asc' | 'desc') => {
    setSortField(field);
    setSortDirection(direction);
  };

  const handleFilterChange = (filterKey: string, value: string) => {
    setFilterValues(prev => ({ ...prev, [filterKey]: value }));
  };

  if (!isPlatformAdmin) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto text-center py-12">
          <h1 className="text-2xl font-bold text-red-500">Access Denied</h1>
          <p className="text-muted-foreground mt-2">You need platform admin privileges to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <PageLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Machine Requests</h1>
          <p className="text-muted-foreground">Provision and manage machine orders</p>
        </div>
        <Button 
          variant="outline" 
          onClick={fetchOrders} 
          disabled={loading}
          className="border-border text-foreground hover:bg-accent"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Search, Sort, and Filter Bar */}
      <SearchSortBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search orders, organizations..."
        sortOptions={sortOptions}
        sortValue={sortField}
        sortDirection={sortDirection}
        onSortChange={handleSortChange}
        filters={filterOptions}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        className="mb-6"
      />

      {/* Stats Cards */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <AlertCircle className="w-4 h-4 text-yellow-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{pendingOrders.length}</p>
                <p className="text-xs text-muted-foreground">Pending Provision</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{completedOrders.length}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Server className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">
                  {orders.reduce((sum, o) => sum + (o.machines?.length || 0), 0)}
                </p>
                <p className="text-xs text-muted-foreground">Machines Provisioned</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Building2 className="w-4 h-4 text-purple-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">
                  {new Set(orders.map(o => o.organization.id)).size}
                </p>
                <p className="text-xs text-muted-foreground">Organizations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary border-border">
          <TabsTrigger value="pending">
            Pending ({pendingOrders.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedOrders.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            All Orders ({allOrders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <OrdersTable 
            orders={filterOrders(pendingOrders)} 
            loading={loading}
            onProvision={openProvisionDialog}
            getStatusBadge={getStatusBadge}
            showProvisionAction={true}
          />
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          <OrdersTable 
            orders={filterOrders(completedOrders)} 
            loading={loading}
            onProvision={openProvisionDialog}
            getStatusBadge={getStatusBadge}
            showProvisionAction={false}
          />
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <OrdersTable 
            orders={filterOrders(allOrders)} 
            loading={loading}
            onProvision={openProvisionDialog}
            getStatusBadge={getStatusBadge}
            showProvisionAction={true}
          />
        </TabsContent>
      </Tabs>

      {/* Provision Dialog */}
      <Dialog open={provisionDialogOpen} onOpenChange={setProvisionDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-secondary border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Provision Machine</DialogTitle>
            <DialogDescription>
              {selectedOrder && (
                <span>
                  Order: {selectedOrder.orderNumber} | 
                  Machine {(selectedOrder.machines?.length || 0) + 1} of {selectedOrder.quantity}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4 py-4">
              {/* Order Info */}
              <div className="p-4 bg-secondary rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Organization:</span>
                  <span className="text-foreground font-medium">{selectedOrder.organization.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Configuration:</span>
                  <span className="text-foreground">{selectedOrder.machineConfig.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Specs:</span>
                  <span className="text-foreground text-sm">
                    {selectedOrder.machineConfig.cpu} | {selectedOrder.machineConfig.ram} | {selectedOrder.machineConfig.storage}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="text-foreground">{selectedOrder.duration} month(s)</span>
                </div>
              </div>

              {/* Progress */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${((selectedOrder.machines?.length || 0) / selectedOrder.quantity) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-muted-foreground">
                  {selectedOrder.machines?.length || 0}/{selectedOrder.quantity}
                </span>
              </div>

              {/* Machine Details Form */}
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Machine Name</Label>
                  <Input
                    value={machineDetails.name}
                    onChange={(e) => setMachineDetails(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., STUDIO-VFX-01"
                    className="bg-secondary border-border"
                  />
                </div>

                <div>
                  <Label className="text-muted-foreground">DCV Link *</Label>
                  <Input
                    value={machineDetails.dcvLink}
                    onChange={(e) => setMachineDetails(prev => ({ ...prev, dcvLink: e.target.value }))}
                    placeholder="https://dcv.example.com/session/..."
                    className="bg-secondary border-border"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Full DCV connection URL for the user</p>
                </div>

                <div>
                  <Label className="text-muted-foreground">IP Address (optional)</Label>
                  <Input
                    value={machineDetails.ipAddress}
                    onChange={(e) => setMachineDetails(prev => ({ ...prev, ipAddress: e.target.value }))}
                    placeholder="192.168.1.100"
                    className="bg-secondary border-border"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Login Username (optional)</Label>
                    <Input
                      value={machineDetails.loginUsername}
                      onChange={(e) => setMachineDetails(prev => ({ ...prev, loginUsername: e.target.value }))}
                      placeholder="admin"
                      className="bg-secondary border-border"
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Login Password (optional)</Label>
                    <Input
                      value={machineDetails.loginPassword}
                      onChange={(e) => setMachineDetails(prev => ({ ...prev, loginPassword: e.target.value }))}
                      placeholder="••••••••"
                      className="bg-secondary border-border"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Backup credentials for the machine if user's own credentials don't work</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setProvisionDialogOpen(false)}
              disabled={provisioning}
            >
              Cancel
            </Button>
            <Button
              onClick={handleProvisionMachine}
              disabled={provisioning || !machineDetails.dcvLink}
            >
              {provisioning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Provisioning...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Provision Machine
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

// Orders Table Component
function OrdersTable({ 
  orders, 
  loading, 
  onProvision, 
  getStatusBadge,
  showProvisionAction,
}: { 
  orders: MachineOrder[]; 
  loading: boolean;
  onProvision: (order: MachineOrder) => void;
  getStatusBadge: (status: string) => React.ReactNode;
  showProvisionAction: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Server className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No orders found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="text-muted-foreground">Order</TableHead>
              <TableHead className="text-muted-foreground">Organization</TableHead>
              <TableHead className="text-muted-foreground">Configuration</TableHead>
              <TableHead className="text-muted-foreground">Quantity</TableHead>
              <TableHead className="text-muted-foreground">Duration</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground">Progress</TableHead>
              <TableHead className="text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const isExtensionOrder = order.orderNumber.startsWith('EXT-');
              const provisionedCount = isExtensionOrder ? order.quantity : (order.machines?.length || 0);
              const remaining = order.quantity - provisionedCount;
              
              return (
                <TableRow key={order.id} className="border-border">
                  <TableCell className="font-medium text-foreground">
                    {order.orderNumber}
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-foreground">{order.organization.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {order.machineConfig.name}
                    <p className="text-xs text-muted-foreground">
                      {order.machineConfig.cpu} | {order.machineConfig.ram}
                    </p>
                  </TableCell>
                  <TableCell className="text-foreground">{order.quantity}</TableCell>
                  <TableCell className="text-muted-foreground">{order.duration} mo</TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell>
                    {isExtensionOrder ? (
                      <Badge variant="outline" className="text-blue-500 border-blue-500">Extended</Badge>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gray-800"
                            style={{ width: `${(provisionedCount / order.quantity) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{provisionedCount}/{order.quantity}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {showProvisionAction && !isExtensionOrder && remaining > 0 && (order.status === 'PAID' || order.status === 'PROCESSING') && (
                      <Button
                        size="sm"
                        onClick={() => onProvision(order)}
                        className="bg-gray-800 hover:bg-gray-900"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Provision ({remaining})
                      </Button>
                    )}
                    {order.status === 'COMPLETED' && (
                      <Badge className="bg-gray-800 text-white">All Provisioned</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
