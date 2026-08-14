import { Outlet, NavLink } from 'react-router-dom';
import { Home, Users, LogOut, Activity, Trophy } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';

export default function AppLayout() {
  const { signOut, user } = useAuth();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: Home },
    { name: 'Matches', path: '/matches', icon: Activity },
    { name: 'Players', path: '/players', icon: Users },
    { name: 'Leaderboard', path: '/leaderboard', icon: Trophy },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col md:flex-row pb-16 md:pb-0">
      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-neutral-900 border-t border-neutral-800 md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center w-full h-full space-y-1 text-xs font-medium transition-colors",
                  isActive ? "text-primary-400" : "text-neutral-400 hover:text-neutral-200"
                )
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Desktop Sidebar Nav */}
      <nav className="hidden md:flex flex-col w-64 bg-neutral-900 border-r border-neutral-800">
        <div className="p-6">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="w-8 h-8 rounded bg-primary-500 flex items-center justify-center text-black">ST</span>
            StatTracker
          </h1>
        </div>
        <div className="flex-1 px-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive ? "bg-primary-900/50 text-primary-400" : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                )
              }
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </NavLink>
          ))}
        </div>
        <div className="p-4 border-t border-neutral-800">
          {user ? (
            <button
              onClick={signOut}
              className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          ) : (
            <NavLink
              to="/login"
              className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-primary-400 bg-primary-900/20 hover:bg-primary-900/40 transition-colors"
            >
              <Users className="w-5 h-5" />
              Sign In
            </NavLink>
          )}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobile Header */}
        <header className="md:hidden bg-neutral-900 border-b border-neutral-800 h-14 flex items-center justify-between px-4 sticky top-0 z-40">
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-primary-500 flex items-center justify-center text-black text-xs">ST</span>
            StatTracker
          </h1>
          {user ? (
            <button onClick={signOut} className="text-neutral-400 hover:text-white">
              <LogOut className="w-5 h-5" />
            </button>
          ) : (
            <NavLink to="/login" className="text-primary-400 text-sm font-medium">
              Sign In
            </NavLink>
          )}
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
