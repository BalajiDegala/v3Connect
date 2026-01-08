import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { CloudProvider } from './contexts/CloudContext';
import { AuthProvider, ProtectedRoute } from './contexts/AuthContext';
import { TopNav } from './components/TopNav';
import { HomePage } from './pages/HomePage';
import { QuotePage } from './pages/QuotePage';
import { MachinesPage } from './pages/MachinesPage';
import { UsersPage } from './pages/UsersPage';
import { DataUploadPage } from './pages/DataUploadPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { SupportPage } from './pages/SupportPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { OrganizationSignupPage } from './pages/OrganizationSignupPage';
import { AcceptInvitationPage } from './pages/AcceptInvitationPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminMachinesPage } from './pages/AdminMachinesPage';
import { OrganizationsPage } from './pages/OrganizationsPage';
import { TicketsPage } from './pages/TicketsPage';
import { ShowsPage } from './pages/ShowsPage';
import { Toaster } from './components/ui/sonner';

function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="overflow-auto">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CloudProvider>
        <BrowserRouter>
          <AppLayout>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/quote" element={
                  <ProtectedRoute requiredRoles={['studio_owner', 'studio_admin']}>
                    <QuotePage />
                  </ProtectedRoute>
                } />
                {/* Public routes */}
                <Route path="/signup" element={<OrganizationSignupPage />} />
                <Route path="/signup/complete" element={<OrganizationSignupPage />} />
                <Route path="/invite/accept" element={<AcceptInvitationPage />} />
                
                {/* Admin routes */}
                <Route path="/admin" element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <AdminDashboardPage />
                  </ProtectedRoute>
                } />
                <Route path="/admin/organizations" element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <OrganizationsPage />
                  </ProtectedRoute>
                } />
                <Route path="/admin/machines" element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <AdminMachinesPage />
                  </ProtectedRoute>
                } />
                
                {/* Protected routes */}
                <Route path="/machines" element={
                  <ProtectedRoute>
                    <MachinesPage />
                  </ProtectedRoute>
                } />
                <Route path="/users" element={
                  <ProtectedRoute requiredRoles={['admin', 'studio_owner', 'studio_admin']}>
                    <UsersPage />
                  </ProtectedRoute>
                } />
                <Route path="/shows" element={
                  <ProtectedRoute requiredRoles={['admin', 'studio_owner', 'studio_admin', 'studio_user']}>
                    <ShowsPage />
                  </ProtectedRoute>
                } />
                <Route path="/upload" element={
                  <ProtectedRoute>
                    <DataUploadPage />
                  </ProtectedRoute>
                } />
                <Route path="/invoices" element={
                  <ProtectedRoute requiredRoles={['admin', 'studio_owner', 'studio_admin']}>
                    <InvoicesPage />
                  </ProtectedRoute>
                } />
                <Route path="/tickets" element={
                  <ProtectedRoute>
                    <TicketsPage />
                  </ProtectedRoute>
                } />
                <Route path="/support" element={
                  <ProtectedRoute>
                    <SupportPage />
                  </ProtectedRoute>
                } />
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                } />
                <Route path="/settings" element={
                  <ProtectedRoute requiredRoles={['studio_owner', 'studio_admin']}>
                    <SettingsPage />
                  </ProtectedRoute>
                } />
              </Routes>
          </AppLayout>
          <Toaster />
        </BrowserRouter>
      </CloudProvider>
    </AuthProvider>
  );
}
