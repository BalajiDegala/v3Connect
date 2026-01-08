import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PageLayout } from '../components/PageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { 
  Building2, 
  Users, 
  Server, 
  Ticket, 
  DollarSign, 
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface DashboardStats {
  organizations: {
    total: number;
    active: number;
    suspended: number;
  };
  users: {
    total: number;
    active: number;
    pending: number;
  };
  machines: {
    total: number;
    running: number;
    free: number;
    expired: number;
  };
  tickets: {
    total: number;
    open: number;
    inProgress: number;
    closed: number;
  };
  orders: {
    total: number;
    pending: number;
    completed: number;
    totalRevenue: number;
  };
}

const API_BASE = 'http://localhost:5000/api';

export function AdminDashboardPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentTickets, setRecentTickets] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    if (!token) return;
    setLoading(true);

    try {
      const [statsRes, ticketsRes, ordersRes] = await Promise.all([
        fetch(`${API_BASE}/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/admin/tickets?limit=5`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/admin/orders?limit=5`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (ticketsRes.ok) {
        setRecentTickets(await ticketsRes.json());
      }
      if (ordersRes.ok) {
        setRecentOrders(await ordersRes.json());
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  // Default stats if API doesn't return data yet
  const displayStats: DashboardStats = stats || {
    organizations: { total: 0, active: 0, suspended: 0 },
    users: { total: 0, active: 0, pending: 0 },
    machines: { total: 0, running: 0, free: 0, expired: 0 },
    tickets: { total: 0, open: 0, inProgress: 0, closed: 0 },
    orders: { total: 0, pending: 0, completed: 0, totalRevenue: 0 },
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <PageLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
            <p className="text-muted-foreground">Platform overview and management</p>
          </div>
          <Button 
            variant="outline" 
            onClick={fetchDashboardData}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          {/* Organizations */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Organizations</CardTitle>
              <Building2 className="w-4 h-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{displayStats.organizations.total}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-foreground">{displayStats.organizations.active} active</span>
                {displayStats.organizations.suspended > 0 && (
                  <span className="text-foreground ml-2">{displayStats.organizations.suspended} suspended</span>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Users */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Users</CardTitle>
              <Users className="w-4 h-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{displayStats.users.total}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-foreground">{displayStats.users.active} active</span>
                {displayStats.users.pending > 0 && (
                  <span className="text-foreground ml-2">{displayStats.users.pending} pending</span>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Machines */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Machines</CardTitle>
              <Server className="w-4 h-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{displayStats.machines.total}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-foreground">{displayStats.machines.running} running</span>
                <span className="text-foreground ml-2">{displayStats.machines.free} free</span>
              </p>
            </CardContent>
          </Card>

          {/* Tickets */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Open Tickets</CardTitle>
              <Ticket className="w-4 h-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{displayStats.tickets.open}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-foreground">{displayStats.tickets.inProgress} in progress</span>
              </p>
            </CardContent>
          </Card>

          {/* Revenue */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
              <DollarSign className="w-4 h-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{formatCurrency(displayStats.orders.totalRevenue)}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-foreground">{displayStats.orders.completed} completed orders</span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Link to="/admin/organizations">
            <Button className="w-full bg-gray-800 hover:bg-gray-900">
              <Building2 className="w-4 h-4 mr-2" />
              View Organizations
            </Button>
          </Link>
          <Link to="/users">
            <Button className="w-full bg-gray-800 hover:bg-gray-900">
              <Users className="w-4 h-4 mr-2" />
              Manage Users
            </Button>
          </Link>
          <Link to="/machines">
            <Button className="w-full bg-gray-800 hover:bg-gray-900">
              <Server className="w-4 h-4 mr-2" />
              View Machines
            </Button>
          </Link>
          <Link to="/tickets">
            <Button className="w-full bg-gray-800 hover:bg-gray-900">
              <Ticket className="w-4 h-4 mr-2" />
              Support Tickets
            </Button>
          </Link>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Tickets */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                <Ticket className="w-5 h-5 text-gray-500" />
                Recent Tickets
              </CardTitle>
              <CardDescription className="text-muted-foreground">Latest support requests</CardDescription>
            </CardHeader>
            <CardContent>
              {recentTickets.length === 0 ? (
                <div className="text-center py-8">
                  <Ticket className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No recent tickets</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentTickets.map((ticket) => (
                    <div key={ticket.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                      <div>
                        <p className="font-medium text-foreground">{ticket.subject}</p>
                        <p className="text-sm text-muted-foreground">{ticket.organization?.name || 'Unknown Org'}</p>
                      </div>
                      <Badge className="bg-gray-800 text-white">
                        {ticket.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
              <Link to="/tickets" className="block mt-4">
                <Button variant="outline" className="w-full border-border text-muted-foreground hover:bg-accent">
                  View All Tickets
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Recent Orders */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                <TrendingUp className="w-5 h-5 text-gray-500" />
                Recent Orders
              </CardTitle>
              <CardDescription className="text-muted-foreground">Latest machine orders</CardDescription>
            </CardHeader>
            <CardContent>
              {recentOrders.length === 0 ? (
                <div className="text-center py-8">
                  <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No recent orders</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                      <div>
                        <p className="font-medium text-foreground">{order.orderNumber}</p>
                        <p className="text-sm text-muted-foreground">{order.organization?.name || 'Unknown Org'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-foreground">{formatCurrency(order.totalAmount)}</p>
                        <Badge className="bg-gray-800 text-white">
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Link to="/invoices" className="block mt-4">
                <Button variant="outline" className="w-full border-border text-muted-foreground hover:bg-accent">
                  View All Orders
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    </PageLayout>
  );
}
