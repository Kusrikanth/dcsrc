import HomeScreen from './HomeScreen.jsx';
import ApprovalConfiguration from './ApprovalConfiguration.jsx';
import AcademicProfile from './AcademicProfile.jsx';
import TransportMessaging from './TransportMessaging.jsx';
import { DocumentationManagement, DocumentationPortal } from './documentation/index.js';

export default function App() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  if (path === '/student-profile') return <AcademicProfile />;
  if (path === '/approval-configuration') return <ApprovalConfiguration />;
  if (path === '/transport-messaging') return <TransportMessaging />;
  if (path === '/documentation') return <DocumentationPortal />;
  if (path === '/knowledge-base-management') return <DocumentationManagement />;
  if (path === '/documentation-management') return <DocumentationManagement />;
  return <HomeScreen />;
}
