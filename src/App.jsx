import HomeScreen from './HomeScreen.jsx';
import ApprovalConfiguration from './ApprovalConfiguration.jsx';
import AcademicProfile from './AcademicProfile.jsx';
import TransportMessaging from './TransportMessaging.jsx';

export default function App() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  if (path === '/student-profile') return <AcademicProfile />;
  if (path === '/approval-configuration') return <ApprovalConfiguration />;
  if (path === '/transport-messaging') return <TransportMessaging />;
  return <HomeScreen />;
}
