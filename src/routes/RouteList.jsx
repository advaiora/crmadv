import React from "react";
import { Redirect } from "react-router-dom";
import AgencyAlertsPage from "../views/Agency/AgencyAlertsPage";
import AgencyOpportunitiesPage from "../views/Agency/AgencyOpportunitiesPage";
import AgencyProjectNewPage from "../views/Agency/AgencyProjectNewPage";
import AgencyProjectsListPage from "../views/Agency/AgencyProjectsListPage";
import AgencyReportsPage from "../views/Agency/AgencyReportsPage";
import AgencySettingsPage from "../views/Agency/AgencySettingsPage";
import AgencyProjectAdsPage from "../views/Agency/project/AgencyProjectAdsPage";
import AgencyProjectAlertsPage from "../views/Agency/project/AgencyProjectAlertsPage";
import AgencyProjectAssetsPage from "../views/Agency/project/AgencyProjectAssetsPage";
import AgencyProjectBrainPage from "../views/Agency/project/AgencyProjectBrainPage";
import AgencyProjectClientReportPage from "../views/Agency/project/AgencyProjectClientReportPage";
import AgencyProjectDiscoveryPage from "../views/Agency/project/AgencyProjectDiscoveryPage";
import AgencyProjectDiagnosisPage from "../views/Agency/project/AgencyProjectDiagnosisPage";
import AgencyProjectMemoryPage from "../views/Agency/project/AgencyProjectMemoryPage";
import AgencyProjectOpportunitiesPage from "../views/Agency/project/AgencyProjectOpportunitiesPage";
import AgencyProjectOverviewPage from "../views/Agency/project/AgencyProjectOverviewPage";
import AgencyProjectReportsPage from "../views/Agency/project/AgencyProjectReportsPage";
import AgencyProjectTasksPage from "../views/Agency/project/AgencyProjectTasksPage";
import AgencyProjectWebPage from "../views/Agency/project/AgencyProjectWebPage";
import Calendar from "../views/Calendar";
import ChecklistsTemplates from "../views/Checklists";
import ClientDetail from "../views/Clients/ClientDetail";
import ClientEdit from "../views/Clients/ClientEdit";
import ClientsList from "../views/Clients/ClientsList";
import ClientNew from "../views/Clients/ClientNew";
import Dashboard from "../views/Dashboard";
import Team from "../views/Team";
import Email from "../views/Email";
import QuoteDetail from "../views/Quotes/QuoteDetail";
import QuoteFormPage from "../views/Quotes/QuoteFormPage";
import QuoteNotificationsSettings from "../views/Quotes/QuoteNotificationsSettings";
import QuoteTemplateFormPage from "../views/Quotes/QuoteTemplateFormPage";
import QuoteTemplatesList from "../views/Quotes/QuoteTemplatesList";
import QuotesList from "../views/Quotes/QuotesList";
import ProjectDetail from "../views/Projects/ProjectDetail";
import ProjectPipelineSettings from "../views/Projects/ProjectPipelineSettings";
import ProjectsHome from "../views/Projects/ProjectsBoard";
import Vault from "../views/Vault";
import WebAssets from "../views/WebAssets";
//Pages
import Profile from "../views/Profiles/Profile";
import EditProfile from "../views/Profiles/EditProfile";
import Account from "../views/Profiles/Account";
import WorkspaceBranding from "../views/WorkspaceBranding";
import ModulesSettingsPage from "../views/Settings/Modules";
import ThemePreviewPage from "../views/Settings/ThemePreview";
import ResponsiveQAPage from "../views/Settings/ResponsiveQA";
import ShortcutsSettings from "../views/Settings/ShortcutsSettings";
import AuditPage from "../views/Audit";
//Auth
import Login from "../views/Authentication/LogIn/Login/Login";
import LoginSimple from "../views/Authentication/LogIn/LoginSimple";
import LoginClassic from "../views/Authentication/LogIn/LoginClassic";
import Signup from "../views/Authentication/SignUp/Signup";
import SignUpSimple from "../views/Authentication/SignUp/SignupSimple";
import SignupClassic from "../views/Authentication/SignUp/SignupClassic";
import LockScreen from "../views/Authentication/LockScreen";
import ResetPassword from "../views/Authentication/ResetPassword";
import Error404 from "../views/Authentication/Error404/Error404";
import Error503 from "../views/Authentication/Error503/Error503";

const AgencyProjectOverviewRedirect = ({ match }) => (
    <Redirect to={`${match.url}/overview`} />
);

