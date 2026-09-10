import React, { Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { InstallPrompt } from './components/InstallPrompt';
import AppLayout from './components/layout/AppLayout';

const Login = React.lazy(() => import('./pages/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Players = React.lazy(() => import('./pages/Players'));
const Matches = React.lazy(() => import('./pages/Matches'));
const NewMatch = React.lazy(() => import('./pages/NewMatch'));
const ActiveMatch = React.lazy(() => import('./pages/ActiveMatch'));
const Leaderboard = React.lazy(() => import('./pages/Leaderboard'));
const Drafts = React.lazy(() => import('./pages/Drafts'));
const Seasons = React.lazy(() => import('./pages/Seasons'));

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
    <Suspense fallback={<div className="min-h-screen bg-neutral-950 flex items-center justify-center text-primary-500">Loading...</div>}>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        
        <Route path="/" element={<AppLayout />}>
          {/* Public Routes */}
          <Route path="matches/:id" element={<ActiveMatch />} />
          
          {/* Protected Routes */}
          <Route index element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="matches" element={<ProtectedRoute><Matches /></ProtectedRoute>} />
          <Route path="matches/new" element={<ProtectedRoute><NewMatch /></ProtectedRoute>} />
          <Route path="players" element={<ProtectedRoute><Players /></ProtectedRoute>} />
          <Route path="drafts" element={<ProtectedRoute><Drafts /></ProtectedRoute>} />
          <Route path="leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
          <Route path="seasons" element={<ProtectedRoute><Seasons /></ProtectedRoute>} />
        </Route>
      </Routes>
    </Suspense>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <InstallPrompt />
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
