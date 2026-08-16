import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  { to: '/admin/tehsils', label: 'Tehsils' },
  { to: '/admin/zones', label: 'Zones' },
  { to: '/admin/ucs', label: 'UCs' },
  { to: '/admin/issue-types', label: 'Issue Types' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/assignments', label: 'Assignments' },
];

export default function AdminLayout() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-slate-900">Admin</h2>
      <div className="flex flex-wrap gap-1 bg-white rounded-xl border border-slate-200 p-1">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) => `px-3 py-1.5 rounded-lg text-xs font-medium ${isActive ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            {t.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
