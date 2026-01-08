import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PageLayout } from '../components/PageLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
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
  DialogTrigger,
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
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Badge } from '../components/ui/badge';
import { 
  Users, 
  UserPlus, 
  Mail, 
  MoreVertical, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Send,
  RefreshCw,
  Film
} from 'lucide-react';
import { toast } from 'sonner';

interface ShowAssignment {
  id: string;
  role: string;
  department?: string;
  show: {
    id: string;
    name: string;
    code: string;
    status: string;
  };
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  createdAt: string;
  lastLogin?: string;
  showAssignments?: ShowAssignment[];
}

interface Invitation {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

const API_BASE = 'http://localhost:5000/api';

export function UsersPage() {
  const { user, token, hasRole } = useAuth();
  
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({
    status: 'all',
    role: 'all',
  });
  
  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteRole, setInviteRole] = useState('STUDIO_USER');

  // Role detection
  const isPlatformAdmin = hasRole('admin') && !hasRole('studio_owner');
  const isStudioAdmin = hasRole('studio_owner') || hasRole('studio_admin');
  
  console.log('Role check - admin:', hasRole('admin'), 'studio_owner:', hasRole('studio_owner'), 'isPlatformAdmin:', isPlatformAdmin, 'isStudioAdmin:', isStudioAdmin);
  const canManageUsers = isPlatformAdmin || isStudioAdmin;

  // Sort options
  const sortOptions: SortOption[] = [
    { label: 'Joined Date', value: 'createdAt' },
    { label: 'Name', value: 'name' },
    { label: 'Email', value: 'email' },
    { label: 'Role', value: 'role' },
    { label: 'Last Login', value: 'lastLogin' },
  ];

