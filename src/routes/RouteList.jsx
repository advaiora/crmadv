import AddNewPost from "../views/Blog/AddNewPost";
import PostDetail from "../views/Blog/PostDetails";
import Posts from "../views/Blog/Posts";
import Calendar from "../views/Calendar";
import Chats from "../views/Chat/Chats";
import ChatContacts from "../views/Chat/Contact";
import ChatGroups from "../views/Chat/Groups";
import ContactCards from "../views/Contact/ContactCards";
import ContactList from "../views/Contact/ContactList";
import EditContact from "../views/Contact/EditContact";
import Dashboard from "../views/Dashboard";
import Email from "../views/Email";
import GridView from "../views/FileManager/GridView";
import ListView from "../views/FileManager/ListView";
import Gallery from "../views/Gallery";
import AllApps from "../views/Integrations/All Apps";
import IntegrationsDetail from "../views/Integrations/App Details";
import Integration from "../views/Integrations/Integration";
import CreateInvoice from "../views/Invoices/CreateInvoice";
import InvoiceList from "../views/Invoices/InvoiceList";
import InvoiceTemplates from "../views/Invoices/InvoiceTemplates";
import PreviewInvoice from "../views/Invoices/PreviewInvoice";
import KanbanBoard from "../views/Scrumboard/KanbanBoard/Index";
import Pipeline from "../views/Scrumboard/Pipeline";
import ProjectsBoard from "../views/Scrumboard/ProjectsBoard";
import Gantt from "../views/Todo/Gantt";
import TaskList from "../views/Todo/Tasklist";
//Pages
import Profile from "../views/Profiles/Profile";
import EditProfile from "../views/Profiles/EditProfile";
import Account from "../views/Profiles/Account";
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
import ChatPopup from "../views/ChatPopup/DirectMessage";
import ChatBot from "../views/ChatPopup/ChatBot";


export const routes = [

    { path: 'dashboard', exact: true, component: Dashboard },
    //Apps
    { path: 'apps/chat/chats', exact: true, component: Chats },
    { path: 'apps/chat/chat-groups', exact: true, component: ChatGroups },
    { path: 'apps/chat/chat-contact', exact: true, component: ChatContacts },
    { path: 'apps/chat-bot/chatpopup', exact: true, component: ChatPopup },
    { path: 'apps/chat-bot/chatbot', exact: true, component: ChatBot },
    { path: 'apps/calendar', exact: true, component: Calendar },
    { path: 'apps/email', exact: true, component: Email },
    { path: 'apps/taskboard/projects-board', exact: true, component: ProjectsBoard },
    { path: 'apps/taskboard/kanban-board', exact: true, component: KanbanBoard },
    { path: 'apps/taskboard/pipeline', exact: true, component: Pipeline },
    { path: 'apps/contacts/contact-list', exact: true, component: ContactList },
    { path: 'apps/contacts/contact-cards', exact: true, component: ContactCards },
    { path: 'apps/contacts/edit-contact', exact: true, component: EditContact },
    { path: 'apps/file-manager/list-view', exact: true, component: ListView },
    { path: 'apps/file-manager/grid-view', exact: true, component: GridView },
    { path: 'apps/gallery', exact: true, component: Gallery },
    { path: 'apps/todo/task-list', exact: true, component: TaskList },
    { path: 'apps/todo/gantt', exact: true, component: Gantt },
    { path: 'apps/blog/posts', exact: true, component: Posts },
    { path: 'apps/blog/add-new-post', exact: true, component: AddNewPost },
    { path: 'apps/blog/post-detail', exact: true, component: PostDetail },
    { path: 'apps/invoices/invoice-list', exact: true, component: InvoiceList },
    { path: 'apps/invoices/invoice-templates', exact: true, component: InvoiceTemplates },
    { path: 'apps/invoices/create-invoice', exact: true, component: CreateInvoice },
    { path: 'apps/invoices/invoice-preview', exact: true, component: PreviewInvoice },
    { path: 'apps/integrations/all-apps', exact: true, component: AllApps },
    { path: 'apps/integrations/integrations-detail', exact: true, component: IntegrationsDetail },
    { path: 'apps/integrations/integration', exact: true, component: Integration },
    //Pages
    { path: 'pages/profile', exact: true, component: Profile },
    { path: 'pages/edit-profile', exact: true, component: EditProfile },
    { path: 'pages/account', exact: true, component: Account },
    //Error
    { path: 'error-404', exact: true, component: Error404 },
]

export const authRoutes = [
    { path: '/login', exact: true, component: Login },
    { path: '/login-simple', exact: true, component: LoginSimple },
    { path: '/login-classic', exact: true, component: LoginClassic },
    { path: '/signup', exact: true, component: Signup },
    { path: '/signup-simple', exact: true, component: SignUpSimple },
    { path: '/signup-classic', exact: true, component: SignupClassic },
    { path: '/lock-screen', exact: true, component: LockScreen },
    { path: '/reset-password', exact: true, component: ResetPassword },
    { path: '/error-503', exact: true, component: Error503 },
]