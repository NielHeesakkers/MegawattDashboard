import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import OrganigramPage from './components/organigram/OrganigramPage';
import AdminLayout from './components/admin/AdminLayout';
import Dashboard from './components/admin/Dashboard';
import TeamManager from './components/admin/TeamManager';
import MemberManager from './components/admin/MemberManager';
import ExecutiveManager from './components/admin/ExecutiveManager';
import AuditLog from './components/admin/AuditLog';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public organigram */}
        <Route path="/" element={<OrganigramPage />} />

        {/* Admin panel */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="teams" element={<TeamManager />} />
          <Route path="members" element={<MemberManager />} />
          <Route path="executives" element={<ExecutiveManager />} />
          <Route path="audit" element={<AuditLog />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
