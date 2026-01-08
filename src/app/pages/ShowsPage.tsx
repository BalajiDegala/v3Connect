import { useState, useEffect, useMemo, Fragment } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PageLayout } from '../components/PageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { 
  Film,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Users,
  Server,
  UserPlus,
  RefreshCw,
  Calendar,
  CheckCircle,
  Clock,
  Pause,
  Archive,
  X,
  ChevronDown,
  ChevronRight,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

interface Show {
  id: string;
  name: string;
  code: string;
  description?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  organization?: {
    id: string;
    name: string;
  };
  assignments: ShowAssignment[];
  machineAssignments: MachineShowAssignment[];
  _count: {
    assignments: number;
    machineAssignments: number;
  };
}

interface ShowAssignment {
  id: string;
  role: string;
  department?: string;
  assignedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  };
}

interface MachineShowAssignment {
  id: string;
  assignedAt: string;
  machine: {
    id: string;
    name: string;
    status: string;
    expiryDate?: string;
    startDate?: string;
  };
}

interface UserMachine {
  id: string;
  name: string;
  status: string;
  expiryDate?: string;
  startDate?: string;
  task?: string | null;
  assignedAt: string;
  assignedShow?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Machine {
  id: string;
  name: string;
  status: string;
}

const API_BASE = 'http://localhost:5000/api';

const SHOW_ROLES = [
  { value: 'ARTIST', label: 'Artist' },
  { value: 'LEAD', label: 'Lead' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'COORDINATOR', label: 'Coordinator' },
  { value: 'PRODUCER', label: 'Producer' },
  { value: 'SHOW_ADMIN', label: 'Show Admin' },
];

const DEPARTMENTS = [
  'Animation',
  'Lighting',
  'Compositing',
  'Modeling',
  'Rigging',
  'Texturing',
  'FX',
  'Layout',
  'Editorial',
  'Production',
];

export function ShowsPage() {
  const { token, hasRole, user } = useAuth();
  const [shows, setShows] = useState<Show[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({
    status: 'all',
  });

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignUserDialogOpen, setAssignUserDialogOpen] = useState(false);
  const [viewShowDialogOpen, setViewShowDialogOpen] = useState(false);
  
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [newShow, setNewShow] = useState({
    name: '',
    code: '',
    description: '',
    startDate: '',
    endDate: '',
  });
  const [editShow, setEditShow] = useState({
    name: '',
    code: '',
    description: '',
    status: '',
    startDate: '',
    endDate: '',
  });
  const [assignUser, setAssignUser] = useState({
    userId: '',
    role: 'ARTIST',
    department: '',
  });
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [userMachines, setUserMachines] = useState<Record<string, UserMachine[]>>({});
  const [loadingMachines, setLoadingMachines] = useState<Set<string>>(new Set());
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [teamRoleFilter, setTeamRoleFilter] = useState('all');

  const isPlatformAdmin = hasRole('admin') && !hasRole('studio_owner');
  const canManageShows = hasRole('studio_owner') || hasRole('studio_admin') || isPlatformAdmin;
  const isArtist = !canManageShows; // Artist is someone who can't manage shows

  // Sort options
  const sortOptions: SortOption[] = [
    { label: 'Created Date', value: 'createdAt' },
    { label: 'Name', value: 'name' },
    { label: 'Code', value: 'code' },
    { label: 'Start Date', value: 'startDate' },
  ];

  // Filter options
  const filterOptions: FilterOption[] = [
    {
      label: 'Status',
      value: 'status',
      options: [
        { label: 'Active', value: 'ACTIVE' },
        { label: 'On Hold', value: 'ON_HOLD' },
        { label: 'Completed', value: 'COMPLETED' },
        { label: 'Archived', value: 'ARCHIVED' },
      ],
    },
  ];

  const fetchShows = async () => {
    try {
      setLoading(true);
      // Use regular shows endpoint - backend handles admin detection automatically
      const response = await fetch(`${API_BASE}/shows`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Shows response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Shows fetched:', data.length, 'shows', data);
        setShows(data);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch shows:', response.status, errorText);
        toast.error('Failed to fetch shows');
      }
    } catch (error) {
      console.error('Error fetching shows:', error);
      toast.error('Failed to fetch shows');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchMachines = async () => {
    try {
      const response = await fetch(`${API_BASE}/machines`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setMachines(data);
      }
    } catch (error) {
      console.error('Error fetching machines:', error);
    }
  };

  useEffect(() => {
    if (token) {
      fetchShows();
      fetchUsers();
      fetchMachines();
    }
  }, [token]);

  // Filter and sort shows
  const filteredShows = useMemo(() => {
    const filtersConfig: Record<string, { field: keyof Show; value: string }> = {};
    if (filterValues.status) {
      filtersConfig.status = { field: 'status', value: filterValues.status };
    }

    return applySearchSortFilter(
      shows,
      searchQuery,
      ['name', 'code', 'description'],
      sortField as keyof Show,
      sortDirection,
      filtersConfig
    );
  }, [shows, searchQuery, sortField, sortDirection, filterValues]);

  const handleSortChange = (field: string, direction: 'asc' | 'desc') => {
    setSortField(field);
    setSortDirection(direction);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilterValues(prev => ({ ...prev, [key]: value }));
  };

  const handleCreateShow = async () => {
    if (!newShow.name || !newShow.code) {
      toast.error('Name and code are required');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch(`${API_BASE}/shows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newShow),
      });

      if (response.ok) {
        toast.success('Show created successfully');
        setCreateDialogOpen(false);
        setNewShow({ name: '', code: '', description: '', startDate: '', endDate: '' });
        fetchShows();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create show');
      }
    } catch (error) {
      toast.error('Failed to create show');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateShow = async () => {
    if (!selectedShow) return;

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/shows/${selectedShow.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editShow),
      });

      if (response.ok) {
        toast.success('Show updated successfully');
        setEditDialogOpen(false);
        fetchShows();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update show');
      }
    } catch (error) {
      toast.error('Failed to update show');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShow = async (showId: string) => {
    if (!confirm('Are you sure you want to delete this show? This will remove all user and machine assignments.')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/shows/${showId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success('Show deleted successfully');
        fetchShows();
      } else {
        toast.error('Failed to delete show');
      }
    } catch (error) {
      toast.error('Failed to delete show');
    }
  };

  const handleAssignUser = async () => {
    if (!selectedShow || !assignUser.userId) {
      toast.error('Please select a user');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/shows/${selectedShow.id}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(assignUser),
      });

      if (response.ok) {
        toast.success('User assigned to show');
        setAssignUserDialogOpen(false);
        setAssignUser({ userId: '', role: 'ARTIST', department: '' });
        fetchShows();
        // Refresh selected show
        if (selectedShow) {
          const showResponse = await fetch(`${API_BASE}/shows/${selectedShow.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (showResponse.ok) {
            setSelectedShow(await showResponse.json());
          }
        }
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to assign user');
      }
    } catch (error) {
      toast.error('Failed to assign user');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveUser = async (showId: string, userId: string) => {
    if (!confirm('Remove this user from the show?')) return;

    try {
      const response = await fetch(`${API_BASE}/shows/${showId}/assign/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success('User removed from show');
        fetchShows();
        if (selectedShow && selectedShow.id === showId) {
          const showResponse = await fetch(`${API_BASE}/shows/${showId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (showResponse.ok) {
            setSelectedShow(await showResponse.json());
          }
        }
      } else {
        toast.error('Failed to remove user');
      }
    } catch (error) {
      toast.error('Failed to remove user');
    }
  };

  const toggleUserMachines = async (userId: string, showId: string) => {
    // If already expanded, just collapse
    if (expandedUsers.has(userId)) {
      const newExpanded = new Set(expandedUsers);
      newExpanded.delete(userId);
      setExpandedUsers(newExpanded);
      return;
    }

    // If not loaded yet, fetch machines
    if (!userMachines[userId]) {
      setLoadingMachines(prev => new Set(prev).add(userId));
      try {
        const response = await fetch(
          `${API_BASE}/shows/${showId}/machines?userId=${userId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.ok) {
          const machines = await response.json();
          setUserMachines(prev => ({ ...prev, [userId]: machines }));
        }
      } catch (error) {
        console.error('Error fetching user machines:', error);
        toast.error('Failed to fetch machines');
      } finally {
        setLoadingMachines(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
      }
    }

    // Expand the row
    const newExpanded = new Set(expandedUsers);
    newExpanded.add(userId);
    setExpandedUsers(newExpanded);
  };

  const openEditDialog = (show: Show) => {
    setSelectedShow(show);
    setEditShow({
      name: show.name,
      code: show.code,
      description: show.description || '',
      status: show.status,
      startDate: show.startDate ? show.startDate.split('T')[0] : '',
      endDate: show.endDate ? show.endDate.split('T')[0] : '',
    });
    setEditDialogOpen(true);
  };

  const openViewDialog = async (show: Show) => {
    try {
      const response = await fetch(`${API_BASE}/shows/${show.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const showData = await response.json();
        setSelectedShow(showData);
        // Reset search and filters
        setTeamSearchQuery('');
        setTeamRoleFilter('all');
        setExpandedUsers(new Set());
        setUserMachines({});
        setViewShowDialogOpen(true);
        
        // Auto-load machines for all team members
        if (showData.assignments && showData.assignments.length > 0) {
          showData.assignments.forEach(async (assignment: any) => {
            try {
              const machinesResponse = await fetch(
                `${API_BASE}/shows/${showData.id}/machines?userId=${assignment.user.id}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              if (machinesResponse.ok) {
                const machines = await machinesResponse.json();
                setUserMachines(prev => ({ ...prev, [assignment.user.id]: machines }));
              }
            } catch (error) {
              console.error('Error fetching user machines:', error);
            }
          });
        }
      }
    } catch (error) {
      toast.error('Failed to fetch show details');
    }
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { color: string; icon: any }> = {
      ACTIVE: { color: 'bg-green-600 text-white', icon: CheckCircle },
      ON_HOLD: { color: 'bg-yellow-600 text-white', icon: Pause },
      COMPLETED: { color: 'bg-blue-600 text-white', icon: CheckCircle },
      ARCHIVED: { color: 'bg-gray-600 text-white', icon: Archive },
    };
    const config = configs[status] || configs.ACTIVE;
    const Icon = config.icon;
    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      ARTIST: 'bg-gray-600 text-white',
      LEAD: 'bg-blue-600 text-white',
      SUPERVISOR: 'bg-purple-600 text-white',
      COORDINATOR: 'bg-cyan-600 text-white',
      PRODUCER: 'bg-amber-600 text-white',
      SHOW_ADMIN: 'bg-red-600 text-white',
    };
    return <Badge className={colors[role] || 'bg-gray-600 text-white'}>{role.replace('_', ' ')}</Badge>;
  };

  return (
    <PageLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
                <Film className="w-8 h-8 text-gray-500" />
                Shows
              </h1>
              <p className="text-muted-foreground">
                Manage shows/projects and assign team members with roles
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                onClick={fetchShows}
                disabled={loading}
                className="border-border text-foreground hover:bg-accent"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {canManageShows && (
                <Button onClick={() => setCreateDialogOpen(true)} className="bg-gray-700 hover:bg-gray-800">
                  <Plus className="w-4 h-4 mr-2" />
                  New Show
                </Button>
              )}
            </div>
          </div>

          {/* Search, Sort, Filter Bar */}
          <SearchSortBar
            searchPlaceholder="Search shows..."
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

          {/* Shows Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Film className="w-5 h-5 text-gray-500" />
                All Shows ({filteredShows.length})
              </CardTitle>
              <CardDescription>
                Click on a show to view details and manage assignments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-gray-500" />
                </div>
              ) : filteredShows.length === 0 ? (
                <div className="text-center py-12">
                  <Film className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No shows found</p>
                  {canManageShows && (
                    <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create your first show
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-foreground">Show</TableHead>
                      <TableHead className="text-foreground">Code</TableHead>
                      {isPlatformAdmin && <TableHead className="text-foreground">Studio</TableHead>}
                      <TableHead className="text-foreground">Status</TableHead>
                      <TableHead className="text-foreground">Team</TableHead>
                      {!isArtist && <TableHead className="text-foreground">Machines</TableHead>}
                      <TableHead className="text-foreground">Dates</TableHead>
                      <TableHead className="text-foreground w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredShows.map((show) => (
                      <TableRow 
                        key={show.id} 
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => openViewDialog(show)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">{show.name}</p>
                            {show.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {show.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{show.code}</Badge>
                        </TableCell>
                        {isPlatformAdmin && (
                          <TableCell>
                            <span className="text-sm text-foreground">{show.organization?.name || '-'}</span>
                          </TableCell>
                        )}
                        <TableCell>{getStatusBadge(show.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <span>{show._count.assignments}</span>
                          </div>
                        </TableCell>
                        {!isArtist && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Server className="w-4 h-4 text-muted-foreground" />
                            <span>{show._count.machineAssignments}</span>
                          </div>
                        </TableCell>
                        )}
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {show.startDate && (
                              <span>{new Date(show.startDate).toLocaleDateString()}</span>
                            )}
                            {show.startDate && show.endDate && ' - '}
                            {show.endDate && (
                              <span>{new Date(show.endDate).toLocaleDateString()}</span>
                            )}
                            {!show.startDate && !show.endDate && '-'}
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {canManageShows && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  setSelectedShow(show);
                                  setAssignUserDialogOpen(true);
                                }}>
                                  <UserPlus className="w-4 h-4 mr-2" />
                                  Assign User
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openEditDialog(show)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteShow(show.id)}
                                  className="text-red-400"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Create Show Dialog */}
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Show</DialogTitle>
                <DialogDescription>
                  Add a new show/project to your organization
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      placeholder="My Awesome Show"
                      value={newShow.name}
                      onChange={(e) => setNewShow({ ...newShow, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="code">Code *</Label>
                    <Input
                      id="code"
                      placeholder="SHOW01"
                      value={newShow.code}
                      onChange={(e) => setNewShow({ ...newShow, code: e.target.value.toUpperCase() })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of the show..."
                    value={newShow.description}
                    onChange={(e) => setNewShow({ ...newShow, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={newShow.startDate}
                      onChange={(e) => setNewShow({ ...newShow, startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={newShow.endDate}
                      onChange={(e) => setNewShow({ ...newShow, endDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateShow} disabled={creating}>
                  {creating ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Show
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Show Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit Show</DialogTitle>
                <DialogDescription>
                  Update show details
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-name">Name</Label>
                    <Input
                      id="edit-name"
                      value={editShow.name}
                      onChange={(e) => setEditShow({ ...editShow, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-code">Code</Label>
                    <Input
                      id="edit-code"
                      value={editShow.code}
                      onChange={(e) => setEditShow({ ...editShow, code: e.target.value.toUpperCase() })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={editShow.description}
                    onChange={(e) => setEditShow({ ...editShow, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-status">Status</Label>
                  <Select value={editShow.status} onValueChange={(v) => setEditShow({ ...editShow, status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="ON_HOLD">On Hold</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="ARCHIVED">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-startDate">Start Date</Label>
                    <Input
                      id="edit-startDate"
                      type="date"
                      value={editShow.startDate}
                      onChange={(e) => setEditShow({ ...editShow, startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-endDate">End Date</Label>
                    <Input
                      id="edit-endDate"
                      type="date"
                      value={editShow.endDate}
                      onChange={(e) => setEditShow({ ...editShow, endDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateShow} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Assign User Dialog */}
          <Dialog open={assignUserDialogOpen} onOpenChange={setAssignUserDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Assign User to Show</DialogTitle>
                <DialogDescription>
                  {selectedShow && `Add a team member to "${selectedShow.name}"`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>User *</Label>
                  <Select value={assignUser.userId} onValueChange={(v) => setAssignUser({ ...assignUser, userId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users
                        .filter(u => !selectedShow?.assignments.some(a => a.user.id === u.id))
                        .map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName} ({user.email})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Role *</Label>
                  <Select value={assignUser.role} onValueChange={(v) => setAssignUser({ ...assignUser, role: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SHOW_ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Department</Label>
                  <Select value={assignUser.department} onValueChange={(v) => setAssignUser({ ...assignUser, department: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAssignUserDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAssignUser} disabled={saving}>
                  {saving ? 'Assigning...' : 'Assign User'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* View Show Details Dialog */}
          <Dialog open={viewShowDialogOpen} onOpenChange={setViewShowDialogOpen}>
            <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Film className="w-5 h-5 text-gray-500" />
                  {selectedShow?.name}
                </DialogTitle>
                <DialogDescription>
                  {selectedShow?.description || 'Team members and their assigned machines'}
                </DialogDescription>
              </DialogHeader>

              {selectedShow && (
                <div className="space-y-6">
                  {/* Show Info */}
                  <div className="flex gap-4 items-center flex-wrap">
                    <Badge variant="outline" className="px-3 py-1">
                      {selectedShow.code}
                    </Badge>
                    {getStatusBadge(selectedShow.status)}
                    {selectedShow.startDate && (
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(selectedShow.startDate).toLocaleDateString()}
                        {selectedShow.endDate && ` - ${new Date(selectedShow.endDate).toLocaleDateString()}`}
                      </div>
                    )}
                  </div>

                  {/* Add Member Button */}
                  {canManageShows && (
                    <Button onClick={() => setAssignUserDialogOpen(true)} className="w-full">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add Team Member
                    </Button>
                  )}

                  {/* Team Members with Machine Counts */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">Team Members ({selectedShow.assignments?.length || 0})</h3>
                    </div>
                    
                    {/* Search and Filter */}
                    {selectedShow.assignments && selectedShow.assignments.length > 0 && (
                      <div className="flex gap-3 mb-4">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder="Search team members..."
                            value={teamSearchQuery}
                            onChange={(e) => setTeamSearchQuery(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                        <Select value={teamRoleFilter} onValueChange={setTeamRoleFilter}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Roles</SelectItem>
                            {SHOW_ROLES.map(role => (
                              <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {selectedShow.assignments?.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No team members assigned yet</p>
                    ) : (() => {
                      // Filter team members
                      const filteredAssignments = selectedShow.assignments?.filter(assignment => {
                        const matchesSearch = teamSearchQuery === '' || 
                          `${assignment.user.firstName} ${assignment.user.lastName}`.toLowerCase().includes(teamSearchQuery.toLowerCase()) ||
                          assignment.user.email.toLowerCase().includes(teamSearchQuery.toLowerCase()) ||
                          assignment.department?.toLowerCase().includes(teamSearchQuery.toLowerCase());
                        
                        const matchesRole = teamRoleFilter === 'all' || assignment.role === teamRoleFilter;
                        
                        return matchesSearch && matchesRole;
                      }) || [];

                      if (filteredAssignments.length === 0) {
                        return (
                          <p className="text-muted-foreground text-center py-8">No team members found matching your filters</p>
                        );
                      }

                      return (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {!isArtist && <TableHead className="w-[50px]"></TableHead>}
                            <TableHead>Name</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Department</TableHead>
                            {!isArtist && <TableHead>Machines</TableHead>}
                            {canManageShows && <TableHead className="w-[80px]">Actions</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAssignments.map((assignment) => {
                            const isExpanded = expandedUsers.has(assignment.user.id);
                            const machines = userMachines[assignment.user.id] || [];
                            const isLoadingMachines = loadingMachines.has(assignment.user.id);
                            const isCurrentUser = user?.id === assignment.user.id || user?.email === assignment.user.email;
                            const canViewMachineDetails = !isArtist || isCurrentUser;
                            
                            return (
                              <Fragment key={assignment.id}>
                                <TableRow key={assignment.id}>
                                  {!isArtist && (
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => toggleUserMachines(assignment.user.id, selectedShow.id)}
                                      className="p-0 h-8 w-8"
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="w-4 h-4" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4" />
                                      )}
                                    </Button>
                                  </TableCell>
                                  )}
                                  <TableCell className="font-medium">
                                    {assignment.user.firstName} {assignment.user.lastName}
                                  </TableCell>
                                  <TableCell>{getRoleBadge(assignment.role)}</TableCell>
                                  <TableCell>{assignment.department || '-'}</TableCell>
                                  {!isArtist && (
                                  <TableCell>
                                    {isLoadingMachines ? (
                                      <span className="text-muted-foreground text-sm">Loading...</span>
                                    ) : machines.length > 0 ? (
                                      <span className="text-foreground text-sm font-medium">
                                        {machines.length} {machines.length === 1 ? 'Machine' : 'Machines'}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground text-sm">
                                        No machines assigned
                                      </span>
                                    )}
                                  </TableCell>
                                  )}
                                  {canManageShows && (
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveUser(selectedShow.id, assignment.user.id)}
                                        className="text-red-400 hover:text-red-500 hover:bg-red-500/10"
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </TableCell>
                                  )}
                                </TableRow>
                                
                                {/* Expanded Machine Details - Only visible to admins */}
                                {!isArtist && isExpanded && machines.length > 0 && (
                                  <TableRow>
                                    <TableCell colSpan={canManageShows ? 6 : 5} className="bg-muted/50 p-4">
                                      <div className="space-y-2">
                                        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                          <Server className="w-4 h-4" />
                                          Assigned Machines
                                        </h4>
                                        <div className="grid gap-2">
                                          {machines.map((machine) => (
                                            <div 
                                              key={machine.id} 
                                              className="flex flex-col gap-2 p-3 bg-background border border-border rounded-lg"
                                            >
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3 flex-1">
                                                  <Server className="w-4 h-4 text-muted-foreground" />
                                                  <span className="font-medium text-foreground">{machine.name}</span>
                                                  <Badge 
                                                    variant={
                                                      machine.status === 'RUNNING' ? 'default' : 
                                                      machine.status === 'ACTIVE' ? 'outline' : 
                                                      'secondary'
                                                    }
                                                    className={
                                                      machine.status === 'RUNNING' ? 'bg-green-600' :
                                                      machine.status === 'EXPIRED' ? 'bg-red-600' :
                                                      ''
                                                    }
                                                  >
                                                    {machine.status}
                                                  </Badge>
                                                  {machine.task && (
                                                    <span className="text-xs text-muted-foreground">
                                                      Task: {machine.task}
                                                    </span>
                                                  )}
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                  {machine.startDate && (
                                                    <div className="flex items-center gap-1">
                                                      <Calendar className="w-3 h-3" />
                                                      <span>Started: {new Date(machine.startDate).toLocaleDateString()}</span>
                                                    </div>
                                                  )}
                                                  {machine.expiryDate && (
                                                    <div className="flex items-center gap-1">
                                                      <Clock className="w-3 h-3" />
                                                      <span className={
                                                        new Date(machine.expiryDate) < new Date() ? 'text-red-500 font-medium' : ''
                                                      }>
                                                        Expires: {new Date(machine.expiryDate).toLocaleDateString()}
                                                      </span>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                              {machine.assignedShow && (
                                                <div className="flex items-center gap-2 text-xs">
                                                  <Film className="w-3 h-3 text-blue-500" />
                                                  <span className="text-muted-foreground">
                                                    Assigned to Show:
                                                  </span>
                                                  <Badge variant="outline" className="text-blue-500 border-blue-500">
                                                    {machine.assignedShow.code} - {machine.assignedShow.name}
                                                  </Badge>
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                      );
                    })()}
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setViewShowDialogOpen(false)}>
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
