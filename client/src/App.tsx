import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import ErrorBoundary from './components/ui/ErrorBoundary';
import OrganigramPage from './components/organigram/OrganigramPage';
import AdminLayout from './components/admin/AdminLayout';
import AdminDashboard from './components/admin/AdminDashboard';
import Dashboard from './components/admin/Dashboard';
import TeamManager from './components/admin/TeamManager';
import MemberManager from './components/admin/MemberManager';
import ExecutiveManager from './components/admin/ExecutiveManager';
import VersionHistory from './components/admin/VersionHistory';
import ClientTeamManager from './components/admin/ClientTeamManager';
import Settings from './components/admin/Settings';
import SuperchargerManager from './components/admin/SuperchargerManager';
import KlantenManager from './components/admin/KlantenManager';
import ProjectList from './components/admin/ProjectList';
import ProjectForm from './components/admin/ProjectForm';
import BriefingPage from './components/BriefingPage';

export default function App() {
  return (
    <ErrorBoundary>
    <ToastProvider>
    <AuthProvider>
      <Routes>
        {/* Public briefing page (no auth) */}
        <Route path="/briefing/:token" element={<BriefingPage />} />

        {/* Public dashboard */}
        <Route path="/" element={<OrganigramPage />} />

        {/* Admin panel */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="overzicht" element={<Dashboard />} />
          <Route path="teams" element={<TeamManager />} />
          <Route path="directie" element={<ExecutiveManager />} />
          <Route path="members" element={<MemberManager />} />
          <Route path="client-teams" element={<ClientTeamManager />} />
          <Route path="versions" element={<VersionHistory />} />
          <Route path="klanten" element={<KlantenManager />} />
          <Route path="projects" element={<ProjectList />} />
          <Route path="projects/new" element={<ProjectForm />} />
          <Route path="projects/:id" element={<ProjectForm />} />
          <Route path="superchargers" element={<SuperchargerManager />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </AuthProvider>
    </ToastProvider>
    </ErrorBoundary>
  );
}
