import { NavLink, useNavigate } from 'react-router-dom';
import { Cloud, ShoppingCart, Server, Users, FileText, Headphones, Menu, Upload, LogIn, LogOut, UserCircle, Settings, LayoutDashboard, Building2, Ticket, Film } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { NotificationBell } from './NotificationBell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export function TopNav() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, isLoading, user, login, logout, register, hasRole } = useAuth();

  const isPlatformAdmin = hasRole('admin') && !hasRole('studio_owner');
  const isStudioAdmin = hasRole('studio_owner') || hasRole('studio_admin');
  const isRegularUser = !hasRole('admin') && !hasRole('studio_owner') && !hasRole('studio_admin');

  // Different nav items based on role
  const getNavItems = () => {
    if (isPlatformAdmin) {
      // Platform Admin navigation
      return [
        { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', public: false },
        { to: '/admin/organizations', icon: Building2, label: 'Organizations', public: false },
        { to: '/admin/machines', icon: Server, label: 'Machine Requests', public: false },
        { to: '/users', icon: Users, label: 'Users', public: false },
        { to: '/shows', icon: Film, label: 'Shows', public: false },
        { to: '/tickets', icon: Ticket, label: 'Tickets', public: false },
        { to: '/invoices', icon: FileText, label: 'Orders', public: false },
      ];
    } else if (isStudioAdmin) {
      // Studio Owner/Admin navigation
      return [
        { to: '/quote', icon: ShoppingCart, label: 'Get Quote', public: false },
        { to: '/machines', icon: Server, label: 'Machines', public: false },
        { to: '/shows', icon: Film, label: 'Shows', public: false },
        { to: '/users', icon: Users, label: 'Users', public: false },
        { to: '/upload', icon: Upload, label: 'Upload Data', public: false },
        { to: '/invoices', icon: FileText, label: 'Invoices', public: false },
        { to: '/tickets', icon: Ticket, label: 'Support', public: false },
        { to: '/settings', icon: Settings, label: 'Settings', public: false },
      ];
    } else if (isRegularUser && isAuthenticated) {
      // Regular User navigation
      return [
        { to: '/machines', icon: Server, label: 'My Machines', public: false },
        { to: '/shows', icon: Film, label: 'My Shows', public: false },
        { to: '/upload', icon: Upload, label: 'Upload Data', public: false },
        { to: '/tickets', icon: Ticket, label: 'Support', public: false },
      ];
    } else {
      // Not authenticated - show nothing, landing page will show
      return [];
    }
  };

  const navItems = getNavItems();

  // Filter nav items based on authentication
  const visibleNavItems = navItems.filter(item => {
    if (item.public) return true;
    return isAuthenticated;
  });

  return (
    <>
      <nav className="bg-card text-foreground [box-shadow:var(--shadow-raised)] mb-1 sticky top-0 z-50">
        <div className="mx-auto px-6">
          <div className="flex items-center h-16">
            {/* Logo - clickable to go home - ALWAYS visible */}
            <NavLink to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-shrink-0 min-w-[150px]">
              <div className="relative">
                <Cloud className="w-9 h-9 text-primary" />
              </div>
              <div className="leading-tight">
                <h1 className="text-lg font-bold text-foreground" style={{ letterSpacing: '0.12em', lineHeight: '1.2' }}>
                  ANKIYA
                </h1>
                <p className="text-xs text-muted-foreground -mt-0.5">connect</p>
              </div>
            </NavLink>

            {/* Desktop Navigation - centered */}
            <div className="hidden md:flex items-center space-x-1 flex-1 justify-center">
              {visibleNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-white text-gray-800 [box-shadow:var(--shadow-inset)] font-semibold'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              ))}
            </div>

            {/* User Info & Auth Buttons - right side - ALWAYS visible area */}
            <div className="flex items-center gap-2 flex-shrink-0 min-w-[150px] justify-end">
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-pulse bg-muted h-8 w-8 rounded-full"></div>
                  <div className="animate-pulse bg-muted h-8 w-20 rounded hidden lg:block"></div>
                </div>
              ) : isAuthenticated && user ? (
                <div className="flex items-center gap-2">
                  <NotificationBell />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="flex items-center gap-2">
                        <UserCircle className="w-5 h-5" />
                        <div className="hidden lg:block text-left">
                          <p className="text-sm font-medium">{user.fullName || user.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {user.roles.find(r => ['admin', 'studio_owner', 'studio_admin', 'studio_user'].includes(r))?.replace('_', ' ') || 'User'}
                          </p>
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        <div className="flex flex-col">
                          <span>{user.fullName}</span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate('/profile')}>
                        <UserCircle className="w-4 h-4 mr-2" />
                        Profile Settings
                      </DropdownMenuItem>
                      {(user.roles.includes('studio_owner') || user.roles.includes('studio_admin')) && (
                        <>
                          <DropdownMenuItem onClick={() => navigate('/settings')}>
                            <Settings className="w-4 h-4 mr-2" />
                            Organization
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      {(!user.roles.includes('studio_owner') && !user.roles.includes('studio_admin')) && (
                        <DropdownMenuSeparator />
                      )}
                      <DropdownMenuItem onClick={logout} className="text-red-600">
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={logout}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    title="Sign Out"
                  >
                    <LogOut className="w-5 h-5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={login}
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => navigate('/signup')}
                    variant="default"
                  >
                    Register Studio
                  </Button>
                </div>
              )}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-accent"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 space-y-1 border-t border-border">
              {visibleNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-white text-gray-800 font-semibold [box-shadow:var(--shadow-inset)]'
                        : 'text-muted-foreground hover:bg-accent'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
              {!isAuthenticated && (
                <div className="pt-4 flex flex-col gap-2 px-4">
                  <Button onClick={login} variant="outline" className="w-full">
                    Sign In
                  </Button>
                  <Button onClick={register} className="w-full" variant="default">
                    Register
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Animated background bar */}

    </>
  );
}