  // Filter options
  const filterOptions: FilterOption[] = [
    {
      label: 'Status',
      value: 'status',
      options: [
        { label: 'Active', value: 'ACTIVE' },
        { label: 'Pending', value: 'PENDING' },
        { label: 'Inactive', value: 'INACTIVE' },
      ],
    },
    {
      label: 'Role',
      value: 'role',
      options: [
        { label: 'Studio Owner', value: 'STUDIO_OWNER' },
        { label: 'Studio Admin', value: 'STUDIO_ADMIN' },
        { label: 'Studio User', value: 'STUDIO_USER' },
      ],
    },
  ];

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch users - Platform Admin gets all, Studio Admin gets their org only
      const usersEndpoint = isPlatformAdmin ? `${API_BASE}/admin/users` : `${API_BASE}/users`;
      const usersRes = await fetch(usersEndpoint, { headers });
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }

      // Fetch invitations (only for studio admins with an org)
      if (isStudioAdmin && !isPlatformAdmin) {
        const invitationsRes = await fetch(`${API_BASE}/invitations`, { headers });
        if (invitationsRes.ok) {
          const invitationsData = await invitationsRes.json();
          setInvitations(invitationsData);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load users and invitations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const handleInvite = async () => {
    if (!inviteEmail) {
      toast.error('Email is required');
      return;
    }

    setInviting(true);
    try {
      const res = await fetch(`${API_BASE}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: inviteEmail,
          firstName: inviteFirstName,
          lastName: inviteLastName,
          role: inviteRole,
        }),
      });

      if (res.ok) {
        toast.success(`Invitation sent to ${inviteEmail}`);
        setInviteDialogOpen(false);
        setInviteEmail('');
        setInviteFirstName('');
        setInviteLastName('');
        setInviteRole('STUDIO_USER');
        fetchData();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to send invitation');
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast.error('Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    try {
      const res = await fetch(`${API_BASE}/invitations/${invitationId}/resend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        toast.success('Invitation resent successfully');
      } else {
        toast.error('Failed to resend invitation');
      }
    } catch (error) {
      toast.error('Failed to resend invitation');
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation? The recipient will no longer be able to accept it.')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/invitations/${invitationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        toast.success('Invitation cancelled successfully');
        fetchData();
      } else {
        toast.error('Failed to cancel invitation');
      }
    } catch (error) {
      toast.error('Failed to cancel invitation');
    }
  };

  const handleDeleteCancelledInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to permanently delete this cancelled invitation?')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/invitations/${invitationId}/permanent`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        toast.success('Invitation deleted permanently');
        fetchData();
      } else {
        toast.error('Failed to delete invitation');
      }
    } catch (error) {
      toast.error('Failed to delete invitation');
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user from the organization?')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        toast.success('User removed from organization');
        fetchData();
      } else {
        toast.error('Failed to remove user');
      }
    } catch (error) {
      toast.error('Failed to remove user');
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    if (!confirm('Are you sure you want to deactivate this user? They will no longer be able to access the platform.')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        toast.success('User deactivated successfully');
        fetchData();
      } else {
        toast.error('Failed to deactivate user');
      }
    } catch (error) {
      toast.error('Failed to deactivate user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('⚠️ WARNING: This will PERMANENTLY delete this user and all their data. This action cannot be undone.\n\nAre you sure you want to continue?')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}?permanent=true`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        toast.success('User permanently deleted');
        fetchData();
      } else {
        toast.error('Failed to delete user');
      }
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  const getRoleBadgeClass = (role: string): string => {
    switch (role) {
      case 'STUDIO_OWNER':
      case 'studio_owner':
        return 'bg-gray-700 text-white';
      case 'STUDIO_ADMIN':
      case 'studio_admin':
        return 'bg-gray-600 text-white';
      case 'super_admin':
      case 'SUPER_ADMIN':
        return 'bg-gray-800 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-600 text-white"><CheckCircle2 className="w-3 h-3 mr-1" /> Active</Badge>;
      case 'PENDING':
        return <Badge className="bg-yellow-600 text-white"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'INACTIVE':
        return <Badge className="bg-red-600 text-white"><XCircle className="w-3 h-3 mr-1" /> Inactive</Badge>;
      default:
        return <Badge className="bg-gray-200 text-gray-700">{status}</Badge>;
    }
  };

  const formatRole = (role: string) => {
    return role.replace(/_/g, ' ').replace(/STUDIO /i, '').toLowerCase().replace(/^\w/, c => c.toUpperCase());
  };

  // Filter and sort users
  const filteredUsers = useMemo(() => {
    // Create searchable name field for each user
    const usersWithName = users.map(u => ({
      ...u,
      name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
    }));

    // Build filters config
    const filtersConfig: Record<string, { field: keyof typeof usersWithName[0]; value: string }> = {};
    if (filterValues.status) {
      filtersConfig.status = { field: 'status', value: filterValues.status };
    }
    if (filterValues.role) {
      filtersConfig.role = { field: 'role', value: filterValues.role };
    }

    return applySearchSortFilter(
      usersWithName,
      searchQuery,
      ['email', 'firstName', 'lastName', 'name'],
      sortField as keyof typeof usersWithName[0],
      sortDirection,
      filtersConfig
    );
  }, [users, searchQuery, sortField, sortDirection, filterValues]);

  const handleSortChange = (field: string, direction: 'asc' | 'desc') => {
    setSortField(field);
    setSortDirection(direction);
  };

  const handleFilterChange = (filterKey: string, value: string) => {
    setFilterValues(prev => ({ ...prev, [filterKey]: value }));
  };

  const pendingInvitations = invitations.filter(i => i.status === 'PENDING');
  const revokedInvitations = invitations.filter(i => i.status === 'REVOKED');
  const acceptedInvitations = invitations.filter(i => i.status === 'ACCEPTED');

  // Check if user needs to set up organization first
  const needsOrganization = isStudioAdmin && !user?.organizationId;

  if (needsOrganization) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <Card className="max-w-lg mx-auto mt-20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-6 h-6 text-gray-500" />
                Organization Required
              </CardTitle>
              <CardDescription>
                You need to create an organization before you can invite team members.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => window.location.href = '/settings'} className="w-full">
                Go to Settings to Create Organization
              </Button>
            </CardContent>
          </Card>
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
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Users className="w-8 h-8 text-gray-500" />
              {isPlatformAdmin ? 'All Users' : 'Team Members'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isPlatformAdmin 
                ? 'View and manage all users across all organizations'
                : "Manage your organization's team members and invitations"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={fetchData}
              disabled={loading}
              className="border-border text-foreground hover:bg-accent"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {isStudioAdmin && !isPlatformAdmin && (
              <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gray-700 hover:bg-gray-800">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Invite Member
                  </Button>
                </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation email to add a new member to your organization.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        placeholder="John"
                        value={inviteFirstName}
                        onChange={(e) => setInviteFirstName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        placeholder="Doe"
                        value={inviteLastName}
                        onChange={(e) => setInviteLastName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STUDIO_USER">User</SelectItem>
                        <SelectItem value="STUDIO_MANAGER">Manager</SelectItem>
                        <SelectItem value="STUDIO_ADMIN">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleInvite} disabled={inviting}>
                    {inviting ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Invitation
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          </div>
        </div>

        {/* Search, Sort, and Filter Bar */}
        <SearchSortBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search users by name or email..."
          sortOptions={sortOptions}
          sortValue={sortField}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          filters={filterOptions}
          filterValues={filterValues}
          onFilterChange={handleFilterChange}
        />

        {/* Pending Invitations - Only for Studio Admins */}
        {isStudioAdmin && !isPlatformAdmin && pendingInvitations.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="w-5 h-5 text-yellow-500" />
                Pending Invitations ({pendingInvitations.length})
              </CardTitle>
              <CardDescription>
                These invitations are waiting to be accepted
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-muted-foreground">Email</TableHead>
                    <TableHead className="text-muted-foreground">Name</TableHead>
                    <TableHead className="text-muted-foreground">Role</TableHead>
                    <TableHead className="text-muted-foreground">Expires</TableHead>
                    <TableHead className="w-[100px] text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInvitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-medium text-foreground">{invitation.email}</TableCell>
                      <TableCell className="text-foreground">
                        {invitation.firstName || invitation.lastName 
                          ? `${invitation.firstName || ''} ${invitation.lastName || ''}`.trim()
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={getRoleBadgeClass(invitation.role)}>
                          {formatRole(invitation.role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(invitation.expiresAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-accent"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover border-border">
                            <DropdownMenuItem 
                              onClick={() => handleResendInvitation(invitation.id)}
                              className="text-foreground hover:bg-accent cursor-pointer focus:bg-accent focus:text-accent-foreground"
                            >
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Resend Invitation
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleRevokeInvitation(invitation.id)}
                              className="text-red-400 hover:bg-red-900/20 cursor-pointer focus:bg-red-900/20 focus:text-red-400"
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Cancel Invitation
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Cancelled Invitations */}
        {revokedInvitations.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400" />
                Cancelled Invitations ({revokedInvitations.length})
              </CardTitle>
              <CardDescription>
                These invitations have been cancelled and can no longer be accepted
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-muted-foreground">Email</TableHead>
                    <TableHead className="text-muted-foreground">Name</TableHead>
                    <TableHead className="text-muted-foreground">Role</TableHead>
                    <TableHead className="text-muted-foreground">Cancelled On</TableHead>
                    <TableHead className="text-muted-foreground w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revokedInvitations.map((invitation) => (
                    <TableRow key={invitation.id} className="opacity-60">
                      <TableCell className="font-medium text-foreground">{invitation.email}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {invitation.firstName || invitation.lastName 
                          ? `${invitation.firstName || ''} ${invitation.lastName || ''}`.trim()
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-gray-400 text-white opacity-70">
                          {formatRole(invitation.role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(invitation.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCancelledInvitation(invitation.id)}
                          className="text-red-400 hover:text-red-500 hover:bg-red-500/10"
                          title="Delete permanently"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Team Members */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-500" />
              {isPlatformAdmin ? `All Users (${filteredUsers.length})` : `Team Members (${users.length})`}
            </CardTitle>
            <CardDescription>
              {isPlatformAdmin ? 'All registered users across all organizations' : 'Active members of your organization'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-gray-500" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No team members yet</p>
                {isStudioAdmin && !isPlatformAdmin && (
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setInviteDialogOpen(true)}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Invite your first team member
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-muted-foreground">Name</TableHead>
                    <TableHead className="text-muted-foreground">Email</TableHead>
                    {isPlatformAdmin && <TableHead className="text-muted-foreground">Organization</TableHead>}
                    <TableHead className="text-muted-foreground">Role</TableHead>
                    <TableHead className="text-muted-foreground">Shows</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Joined</TableHead>
                    <TableHead className="w-[100px] text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((member: any) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium text-foreground">
                        {member.firstName || member.lastName 
                          ? `${member.firstName || ''} ${member.lastName || ''}`.trim()
                          : member.name || '-'}
                      </TableCell>
                      <TableCell className="text-foreground">{member.email}</TableCell>
                      {isPlatformAdmin && (
                        <TableCell>
                          <Badge className="bg-gray-500 text-white">{member.organization?.name || 'No org'}</Badge>
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge className={getRoleBadgeClass(member.role)}>
                          {formatRole(member.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {member.showAssignments && member.showAssignments.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {member.showAssignments.slice(0, 2).map((sa: ShowAssignment) => (
                              <Badge 
                                key={sa.id} 
                                variant="outline" 
                                className="text-xs"
                                title={`${sa.show.name} - ${sa.role}`}
                              >
                                <Film className="w-3 h-3 mr-1" />
                                {sa.show.code}
                              </Badge>
                            ))}
                            {member.showAssignments.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{member.showAssignments.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(member.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(member.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {member.email !== user?.email && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-accent"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover border-border">
                              {isPlatformAdmin ? (
                                <>
                                  <DropdownMenuItem 
                                    onClick={() => handleDeactivateUser(member.id)}
                                    className="text-yellow-400 hover:bg-yellow-900/20 cursor-pointer focus:bg-yellow-900/20 focus:text-yellow-400"
                                  >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Deactivate User
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleDeleteUser(member.id)}
                                    className="text-red-400 hover:bg-red-900/20 cursor-pointer focus:bg-red-900/20 focus:text-red-400"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Permanently
                                  </DropdownMenuItem>
                                </>
                              ) : isStudioAdmin ? (
                                <DropdownMenuItem 
                                  onClick={() => handleRemoveUser(member.id)}
                                  className="text-red-400 hover:bg-red-900/20 cursor-pointer focus:bg-red-900/20 focus:text-red-400"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Remove from Organization
                                </DropdownMenuItem>
                              ) : null}
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
        </div>
      </div>
    </PageLayout>
  );
}
