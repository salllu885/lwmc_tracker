import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import RequireAuth from './routes/RequireAuth';
import NavShell from './components/NavShell';
import Login from './routes/Login';
import Home from './routes/Home';
import NewReport from './routes/NewReport';
import ReportsList from './routes/ReportsList';
import ReportDetail from './routes/ReportDetail';
import MapView from './routes/MapView';
import Analytics from './routes/Analytics';
import Profile from './routes/Profile';
import AdminLayout from './routes/Admin/AdminLayout';
import Tehsils from './routes/Admin/Tehsils';
import Zones from './routes/Admin/Zones';
import Ucs from './routes/Admin/Ucs';
import IssueTypes from './routes/Admin/IssueTypes';
import Users from './routes/Admin/Users';
import Assignments from './routes/Admin/Assignments';

function AuthedShell() {
  return (
    <RequireAuth>
      <NavShell>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/reports/new" element={<NewReport />} />
          <Route path="/reports/:id" element={<ReportDetail />} />
          <Route path="/reports" element={<ReportsList />} />
          <Route path="/map" element={<MapView />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="tehsils" replace />} />
            <Route path="tehsils" element={<Tehsils />} />
            <Route path="zones" element={<Zones />} />
            <Route path="ucs" element={<Ucs />} />
            <Route path="issue-types" element={<IssueTypes />} />
            <Route path="users" element={<Users />} />
            <Route path="assignments" element={<Assignments />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </NavShell>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<AuthedShell />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
