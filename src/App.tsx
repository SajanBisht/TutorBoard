import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { LoadingScreen } from './components/LoadingScreen';
import { LoginScreen } from './features/auth/LoginScreen';
import { RegisterScreen } from './features/auth/RegisterScreen';
import { LobbyScreen } from './features/lobby/LobbyScreen';
import { SessionScreen } from './features/session/SessionScreen';
import { GroupsScreen } from './features/groups/GroupsScreen';
import { GroupChatScreen } from './features/groups/GroupChatScreen';
import { AdminScreen } from './features/admin/AdminScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading, session } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { loading, session } = useAuth();
  if (loading) return <LoadingScreen />;

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/lobby" replace /> : <LoginScreen />} />
      <Route path="/register" element={session ? <Navigate to="/lobby" replace /> : <RegisterScreen />} />
      <Route path="/lobby" element={<ProtectedRoute><LobbyScreen /></ProtectedRoute>} />
      <Route path="/session/:id" element={<ProtectedRoute><SessionScreen /></ProtectedRoute>} />
      <Route path="/groups" element={<ProtectedRoute><GroupsScreen /></ProtectedRoute>} />
      <Route path="/groups/:id" element={<ProtectedRoute><GroupChatScreen /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsScreen /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminScreen /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={session ? '/lobby' : '/login'} replace />} />
    </Routes>
  );
}
