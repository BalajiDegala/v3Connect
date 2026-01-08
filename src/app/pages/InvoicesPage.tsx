import { useState, useMemo } from 'react';
import { useCloud } from '../contexts/CloudContext';
import { useAuth } from '../contexts/AuthContext';
import { PageLayout } from '../components/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { SearchSortBar, applySearchSortFilter, SortOption, FilterOption } from '../components/ui/SearchSortBar';
import { FileText, Download, Calendar, DollarSign, Building2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export function InvoicesPage() {
  const { invoices, loading, refreshData } = useCloud();
  const { user, token } = useAuth();
  
  // Search, Sort, Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({
    status: 'all',
    organization: 'all',
  });

  // Check if user is admin
  const isAdmin = user?.roles?.some(role => 
    role === 'SUPER_ADMIN' || role === 'admin' || role === 'realm-admin'
  );

  // Get unique organizations from invoices
  const organizations = useMemo(() => {
    const orgs = new Map<string, string>();
    invoices.forEach(inv => {
      if (inv.organizationId && inv.organizationName) {
        orgs.set(inv.organizationId, inv.organizationName);
      }
    });
    return Array.from(orgs.entries()).map(([id, name]) => ({ id, name }));
  }, [invoices]);

  // Sort options
  const sortOptions: SortOption[] = [
    { label: 'Date', value: 'date' },
    { label: 'Amount', value: 'amount' },
    { label: 'Invoice ID', value: 'invoiceNumber' },
    { label: 'Status', value: 'status' },
  ];

  // Filter options
  const filterOptions: FilterOption[] = [
    {
      label: 'Status',
      value: 'status',
      options: [
        { label: 'Paid', value: 'paid' },
        { label: 'Pending', value: 'pending' },
        { label: 'Overdue', value: 'overdue' },
      ],
    },
    ...(isAdmin && organizations.length > 0 ? [{
      label: 'Organization',
      value: 'organization',
      options: organizations.map(org => ({ label: org.name, value: org.id })),
    }] : []),
  ];

  // Apply search, sort, and filter
  const filteredInvoices = useMemo(() => {
    const sortFieldMap: Record<string, keyof typeof invoices[0] | ((item: typeof invoices[0]) => any)> = {
      date: (item) => new Date(item.date),
      amount: 'amount',
      invoiceNumber: 'invoiceNumber',
      status: 'status',
    };

    return applySearchSortFilter(
      invoices,
      searchQuery,
      ['invoiceNumber', 'organizationName', (inv) => inv.items.map(i => i.name).join(' ')],
      sortFieldMap[sortField],
      sortDirection,
      {
        status: { field: 'status', value: filterValues.status },
        organization: { field: 'organizationId', value: filterValues.organization },
      }
    );
  }, [invoices, searchQuery, sortField, sortDirection, filterValues]);

  const handleSortChange = (field: string, direction: 'asc' | 'desc') => {
    setSortField(field);
    setSortDirection(direction);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilterValues(prev => ({ ...prev, [key]: value }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-600 text-white';
      case 'pending':
        return 'bg-yellow-500 text-white';
      case 'overdue':
        return 'bg-red-600 text-white';
      default:
        return 'bg-gray-200 text-gray-700';
    }
  };

  const handleDownload = async (invoiceId: string) => {
    try {
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(`http://localhost:5000/api/invoices/${invoiceId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download invoice');
      }

      // Get the invoice data to generate filename
      const invoice = invoices.find(inv => inv.id === invoiceId);
      const filename = invoice?.invoiceNumber ? `${invoice.invoiceNumber}.pdf` : `invoice-${invoiceId}.pdf`;

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Invoice downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download invoice');
    }
  };

  const totalPaid = filteredInvoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.amount, 0);

  const totalPending = filteredInvoices
    .filter((inv) => inv.status === 'pending')
    .reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <PageLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Invoices</h1>
          <p className="text-muted-foreground">
            {isAdmin ? 'View and manage billing history across all organizations' : 'View and manage your billing history'}
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={refreshData}
          disabled={loading}
          className="border-border text-foreground hover:bg-accent"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Search, Sort, Filter Bar */}
      <SearchSortBar
        searchPlaceholder="Search invoices..."
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

      <div className="flex flex-wrap gap-3 mb-6">
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <DollarSign className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">₹{totalPaid.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Total Paid</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="flex-1 min-w-[140px]">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <DollarSign className="w-4 h-4 text-yellow-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">₹{totalPending.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="flex-1 min-w-[140px]">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-500/10">
                <FileText className="w-4 h-4 text-gray-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{filteredInvoices.length}</p>
                <p className="text-xs text-muted-foreground">Total Invoices</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">Loading invoices...</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  {filterValues.organization === 'all' || !filterValues.organization
                    ? 'No invoices yet. Purchase machines to generate invoices.'
                    : 'No invoices for this organization.'}
                </p>
              </div>
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                {isAdmin && <TableHead>Organization</TableHead>}
                <TableHead>Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.invoiceNumber || invoice.id}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{invoice.organizationName}</span>
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      {invoice.date}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {invoice.items.map((item, idx) => (
                        <div key={idx} className="text-muted-foreground">
                          {item.name} ×{item.quantity}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    ₹{invoice.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(invoice.status)}>
                      {invoice.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(invoice.id)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
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
