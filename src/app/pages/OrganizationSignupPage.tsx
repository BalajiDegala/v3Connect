import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Building2, User, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const API_BASE = 'http://localhost:5000/api';

export function OrganizationSignupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, user, token, keycloak, login } = useAuth();
  const [step, setStep] = useState<'form' | 'creating' | 'complete'>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    orgName: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    gstNumber: '',
  });

  // Check if this is a completion callback (user returned from Keycloak)
  const isCompletionPage = location.pathname === '/signup/complete';

  // Load pending org data and auto-create when returning from Keycloak
  useEffect(() => {
    const pending = sessionStorage.getItem('pendingOrgSignup');
    
    if (pending) {
      const data = JSON.parse(pending);
      setFormData(data);
      
      // If authenticated and on completion page, auto-create org
      if (isAuthenticated && isCompletionPage && token) {
        createOrganization(data);
      }
    } else if (isCompletionPage && isAuthenticated) {
      // No pending data but authenticated, redirect to home
      navigate('/');
    }
  }, [isAuthenticated, isCompletionPage, token]);

  const createOrganization = async (orgData: typeof formData) => {
    setStep('creating');
    setIsSubmitting(true);
    
    try {
      const response = await fetch(`${API_BASE}/organizations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: orgData.orgName,
          contactEmail: orgData.contactEmail,
          contactPhone: orgData.contactPhone,
          address: orgData.address,
          gstNumber: orgData.gstNumber,
        }),
      });

      if (response.ok) {
        sessionStorage.removeItem('pendingOrgSignup');
        setStep('complete');
        toast.success('Organization created successfully!');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create organization');
        setStep('form');
      }
    } catch (error) {
      console.error('Error creating organization:', error);
      toast.error('Failed to create organization');
      setStep('form');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.orgName.trim()) {
      toast.error('Organization name is required');
      return;
    }

    if (!formData.contactEmail.trim()) {
      toast.error('Contact email is required');
      return;
    }

    if (isAuthenticated && token) {
      // User is already authenticated, create org directly
      await createOrganization(formData);
    } else {
      // Store data and redirect to Keycloak registration
      sessionStorage.setItem('pendingOrgSignup', JSON.stringify(formData));
      
      // Use Keycloak register
      keycloak.register({
        redirectUri: `${window.location.origin}/signup/complete`,
      });
    }
  };

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card className="text-center">
          <CardContent className="pt-12 pb-12">
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-gray-600 mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show creating state
  if (step === 'creating') {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card className="text-center">
          <CardContent className="pt-12 pb-12">
            <Loader2 className="w-16 h-16 mx-auto animate-spin text-gray-600 mb-6" />
            <h2 className="text-2xl font-bold mb-4">Setting Up Your Studio...</h2>
            <p className="text-muted-foreground">
              Please wait while we create your organization and configure your account.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card className="text-center">
          <CardContent className="pt-12 pb-12">
            <CheckCircle className="w-20 h-20 mx-auto text-green-500 mb-6" />
            <h2 className="text-2xl font-bold mb-4">Welcome to Ankiya Cloud!</h2>
            <p className="text-muted-foreground mb-6">
              Your organization has been created successfully. You can now invite team members and start ordering cloud workstations.
            </p>
            <p className="text-sm text-amber-600 mb-6">
              Note: Please sign out and sign back in to refresh your permissions.
            </p>
            <div className="flex gap-4 justify-center">
              <Button onClick={() => navigate('/')}>
                Get a Quote
              </Button>
              <Button variant="outline" onClick={() => navigate('/users')}>
                Manage Team
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <Building2 className="w-16 h-16 mx-auto text-gray-600 mb-4" />
        <h1 className="text-3xl font-bold">Register Your Studio</h1>
        <p className="text-muted-foreground mt-2">
          Create an organization to start using Ankiya Cloud for your VFX team
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
          <CardDescription>
            Tell us about your studio. You'll be the administrator of this organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Organization Info */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Studio Information
              </h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Studio/Organization Name *</Label>
                  <Input
                    id="orgName"
                    placeholder="e.g., Prime Focus VFX"
                    value={formData.orgName}
                    onChange={(e) => setFormData(prev => ({ ...prev, orgName: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Business Email *</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    placeholder="contact@studio.com"
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
                  <Label htmlFor="gstNumber">GST Number (optional)</Label>
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
                  placeholder="Full business address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>

            {/* Submit */}
            <div className="border-t pt-6">
              {isAuthenticated ? (
                <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Organization...
                    </>
                  ) : (
                    <>
                      <Building2 className="w-4 h-4 mr-2" />
                      Create Organization
                    </>
                  )}
                </Button>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    You'll create your admin account in the next step
                  </p>
                  <Button type="submit" className="w-full" size="lg">
                    <User className="w-4 h-4 mr-2" />
                    Continue to Create Account
                  </Button>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              By registering, you agree to our Terms of Service and Privacy Policy
            </p>
          </form>
        </CardContent>
      </Card>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <button onClick={login} className="text-gray-600 hover:underline">
          Sign In
        </button>
      </div>
    </div>
  );
}
