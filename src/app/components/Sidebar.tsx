import { NavLink } from 'react-router-dom';
import { Cloud, ShoppingCart, Server, Users, FileText, Headphones } from 'lucide-react';

export function Sidebar() {
  const navItems = [
    { to: '/', icon: ShoppingCart, label: 'Get Quote' },
    { to: '/machines', icon: Server, label: 'Machines' },
    { to: '/users', icon: Users, label: 'Users' },
    { to: '/invoices', icon: FileText, label: 'Invoices' },
    { to: '/support', icon: Headphones, label: 'Support' },
  ];

  return (
    <div className="w-64 bg-card text-foreground h-screen flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <Cloud className="w-8 h-8 text-gray-500" />
          <div>
            <h1 className="text-xl">Ankiya Cloud</h1>
            <p className="text-xs text-muted-foreground">Producer Dashboard</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
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
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground">
          <p>Organization: Acme Corp</p>
          <p>Admin: admin@acme.com</p>
        </div>
      </div>
    </div>
  );
}