export const routes = [

    { path: 'dashboard', exact: true, component: Dashboard },
    //Apps
    { path: 'apps/calendar', exact: true, component: Calendar },
    { path: 'apps/email', exact: true, component: Email },
    { path: 'apps/clients', exact: true, component: ClientsList },
    { path: 'apps/clients/new', exact: true, component: ClientNew },
    { path: 'apps/clients/:id/edit', exact: true, component: ClientEdit },
    { path: 'apps/clients/:id', exact: true, component: ClientDetail },
    { path: 'apps/team', exact: true, component: Team },
    { path: 'apps/quotes', exact: true, component: QuotesList },
    { path: 'apps/quotes/new', exact: true, component: QuoteFormPage },
    { path: 'apps/quotes/templates', exact: true, component: QuoteTemplatesList },
    { path: 'apps/quotes/templates/new', exact: true, component: QuoteTemplateFormPage },
    { path: 'apps/quotes/templates/:id/edit', exact: true, component: QuoteTemplateFormPage },
    { path: 'apps/quotes/notifications', exact: true, component: QuoteNotificationsSettings },
    { path: 'apps/quotes/:id/edit', exact: true, component: QuoteFormPage },
    { path: 'apps/quotes/:id', exact: true, component: QuoteDetail },
    { path: 'apps/vault', exact: true, component: Vault },
    { path: 'apps/web-assets', exact: true, component: WebAssets },
    { path: 'projects', exact: true, component: ProjectsHome },
    { path: 'projects/settings/pipeline', exact: true, component: ProjectPipelineSettings },
    { path: 'projects/:id', exact: true, component: ProjectDetail },
    { path: 'agency/projects', exact: true, component: AgencyProjectsListPage },
    { path: 'agency/projects/new', exact: true, component: AgencyProjectNewPage },
    { path: 'agency/projects/:projectId', exact: true, component: AgencyProjectOverviewRedirect },
    { path: 'agency/projects/:projectId/overview', exact: true, component: AgencyProjectOverviewPage },
    { path: 'agency/projects/:projectId/discovery', exact: true, component: AgencyProjectDiscoveryPage },
    { path: 'agency/projects/:projectId/diagnosis', exact: true, component: AgencyProjectDiagnosisPage },
    { path: 'agency/projects/:projectId/brain', exact: true, component: AgencyProjectBrainPage },
    { path: 'agency/projects/:projectId/web', exact: true, component: AgencyProjectWebPage },
    { path: 'agency/projects/:projectId/ads', exact: true, component: AgencyProjectAdsPage },
    { path: 'agency/projects/:projectId/alerts', exact: true, component: AgencyProjectAlertsPage },
    { path: 'agency/projects/:projectId/reports', exact: true, component: AgencyProjectReportsPage },
    { path: 'agency/projects/:projectId/reports/client', exact: true, component: AgencyProjectClientReportPage },
    { path: 'agency/projects/:projectId/opportunities', exact: true, component: AgencyProjectOpportunitiesPage },
    { path: 'agency/projects/:projectId/memory', exact: true, component: AgencyProjectMemoryPage },
    { path: 'agency/projects/:projectId/assets', exact: true, component: AgencyProjectAssetsPage },
    { path: 'agency/projects/:projectId/tasks', exact: true, component: AgencyProjectTasksPage },
    { path: 'agency/alerts', exact: true, component: AgencyAlertsPage },
    { path: 'agency/opportunities', exact: true, component: AgencyOpportunitiesPage },
    { path: 'agency/reports', exact: true, component: AgencyReportsPage },
    { path: 'agency/settings', exact: true, component: AgencySettingsPage },
    { path: 'checklists/templates', exact: true, component: ChecklistsTemplates },
    //Pages
    { path: 'pages/profile', exact: true, component: Profile },
    { path: 'pages/edit-profile', exact: true, component: EditProfile },
    { path: 'pages/account', exact: true, component: Account },
    { path: 'pages/workspace-branding', exact: true, component: WorkspaceBranding },
    { path: 'settings/modules', exact: true, component: ModulesSettingsPage },
    { path: 'settings/theme-preview', exact: true, component: ThemePreviewPage },
    { path: 'settings/shortcuts', exact: true, component: ShortcutsSettings },
    { path: 'settings/responsive-qa', exact: true, component: ResponsiveQAPage },
    { path: 'audit', exact: true, component: AuditPage },
    //Error
    { path: 'error-404', exact: true, component: Error404 },
]

export const authRoutes = [
    { path: '/login', exact: true, component: Login },
    { path: '/auth/login', exact: true, component: Login },
    { path: '/login-simple', exact: true, component: LoginSimple },
    { path: '/login-classic', exact: true, component: LoginClassic },
    { path: '/signup', exact: true, component: Signup },
    { path: '/auth/signup', exact: true, component: Signup },
    { path: '/signup-simple', exact: true, component: SignUpSimple },
    { path: '/signup-classic', exact: true, component: SignupClassic },
    { path: '/lock-screen', exact: true, component: LockScreen },
    { path: '/reset-password', exact: true, component: ResetPassword },
    { path: '/error-503', exact: true, component: Error503 },
]
