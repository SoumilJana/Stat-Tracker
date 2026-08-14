import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import Players from './pages/Players';
import Matches from './pages/Matches';
import NewMatch from './pages/NewMatch';
import ActiveMatch from './pages/ActiveMatch';
import Leaderboard from './pages/Leaderboard';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-primary-500">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  
  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      <Route path="/signup" element={!user ? <SignUp /> : <Navigate to="/" />} />
      
      <Route path="/" element={<AppLayout />}>
        {/* Public Routes */}
        <Route path="matches/:id" element={<ActiveMatch />} />
        
        {/* Protected Routes */}
        <Route index element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="matches" element={<ProtectedRoute><Matches /></ProtectedRoute>} />
        <Route path="matches/new" element={<ProtectedRoute><NewMatch /></ProtectedRoute>} />
        <Route path="players" element={<ProtectedRoute><Players /></ProtectedRoute>} />
        <Route path="leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
