import HomeScreen from './HomeScreen.jsx';
import ApprovalConfiguration from './ApprovalConfiguration.jsx';
import AcademicProfile from './AcademicProfile.jsx';

export default function App() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  if (path === '/student-profile') return <AcademicProfile />;
  if (path === '/approval-configuration') return <ApprovalConfiguration />;
  return <HomeScreen />;
}
