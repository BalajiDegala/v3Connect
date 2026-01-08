import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PageLayout } from '../components/PageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
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
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { 
  Ticket,
  Plus,
  MoreVertical,
  Eye,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Building2,
  User,
  Send
} from 'lucide-react';
import { toast } from 'sonner';

interface TicketData {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  organization?: {
    id: string;
    name: string;
  };
  responses?: TicketResponse[];
}

interface TicketResponse {
  id: string;
  message: string;
  isAdminResponse: boolean;
  createdAt: string;
  user?: {
    firstName: string;
    lastName: string;
  };
}

const API_BASE = 'http://localhost:5000/api';

export function TicketsPage() {
  const { token, user, hasRole } = useAuth();
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({
    status: 'all',
    priority: 'all',
  });
  
  // Create ticket dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    priority: 'MEDIUM',
    category: 'GENERAL',
  });

  // View ticket dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replying, setReplying] = useState(false);
  
  // Multi-select state
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const isPlatformAdmin = hasRole('admin') && !hasRole('studio_owner');
  const isOrgAdmin = hasRole('studio_owner') || hasRole('studio_admin');

  // Sort options
  const sortOptions: SortOption[] = [
    { label: 'Created Date', value: 'createdAt' },
    { label: 'Updated Date', value: 'updatedAt' },
    { label: 'Priority', value: 'priority' },
    { label: 'Status', value: 'status' },
    { label: 'Ticket #', value: 'ticketNumber' },
  ];

  // Filter options
  const filterOptions: FilterOption[] = [
    {
      label: 'Status',
      value: 'status',
      options: [
        { label: 'Open', value: 'OPEN' },
        { label: 'In Progress', value: 'IN_PROGRESS' },
        { label: 'Resolved', value: 'RESOLVED' },
        { label: 'Closed', value: 'CLOSED' },
      ],
    },
    {
      label: 'Priority',
      value: 'priority',
      options: [
        { label: 'Low', value: 'LOW' },
        { label: 'Medium', value: 'MEDIUM' },
        { label: 'High', value: 'HIGH' },
        { label: 'Urgent', value: 'URGENT' },
      ],
    },
  ];

  const fetchTickets = async () => {
    if (!token) return;
    setLoading(true);

    try {
      // Different endpoint based on role
      const endpoint = isPlatformAdmin 
        ? `${API_BASE}/admin/tickets` 
        : `${API_BASE}/tickets`;

      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      } else {
        toast.error('Failed to fetch tickets');
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error('Failed to fetch tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [token]);

  const handleCreateTicket = async () => {
    if (!newTicket.subject || !newTicket.description) {
      toast.error('Please fill in all fields');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newTicket),
      });

      if (res.ok) {
        toast.success('Ticket created successfully');
        setCreateDialogOpen(false);
        setNewTicket({ subject: '', description: '', priority: 'MEDIUM', category: 'GENERAL' });
        fetchTickets();
      } else {
        toast.error('Failed to create ticket');
      }
    } catch (error) {
      toast.error('Failed to create ticket');
    } finally {
      setCreating(false);
    }
  };

  const viewTicket = async (ticket: TicketData) => {
    try {
      const endpoint = isPlatformAdmin 
        ? `${API_BASE}/admin/tickets/${ticket.id}` 
        : `${API_BASE}/tickets/${ticket.id}`;

      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setSelectedTicket(data);
        setViewDialogOpen(true);
      }
    } catch (error) {
      toast.error('Failed to fetch ticket details');
    }
  };

  const handleReply = async () => {
    if (!replyMessage.trim() || !selectedTicket) return;

    setReplying(true);
    try {
      const endpoint = isPlatformAdmin 
        ? `${API_BASE}/admin/tickets/${selectedTicket.id}/respond` 
        : `${API_BASE}/tickets/${selectedTicket.id}/respond`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: replyMessage }),
      });

      if (res.ok) {
        toast.success('Reply sent');
        setReplyMessage('');
        viewTicket(selectedTicket); // Refresh ticket
        fetchTickets();
      } else {
        toast.error('Failed to send reply');
      }
    } catch (error) {
      toast.error('Failed to send reply');
    } finally {
      setReplying(false);
    }
  };

  const updateTicketStatus = async (ticketId: string, status: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/tickets/${ticketId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        toast.success('Ticket status updated');
        fetchTickets();
        if (selectedTicket && selectedTicket.id === ticketId) {
          setSelectedTicket({ ...selectedTicket, status });
        }
      } else {
        toast.error('Failed to update status');
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || selectedTicketIds.length === 0) {
      toast.error('Please select a status');
      return;
    }

    setBulkUpdating(true);
    try {
      const res = await fetch(`${API_BASE}/admin/tickets/bulk/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ticketIds: selectedTicketIds, status: bulkStatus }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || 'Tickets updated successfully');
        setSelectedTicketIds([]);
        setBulkStatusDialogOpen(false);
        setBulkStatus('');
        fetchTickets();
      } else {
        toast.error('Failed to update tickets');
      }
    } catch (error) {
      toast.error('Failed to update tickets');
    } finally {
      setBulkUpdating(false);
    }
  };

  const toggleTicketSelection = (ticketId: string) => {
    setSelectedTicketIds(prev => 
      prev.includes(ticketId) 
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedTicketIds.length === filteredTickets.length) {
      setSelectedTicketIds([]);
    } else {
      setSelectedTicketIds(filteredTickets.map(t => t.id));
    }
  };

  // Apply search, sort, and filter
  const filteredTickets = useMemo(() => {
    const priorityOrder: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    const statusOrder: Record<string, number> = { OPEN: 4, IN_PROGRESS: 3, RESOLVED: 2, CLOSED: 1 };

    const sortFieldMap: Record<string, keyof TicketData | ((item: TicketData) => any)> = {
      createdAt: (item) => new Date(item.createdAt),
      updatedAt: (item) => new Date(item.updatedAt),
      priority: (item) => priorityOrder[item.priority] || 0,
      status: (item) => statusOrder[item.status] || 0,
      ticketNumber: 'ticketNumber',
    };

    return applySearchSortFilter(
      tickets,
      searchQuery,
      ['title', 'ticketNumber', 'description', (t) => t.organization?.name || '', (t) => t.user?.email || ''],
      sortFieldMap[sortField],
      sortDirection,
      {
        status: { field: 'status', value: filterValues.status },
        priority: { field: 'priority', value: filterValues.priority },
      }
    );
  }, [tickets, searchQuery, sortField, sortDirection, filterValues]);

  const handleSortChange = (field: string, direction: 'asc' | 'desc') => {
    setSortField(field);
    setSortDirection(direction);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilterValues(prev => ({ ...prev, [key]: value }));
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { color: string; icon: any }> = {
      OPEN: { color: 'bg-yellow-600 text-white', icon: AlertCircle },
      IN_PROGRESS: { color: 'bg-gray-700 text-white', icon: Clock },
      RESOLVED: { color: 'bg-green-600 text-white', icon: CheckCircle },
      CLOSED: { color: 'bg-muted text-muted-foreground', icon: CheckCircle },
    };
    const config = configs[status] || configs.OPEN;
    const Icon = config.icon;
    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      LOW: 'bg-muted text-muted-foreground',
      MEDIUM: 'bg-gray-600 text-white',
      HIGH: 'bg-orange-600 text-white',
      URGENT: 'bg-red-600 text-white',
    };
    return <Badge className={colors[priority] || 'bg-muted text-muted-foreground'}>{priority}</Badge>;
  };

  // Page title based on role
  const pageTitle = isPlatformAdmin 
    ? 'All Support Tickets' 
    : isOrgAdmin 
      ? 'Organization Tickets' 
      : 'My Support Tickets';

  const pageDescription = isPlatformAdmin 
    ? 'View and manage tickets from all organizations' 
    : isOrgAdmin 
      ? 'View tickets from you and your team' 
      : 'View and track your support requests';

  return (
    <PageLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">{pageTitle}</h1>
            <p className="text-muted-foreground">{pageDescription}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={fetchTickets}
              disabled={loading}
              className="border-border text-foreground hover:bg-accent"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {!isPlatformAdmin && (
              <Button onClick={() => setCreateDialogOpen(true)} className="bg-gray-700 hover:bg-gray-800">
                <Plus className="w-4 h-4 mr-2" />
                New Ticket
              </Button>
            )}
          </div>
        </div>

        {/* Search, Sort, Filter Bar */}
        <SearchSortBar
          searchPlaceholder="Search tickets..."
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

        {/* Bulk Actions Bar */}
        {isPlatformAdmin && selectedTicketIds.length > 0 && (
          <div className="mb-4 flex items-center gap-3 p-4 bg-accent rounded-lg border border-border">
            <span className="text-sm text-foreground font-medium">
              {selectedTicketIds.length} ticket{selectedTicketIds.length !== 1 ? 's' : ''} selected
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkStatusDialogOpen(true)}
              className="border-border"
            >
              Update Status
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedTicketIds([])}
              className="text-muted-foreground"
            >
              Clear Selection
            </Button>
          </div>
        )}

        {/* Tickets Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-foreground">
              <Ticket className="w-5 h-5 text-gray-500" />
              Tickets ({filteredTickets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-gray-500" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-12">
                <Ticket className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No tickets found</p>
                {!isPlatformAdmin && (
                  <Button 
                    className="mt-4"
                    onClick={() => setCreateDialogOpen(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create your first ticket
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {isPlatformAdmin && (
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedTicketIds.length === filteredTickets.length && filteredTickets.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                    )}
                    <TableHead className="text-muted-foreground">Ticket #</TableHead>
                    <TableHead className="text-muted-foreground">Subject</TableHead>
                    {isPlatformAdmin && <TableHead className="text-muted-foreground">Organization</TableHead>}
                    {(isPlatformAdmin || isOrgAdmin) && <TableHead className="text-muted-foreground">User</TableHead>}
                    <TableHead className="text-muted-foreground">Priority</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Created</TableHead>
                    <TableHead className="text-muted-foreground w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      {isPlatformAdmin && (
                        <TableCell>
                          <Checkbox
                            checked={selectedTicketIds.includes(ticket.id)}
                            onCheckedChange={() => toggleTicketSelection(ticket.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-foreground">{ticket.ticketNumber}</TableCell>
                      <TableCell className="font-medium text-foreground">{ticket.title}</TableCell>
                      {isPlatformAdmin && (
                        <TableCell className="text-foreground">
                          <div className="flex items-center gap-1">
                            <Building2 className="w-4 h-4" />
                            {ticket.organization?.name || 'Unknown'}
                          </div>
                        </TableCell>
                      )}
                      {(isPlatformAdmin || isOrgAdmin) && (
                        <TableCell className="text-foreground">
                          <div className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {ticket.user ? `${ticket.user.firstName} ${ticket.user.lastName}` : 'Unknown'}
                          </div>
                        </TableCell>
                      )}
                      <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                      <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-accent">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover border-border">
                            <DropdownMenuItem 
                              onSelect={() => viewTicket(ticket)}
                              className="text-foreground hover:bg-accent cursor-pointer"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {isPlatformAdmin && ticket.status === 'OPEN' && (
                              <DropdownMenuItem 
                                onSelect={() => updateTicketStatus(ticket.id, 'IN_PROGRESS')}
                                className="text-gray-500 hover:bg-gray-800/20 cursor-pointer"
                              >
                                <Clock className="w-4 h-4 mr-2" />
                                Mark In Progress
                              </DropdownMenuItem>
                            )}
                            {isPlatformAdmin && ticket.status !== 'CLOSED' && (
                              <DropdownMenuItem 
                                onSelect={() => updateTicketStatus(ticket.id, 'CLOSED')}
                                className="text-green-400 hover:bg-green-900/20 cursor-pointer"
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Close Ticket
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

        {/* Create Ticket Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="bg-popover border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Create Support Ticket</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Describe your issue and we'll get back to you soon
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label className="text-foreground">Subject</Label>
                <Input
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  placeholder="Brief description of your issue"
                  className="bg-secondary border-border text-foreground"
                />
              </div>
              <div>
                <Label className="text-foreground">Description</Label>
                <Textarea
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  placeholder="Provide detailed information about your issue..."
                  rows={4}
                  className="bg-secondary border-border text-foreground"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-foreground">Priority</Label>
                  <Select 
                    value={newTicket.priority} 
                    onValueChange={(value) => setNewTicket({ ...newTicket, priority: value })}
                  >
                    <SelectTrigger className="bg-secondary border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="URGENT">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-foreground">Category</Label>
                  <Select 
                    value={newTicket.category} 
                    onValueChange={(value) => setNewTicket({ ...newTicket, category: value })}
                  >
                    <SelectTrigger className="bg-secondary border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="GENERAL">General</SelectItem>
                      <SelectItem value="BILLING">Billing</SelectItem>
                      <SelectItem value="TECHNICAL">Technical</SelectItem>
                      <SelectItem value="MACHINE_REQUEST">Machine Request</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setCreateDialogOpen(false)}
                className="border-border text-foreground"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateTicket}
                disabled={creating}
                className="bg-gray-700 hover:bg-gray-800"
              >
                {creating ? 'Creating...' : 'Create Ticket'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Ticket Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="bg-popover border-border max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground flex items-center gap-2">
                <Ticket className="w-5 h-5 text-yellow-400" />
                {selectedTicket?.ticketNumber}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {selectedTicket?.title}
              </DialogDescription>
            </DialogHeader>

            {selectedTicket && (
              <div className="space-y-6">
                {/* Ticket Info */}
                <div className="flex gap-4">
                  {getStatusBadge(selectedTicket.status)}
                  {getPriorityBadge(selectedTicket.priority)}
                  <Badge className="bg-gray-200 text-gray-700">
                    {selectedTicket.category}
                  </Badge>
                </div>

                {isPlatformAdmin && selectedTicket.organization && (
                  <div className="bg-secondary p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground">Organization</p>
                    <p className="text-foreground">{selectedTicket.organization.name}</p>
                  </div>
                )}

                {/* Original Description */}
                <div className="bg-secondary p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-gray-500" />
                    <span className="text-foreground font-medium">
                      {selectedTicket.user ? `${selectedTicket.user.firstName} ${selectedTicket.user.lastName}` : 'User'}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {new Date(selectedTicket.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-foreground whitespace-pre-wrap">{selectedTicket.description}</p>
                </div>

                {/* Responses */}
                {selectedTicket.responses && selectedTicket.responses.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-foreground font-medium">Responses</h4>
                    {selectedTicket.responses.map((response) => (
                      <div 
                        key={response.id} 
                        className={`p-4 rounded-lg ${
                          response.isAdminResponse 
                            ? 'bg-gray-800/30 border border-gray-600/50' 
                            : 'bg-secondary'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className={`w-4 h-4 ${response.isAdminResponse ? 'text-gray-500' : 'text-muted-foreground'}`} />
                          <span className="text-foreground font-medium">
                            {response.isAdminResponse ? 'Admin' : (response.user ? `${response.user.firstName} ${response.user.lastName}` : 'User')}
                          </span>
                          <span className="text-muted-foreground text-sm">
                            {new Date(response.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-foreground whitespace-pre-wrap">{response.message}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply Box */}
                {selectedTicket.status !== 'CLOSED' && (
                  <div className="space-y-3">
                    <h4 className="text-foreground font-medium">Add Reply</h4>
                    <Textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Type your message..."
                      rows={3}
                      className="bg-secondary border-border text-foreground"
                    />
                    <Button 
                      onClick={handleReply}
                      disabled={replying || !replyMessage.trim()}
                      className="bg-gray-700 hover:bg-gray-800"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {replying ? 'Sending...' : 'Send Reply'}
                    </Button>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setViewDialogOpen(false)}
                className="border-border text-foreground"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Status Update Dialog */}
        <Dialog open={bulkStatusDialogOpen} onOpenChange={setBulkStatusDialogOpen}>
          <DialogContent className="bg-popover border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Update Status</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Update status for {selectedTicketIds.length} selected ticket{selectedTicketIds.length !== 1 ? 's' : ''}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label className="text-foreground">New Status</Label>
                <Select value={bulkStatus} onValueChange={setBulkStatus}>
                  <SelectTrigger className="bg-secondary border-border text-foreground">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="RESOLVED">Resolved</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setBulkStatusDialogOpen(false)}
                className="border-border text-foreground"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleBulkStatusUpdate}
                disabled={bulkUpdating || !bulkStatus}
                className="bg-gray-700 hover:bg-gray-800"
              >
                {bulkUpdating ? 'Updating...' : 'Update Status'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </PageLayout>
  );
}
