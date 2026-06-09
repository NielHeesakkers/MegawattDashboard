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
import ToeleveranciersManager from './components/admin/ToeleveranciersManager';
import ProjectList from './components/admin/ProjectList';
import ProjectForm from './components/admin/ProjectForm';
import BriefingPage from './components/BriefingPage';
import SharedLocationsPage from './components/SharedLocationsPage';
import ResetPasswordPage from './components/ui/ResetPasswordPage';

export default function App() {
  return (
    <ErrorBoundary>
    <ToastProvider>
    <AuthProvider>
      <Routes>
        {/* Public briefing page (no auth) */}
        <Route path="/briefing/:token" element={<BriefingPage />} />
        <Route path="/locaties/deel/:token" element={<SharedLocationsPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

        {/* Public dashboard — dezelfde OrganigramPage bedient elke sectie, route bepaalt de view */}
        <Route path="/" element={<OrganigramPage />} />
        <Route path="/klantteams" element={<OrganigramPage />} />
        <Route path="/contacten/klanten" element={<OrganigramPage />} />
        <Route path="/contacten/klanten/:contactId" element={<OrganigramPage />} />
        <Route path="/contacten/toeleveranciers" element={<OrganigramPage />} />
        <Route path="/contacten/toeleveranciers/:contactId" element={<OrganigramPage />} />
        <Route path="/projecten" element={<OrganigramPage />} />
        <Route path="/projecten/actief" element={<OrganigramPage />} />
        <Route path="/projecten/afgerond" element={<OrganigramPage />} />
        <Route path="/projecten/geannuleerd" element={<OrganigramPage />} />
        <Route path="/projecten/new" element={<OrganigramPage />} />
        <Route path="/projecten/:projectId" element={<OrganigramPage />} />
        <Route path="/superchargers" element={<OrganigramPage />} />
        <Route path="/locaties" element={<OrganigramPage />} />
        <Route path="/locaties/new" element={<OrganigramPage />} />
        <Route path="/locaties/:locationId" element={<OrganigramPage />} />
        {/* Legacy redirects — automatically resolved by pathToView */}
        <Route path="/klanten" element={<OrganigramPage />} />
        <Route path="/toeleveranciers" element={<OrganigramPage />} />
        <Route path="/planning/projecten" element={<OrganigramPage />} />
        <Route path="/planning/projecten/:projectId" element={<OrganigramPage />} />
        <Route path="/planning/superchargers" element={<OrganigramPage />} />
        <Route path="/locatie/locaties" element={<OrganigramPage />} />
        <Route path="/locatie/locaties/:locationId" element={<OrganigramPage />} />
        <Route path="/locatie/projecten" element={<OrganigramPage />} />
        <Route path="/locatie/projecten/:locProjectId" element={<OrganigramPage />} />

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
          <Route path="toeleveranciers" element={<ToeleveranciersManager />} />
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
