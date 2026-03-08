import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import OrganigramPage from './components/organigram/OrganigramPage';
import AdminLayout from './components/admin/AdminLayout';
import AdminDashboard from './components/admin/AdminDashboard';
import Dashboard from './components/admin/Dashboard';
import TeamManager from './components/admin/TeamManager';
import MemberManager from './components/admin/MemberManager';

import AuditLog from './components/admin/AuditLog';
import VersionHistory from './components/admin/VersionHistory';
import UserManager from './components/admin/UserManager';
import ClientTeamManager from './components/admin/ClientTeamManager';
import Settings from './components/admin/Settings';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public dashboard */}
        <Route path="/" element={<OrganigramPage />} />

        {/* Admin panel */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="overzicht" element={<Dashboard />} />
          <Route path="teams" element={<TeamManager />} />
          <Route path="members" element={<MemberManager />} />

          <Route path="client-teams" element={<ClientTeamManager />} />
          <Route path="users" element={<UserManager />} />
          <Route path="audit" element={<AuditLog />} />
          <Route path="versions" element={<VersionHistory />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
