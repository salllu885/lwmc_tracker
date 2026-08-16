import { NavLink, useNavigate } from 'react-router-dom';
import { ClipboardList, CheckCircle2, LayoutDashboard, Map as MapIcon, BarChart3, Users, LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth';

// Mirrors the requirements doc's §51 "Main Navigation Summary" per role.
const NAV_BY_ROLE = {
  SURVEYER: [
    { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
    { to: '/reports', label: 'Reports', icon: ClipboardList },
    { to: '/reports/new', label: 'New Issue', icon: ClipboardList },
    { to: '/profile', label: 'Profile', icon: Users },
  ],
  SUPERVISOR: [
    { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
    { to: '/reports?status=PENDING', label: 'Pending', icon: CheckCircle2 },
    { to: '/map', label: 'Map', icon: MapIcon },
    { to: '/reports', label: 'Reports', icon: ClipboardList, end: true },
    { to: '/profile', label: 'Profile', icon: Users },
  ],
  ZO: [
    { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
    { to: '/reports?status=PENDING', label: 'Pending', icon: CheckCircle2 },
    { to: '/map', label: 'Map', icon: MapIcon },
    { to: '/reports', label: 'Reports', icon: ClipboardList, end: true },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/profile', label: 'Profile', icon: Users },
  ],
  MANAGER: [
    { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
    { to: '/reports', label: 'Reports', icon: ClipboardList },
    { to: '/map', label: 'Map', icon: MapIcon },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/profile', label: 'Profile', icon: Users },
  ],
  GM: gmAcNav(),
  AC: gmAcNav(),
  ADMIN: [
    { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
    { to: '/reports', label: 'Reports', icon: ClipboardList },
    { to: '/map', label: 'Map', icon: MapIcon },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/admin/tehsils', label: 'Admin', icon: Users },
    { to: '/profile', label: 'Profile', icon: Users },
  ],
};

function gmAcNav() {
  return [
    { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
    { to: '/reports', label: 'Reports', icon: ClipboardList },
    { to: '/map', label: 'Map', icon: MapIcon },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/profile', label: 'Profile', icon: Users },
  ];
}

// Same component tree serves the packaged Android app and the browser
// "web dashboard" — bottom tabs under the md breakpoint, a sidebar above it.
export default function NavShell({ children }) {
  const { profile, role, logout } = useAuth();
  const navigate = useNavigate();
  const items = NAV_BY_ROLE[role] || [];

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col md:flex-row">
      <aside className="hidden md:flex md:flex-col md:w-56 bg-slate-900 text-white shrink-0">
        <div className="p-4">
          <h1 className="text-lg font-bold tracking-tight">Field Issue Tracker</h1>
          <span className="text-[11px] text-amber-400 font-mono uppercase tracking-wide">
            {profile?.full_name} · {role}
          </span>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                  isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`
              }
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={handleLogout} className="flex items-center gap-2 px-5 py-4 text-sm text-slate-400 hover:text-white">
          <LogOut size={16} /> Log out
        </button>
      </aside>

      <header className="md:hidden bg-slate-900 text-white sticky top-0 z-40">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Field Issue Tracker</h1>
            <span className="text-[11px] text-amber-400 font-mono uppercase tracking-wide">{role}</span>
          </div>
          <button onClick={handleLogout}>
            <LogOut size={18} className="text-slate-400" />
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 pb-20 md:pb-4">{children}</main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex z-40">
        {items.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-slate-900' : 'text-slate-400'}`
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
