import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function Profile() {
  const { profile, role, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-slate-900">Profile</h2>
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 text-sm">
        <div>
          <span className="text-slate-400">Name:</span> {profile?.full_name}
        </div>
        <div>
          <span className="text-slate-400">Username:</span> {profile?.username}
        </div>
        <div>
          <span className="text-slate-400">Phone:</span> {profile?.phone || '—'}
        </div>
        <div>
          <span className="text-slate-400">Role:</span> {role}
        </div>
      </div>
      <button onClick={handleLogout} className="w-full rounded-xl bg-slate-900 text-white font-semibold py-3 text-sm hover:bg-slate-800 transition-colors">
        Log out
      </button>
    </div>
  );
}
