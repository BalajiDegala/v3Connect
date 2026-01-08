import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/PageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Building2, Save, Loader2, CheckCircle, Users, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = 'http://localhost:5000/api';

interface Organization {
  id: string;
  name: string;
  domain?: string;
  contactEmail: string;
  contactPhone?: string;
  address?: string;
  gstNumber?: string;
  status: string;
  subscription: string;
  createdAt: string;
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state for creating new organization
  const [formData, setFormData] = useState({
    name: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    gstNumber: '',
  });

  // Fetch organization if user has one
  useEffect(() => {
    const fetchOrganization = async () => {
      if (!isAuthenticated || authLoading) return;
      
      try {
        const token = await getToken();
        const response = await fetch(`${API_BASE_URL}/organizations/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const org = await response.json();
          setOrganization(org);
          setFormData({
            name: org.name || '',
            contactEmail: org.contactEmail || '',
            contactPhone: org.contactPhone || '',
            address: org.address || '',
            gstNumber: org.gstNumber || '',
          });
        } else if (response.status === 404) {
          // No organization yet
          setOrganization(null);
          // Pre-fill email from user
          setFormData(prev => ({
            ...prev,
            contactEmail: user?.email || '',
          }));
        }
      } catch (error) {
        console.error('Error fetching organization:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrganization();
  }, [isAuthenticated, authLoading, user]);

  const getToken = async (): Promise<string> => {
    const module = await import('../contexts/AuthContext');
    const keycloak = module.default;
    await keycloak.updateToken(30);
    return keycloak.token || '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Organization name is required');
      return;
    }

    if (!formData.contactEmail.trim()) {
      toast.error('Contact email is required');
      return;
    }

    setIsSaving(true);
    try {
      const token = await getToken();
      const url = organization 
        ? `${API_BASE_URL}/organizations/${organization.id}`
        : `${API_BASE_URL}/organizations`;
      
      const response = await fetch(url, {
        method: organization ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const savedOrg = await response.json();
        setOrganization(savedOrg);
        toast.success(organization ? 'Organization updated!' : 'Organization created! You can now place orders.');
        
        // Refresh user context to get updated organizationId
        window.location.reload();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save organization');
      }
    } catch (error) {
      console.error('Error saving organization:', error);
      toast.error('Failed to save organization. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center">
        <Card>
          <CardContent className="pt-8 pb-8">
            <Building2 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Sign in Required</h2>
            <p className="text-muted-foreground mb-4">Please sign in to manage your organization settings.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PageLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="w-8 h-8 text-gray-600" />
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your organization and account</p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Organization Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-gray-600" />
              <CardTitle>
                {organization ? 'Organization Details' : 'Create Organization'}
              </CardTitle>
            </div>
            <CardDescription>
              {organization 
                ? 'Update your organization information'
                : 'Set up your organization to start ordering cloud workstations'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Organization Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., My VFX Studio"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Contact Email *</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    placeholder="billing@example.com"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Phone Number</Label>
                  <Input
                    id="contactPhone"
                    placeholder="+91 98765 43210"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gstNumber">GST Number</Label>
                  <Input
                    id="gstNumber"
                    placeholder="22AAAAA0000A1Z5"
                    value={formData.gstNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, gstNumber: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  placeholder="Full address including city, state, and pincode"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  rows={3}
                />
              </div>

              {organization && (
                <div className="p-4 bg-secondary rounded-lg border">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <p className="font-medium flex items-center gap-1">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        {organization.status}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Plan</p>
                      <p className="font-medium">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          organization.subscription === 'FREE' ? 'bg-gray-200 text-gray-700' :
                          organization.subscription === 'STARTER' ? 'bg-blue-100 text-blue-700' :
                          organization.subscription === 'PROFESSIONAL' ? 'bg-purple-100 text-purple-700' :
                          organization.subscription === 'ENTERPRISE' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-200 text-gray-700'
                        }`}>
                          {organization.subscription || 'FREE'}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Domain</p>
                      <p className="font-medium">{organization.domain || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Created</p>
                      <p className="font-medium">{new Date(organization.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {organization ? 'Update Organization' : 'Create Organization'}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* User Info Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-600" />
              <CardTitle>Account Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-secondary rounded-lg">
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{user?.fullName || 'Not set'}</p>
              </div>
              <div className="p-4 bg-secondary rounded-lg">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{user?.email}</p>
              </div>
              <div className="p-4 bg-secondary rounded-lg">
                <p className="text-sm text-muted-foreground">Role</p>
                <p className="font-medium capitalize">{user?.roles[0]?.replace('_', ' ') || 'User'}</p>
              </div>
              <div className="p-4 bg-secondary rounded-lg">
                <p className="text-sm text-muted-foreground">Email Verified</p>
                <p className="font-medium flex items-center gap-1">
                  {user?.emailVerified ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      Yes
                    </>
                  ) : (
                    'No'
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
        </div>
      </div>
    </PageLayout>
  );
}
