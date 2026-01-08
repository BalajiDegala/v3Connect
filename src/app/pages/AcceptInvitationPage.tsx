import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { UserPlus, Loader2, CheckCircle, XCircle, Mail, AlertTriangle, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

interface InvitationData {
  id: string;
  email: string;
  role: string;
  organizationName: string;
  invitedBy: string;
  expiresAt: string;
}

export function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { isAuthenticated, user, logout } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // Fetch invitation details
  useEffect(() => {
    const fetchInvitation = async () => {
      if (!token) {
        setError('Invalid invitation link');
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`http://localhost:5000/api/invitations/${token}`);
        if (response.ok) {
          const data = await response.json();
          setInvitation(data);
        } else {
          const err = await response.json();
          setError(err.error || 'Invalid or expired invitation');
        }
      } catch (err) {
        setError('Failed to load invitation');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvitation();
  }, [token]);

  const handleAcceptInvitation = async () => {
    if (!isAuthenticated) {
      // Store invitation token and redirect to Keycloak registration
      sessionStorage.setItem('pendingInvitation', token || '');
      
      import('../contexts/AuthContext').then(module => {
        const keycloak = module.default;
        keycloak.register({
          redirectUri: `${window.location.origin}/invite/accept?token=${token}`,
          loginHint: invitation?.email, // Pre-fill email
        });
      });
      return;
    }

    // User is authenticated, accept the invitation
    setIsAccepting(true);
    try {
      const authToken = await getToken();
      const response = await fetch(`http://localhost:5000/api/invitations/${token}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setAccepted(true);
        toast.success('Welcome to the team!');
        // Reload to update user context with organization
        setTimeout(() => window.location.href = '/', 2000);
      } else {
        const err = await response.json();
        toast.error(err.error || 'Failed to accept invitation');
      }
    } catch (err) {
      toast.error('Failed to accept invitation');
    } finally {
      setIsAccepting(false);
    }
  };

  const getToken = async (): Promise<string> => {
    const module = await import('../contexts/AuthContext');
    const keycloak = module.default;
    await keycloak.updateToken(30);
    return keycloak.token || '';
  };

  const handleLogoutAndRelogin = () => {
    // Store the invitation token so we can redirect back after login
    sessionStorage.setItem('pendingInvitation', token || '');
    sessionStorage.setItem('invitationEmail', invitation?.email || '');
    
    // Logout and redirect to login (not register)
    import('../contexts/AuthContext').then(module => {
      const keycloak = module.default;
      keycloak.logout({
        redirectUri: `${window.location.origin}/invite/accept?token=${token}`,
      });
    });
  };

  const isEmailMismatch = isAuthenticated && user?.email && invitation?.email && 
                          user.email.toLowerCase() !== invitation.email.toLowerCase();

  if (isLoading) {
    return (
      <div className="p-8 max-w-lg mx-auto flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-lg mx-auto">
        <Card className="text-center">
          <CardContent className="pt-12 pb-12">
            <XCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">Invalid Invitation</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.href = '/'}>
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="p-8 max-w-lg mx-auto">
        <Card className="text-center">
          <CardContent className="pt-12 pb-12">
            <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">Welcome to the Team!</h2>
            <p className="text-muted-foreground mb-4">
              You've successfully joined {invitation?.organizationName}. Redirecting...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-lg mx-auto">
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gray-200 rounded-full">
              <Mail className="w-8 h-8 text-gray-600" />
            </div>
          </div>
          <CardTitle>You're Invited!</CardTitle>
          <CardDescription>
            You've been invited to join an organization on Ankiya Cloud
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-secondary p-4 rounded-lg space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Organization</p>
              <p className="font-semibold">{invitation?.organizationName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Your Role</p>
              <p className="font-medium capitalize">{invitation?.role?.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{invitation?.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Invited By</p>
              <p className="font-medium">{invitation?.invitedBy}</p>
            </div>
          </div>

          {isEmailMismatch && (
            <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-900 mb-1">Email Mismatch</p>
                  <p className="text-sm text-amber-800 mb-3">
                    You're logged in as <span className="font-medium">{user?.email}</span>, but this invitation is for <span className="font-medium">{invitation?.email}</span>.
                    Please logout and login with the correct account.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleLogoutAndRelogin}
                    className="border-amber-400 text-amber-900 hover:bg-amber-100"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout & Login as {invitation?.email}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Button 
            onClick={handleAcceptInvitation} 
            className="w-full" 
            size="lg"
            disabled={isAccepting || isEmailMismatch}
          >
            {isAccepting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Accepting...
              </>
            ) : isAuthenticated ? (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Accept Invitation
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Create Account & Accept
              </>
            )}
          </Button>

          {isEmailMismatch && (
            <p className="text-xs text-center text-muted-foreground">
              The Accept button is disabled because the email addresses don't match.
            </p>
          )}

          <p className="text-xs text-muted-foreground text-center">
            This invitation expires on {new Date(invitation?.expiresAt || '').toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
