import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PageLayout } from '../components/PageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { 
  Building2, 
  Users, 
  Server, 
  MoreVertical,
  Eye,
  Ban,
  CheckCircle,
  RefreshCw,
  Mail,
  Phone
} from 'lucide-react';
import { toast } from 'sonner';

interface Organization {
  id: string;
  name: string;
  contactEmail: string;
  contactPhone?: string;
  status: string;
  subscription: string;
  createdAt: string;
  _count?: {
    users: number;
    machines: number;
  };
  users?: any[];
}

const API_BASE = 'http://localhost:5000/api';

export function OrganizationsPage() {
  const { token } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({
    status: 'all',
    subscription: 'all',
  });
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Sort options
  const sortOptions: SortOption[] = [
    { label: 'Created Date', value: 'createdAt' },
    { label: 'Name', value: 'name' },
    { label: 'Users Count', value: 'users' },
    { label: 'Machines Count', value: 'machines' },
  ];

  // Filter options
  const filterOptions: FilterOption[] = [
    {
      label: 'Status',
      value: 'status',
      options: [
        { label: 'Active', value: 'ACTIVE' },
        { label: 'Suspended', value: 'SUSPENDED' },
        { label: 'Inactive', value: 'INACTIVE' },
      ],
    },
    {
      label: 'Subscription',
      value: 'subscription',
      options: [
        { label: 'Free', value: 'FREE' },
        { label: 'Starter', value: 'STARTER' },
        { label: 'Professional', value: 'PROFESSIONAL' },
        { label: 'Enterprise', value: 'ENTERPRISE' },
      ],
    },
  ];

  const fetchOrganizations = async () => {
    if (!token) return;
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/admin/organizations`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setOrganizations(data);
      } else {
        toast.error('Failed to fetch organizations');
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
      toast.error('Failed to fetch organizations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, [token]);

  // Apply search, sort, and filter
  const filteredOrgs = useMemo(() => {
    const sortFieldMap: Record<string, keyof Organization | ((item: Organization) => any)> = {
      createdAt: (item) => new Date(item.createdAt),
      name: 'name',
      users: (item) => item._count?.users || 0,
      machines: (item) => item._count?.machines || 0,
    };

    return applySearchSortFilter(
      organizations,
      searchQuery,
      ['name', 'contactEmail', 'contactPhone'],
      sortFieldMap[sortField],
      sortDirection,
      {
        status: { field: 'status', value: filterValues.status },
        subscription: { field: 'subscription', value: filterValues.subscription },
      }
    );
  }, [organizations, searchQuery, sortField, sortDirection, filterValues]);

  const handleSortChange = (field: string, direction: 'asc' | 'desc') => {
    setSortField(field);
    setSortDirection(direction);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilterValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSuspendOrg = async (orgId: string) => {
    if (!confirm('Are you sure you want to suspend this organization?')) return;

    try {
      const res = await fetch(`${API_BASE}/admin/organizations/${orgId}/suspend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        toast.success('Organization suspended');
        fetchOrganizations();
      } else {
        toast.error('Failed to suspend organization');
      }
    } catch (error) {
      toast.error('Failed to suspend organization');
    }
  };

  const handleActivateOrg = async (orgId: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/organizations/${orgId}/activate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        toast.success('Organization activated');
        fetchOrganizations();
      } else {
        toast.error('Failed to activate organization');
      }
    } catch (error) {
      toast.error('Failed to activate organization');
    }
  };

  const viewDetails = async (org: Organization) => {
    try {
      const res = await fetch(`${API_BASE}/admin/organizations/${org.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setSelectedOrg(data);
        setDetailsOpen(true);
      }
    } catch (error) {
      toast.error('Failed to fetch organization details');
    }
  };

  const filteredOrgsOld = organizations.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.contactEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-600 text-white"><CheckCircle className="w-3 h-3 mr-1" /> Active</Badge>;
      case 'SUSPENDED':
        return <Badge className="bg-red-600 text-white"><Ban className="w-3 h-3 mr-1" /> Suspended</Badge>;
      case 'INACTIVE':
        return <Badge className="bg-secondary text-secondary-foreground">Inactive</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSubscriptionBadge = (subscription: string) => {
    const colors: Record<string, string> = {
      FREE: 'bg-gray-500 text-white',
      STARTER: 'bg-gray-600 text-white',
      PROFESSIONAL: 'bg-purple-600 text-white',
      ENTERPRISE: 'bg-amber-600 text-white',
    };
    return <Badge className={colors[subscription] || 'bg-gray-500 text-white'}>{subscription}</Badge>;
  };

  return (
    <PageLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Organizations</h1>
            <p className="text-muted-foreground">Manage all registered organizations</p>
          </div>
          <Button 
            variant="outline" 
            onClick={fetchOrganizations}
            disabled={loading}
            className="border-border text-foreground hover:bg-accent"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Search, Sort, Filter Bar */}
        <SearchSortBar
          searchPlaceholder="Search organizations..."
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          sortOptions={sortOptions}
          sortValue={sortField}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          filters={filterOptions}
          filterValues={filterValues}
          onFilterChange={handleFilterChange}
          className="mb-6"
        />

        {/* Organizations Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5 text-gray-500" />
              All Organizations ({filteredOrgs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-gray-500" />
              </div>
            ) : filteredOrgs.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No organizations found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-foreground">Name</TableHead>
                    <TableHead className="text-foreground">Contact</TableHead>
                    <TableHead className="text-foreground">Users</TableHead>
                    <TableHead className="text-foreground">Machines</TableHead>
                    <TableHead className="text-foreground">Subscription</TableHead>
                    <TableHead className="text-foreground">Status</TableHead>
                    <TableHead className="text-foreground">Created</TableHead>
                    <TableHead className="text-foreground w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrgs.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium text-foreground">{org.name}</TableCell>
                      <TableCell className="text-foreground">{org.contactEmail}</TableCell>
                      <TableCell className="text-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {org._count?.users || 0}
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground">
                        <div className="flex items-center gap-1">
                          <Server className="w-4 h-4" />
                          {org._count?.machines || 0}
                        </div>
                      </TableCell>
                      <TableCell>{getSubscriptionBadge(org.subscription)}</TableCell>
                      <TableCell>{getStatusBadge(org.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-accent">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onSelect={() => viewDetails(org)}
                              className="cursor-pointer"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {org.status === 'ACTIVE' ? (
                              <DropdownMenuItem 
                                onSelect={() => handleSuspendOrg(org.id)}
                                className="text-red-400 hover:bg-red-900/20 cursor-pointer"
                              >
                                <Ban className="w-4 h-4 mr-2" />
                                Suspend
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem 
                                onSelect={() => handleActivateOrg(org.id)}
                                className="text-green-400 hover:bg-green-900/20 cursor-pointer"
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Activate
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Organization Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-gray-500" />
                {selectedOrg?.name}
              </DialogTitle>
              <DialogDescription>
                Organization details and members
              </DialogDescription>
            </DialogHeader>

            {selectedOrg && (
              <div className="space-y-6">
                {/* Contact Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-foreground">
                    <Mail className="w-4 h-4 text-gray-500" />
                    {selectedOrg.contactEmail}
                  </div>
                  {selectedOrg.contactPhone && (
                    <div className="flex items-center gap-2 text-foreground">
                      <Phone className="w-4 h-4 text-green-400" />
                      {selectedOrg.contactPhone}
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-secondary p-4 rounded-lg text-center">
                    <Users className="w-6 h-6 text-gray-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-foreground">{selectedOrg._count?.users || 0}</p>
                    <p className="text-sm text-muted-foreground">Users</p>
                  </div>
                  <div className="bg-secondary p-4 rounded-lg text-center">
                    <Server className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-foreground">{selectedOrg._count?.machines || 0}</p>
                    <p className="text-sm text-muted-foreground">Machines</p>
                  </div>
                  <div className="bg-secondary p-4 rounded-lg text-center">
                    <div className="mx-auto mb-2">{getSubscriptionBadge(selectedOrg.subscription)}</div>
                    <p className="text-sm text-muted-foreground">Subscription</p>
                  </div>
                </div>

                {/* Members */}
                {selectedOrg.users && selectedOrg.users.length > 0 && (
                  <div>
                    <h4 className="text-foreground font-medium mb-3">Members</h4>
                    <div className="space-y-2">
                      {selectedOrg.users.map((user: any) => (
                        <div key={user.id} className="flex items-center justify-between bg-secondary p-3 rounded-lg">
                          <div>
                            <p className="text-foreground">{user.firstName} {user.lastName}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                          <Badge variant="outline">
                            {user.role}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </PageLayout>
  );
}
