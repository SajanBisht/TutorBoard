import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { LoginScreen } from './features/auth/LoginScreen';
import { RegisterScreen } from './features/auth/RegisterScreen';
import { LobbyScreen } from './features/lobby/LobbyScreen';
import { SessionScreen } from './features/session/SessionScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { AdminScreen } from './features/admin/AdminScreen';
import { GroupsScreen } from './features/groups/GroupsScreen';
import { GroupChatScreen } from './features/groups/GroupChatScreen';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid h-screen place-items-center bg-ink-50 dark:bg-ink-800"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid h-screen place-items-center bg-ink-50 dark:bg-ink-800"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>;
  if (user) return <Navigate to="/lobby" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnlyRoute><LoginScreen /></PublicOnlyRoute>} />
      <Route path="/register" element={<PublicOnlyRoute><RegisterScreen /></PublicOnlyRoute>} />
      <Route path="/lobby" element={<ProtectedRoute><LobbyScreen /></ProtectedRoute>} />
      <Route path="/session/:id" element={<ProtectedRoute><SessionScreen /></ProtectedRoute>} />
      <Route path="/groups" element={<ProtectedRoute><GroupsScreen /></ProtectedRoute>} />
      <Route path="/groups/:id" element={<ProtectedRoute><GroupChatScreen /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsScreen /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminScreen /></ProtectedRoute>} />
      <Route path="/g/:slug" element={<GroupSlugRedirect />} />
      <Route path="*" element={<Navigate to="/lobby" replace />} />
    </Routes>
  );
}

function GroupSlugRedirect() {
  return <Navigate to="/groups" replace />;
}
