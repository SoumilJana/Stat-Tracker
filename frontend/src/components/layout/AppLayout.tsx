import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Home, Users, LogOut, Activity, Trophy, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

function AccountDropdown({ user, profile, signOut }: { user: any, profile: any, signOut: () => void }) {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (open && user?.id) {
      supabase.from('player_stats').select('*').eq('player_id', user.id).single().then(({ data }) => {
        if (data) setStats(data);
      });
    }
  }, [open, user?.id]);

  return (
    <div className="relative">
      <button 
        onClick={() => setOpen(!open)} 
        className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors focus:outline-none"
      >
        {profile?.photo_url ? (
          <img src={profile.photo_url} alt="Profile" className="w-full h-full rounded-full object-cover" />
        ) : (
          <UserIcon className="w-4 h-4" />
        )}
      </button>
      
      <AnimatePresence>
      {open && (
        <>
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40" onClick={() => setOpen(false)} 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute right-0 mt-2 w-56 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden z-50 origin-top-right"
          >
            <div className="px-4 py-3 border-b border-neutral-800 bg-black/20">
              <p className="text-white font-bold truncate">{profile?.username || 'Player'}</p>
              <p className="text-xs text-neutral-500 capitalize">{profile?.role || 'player'}</p>
            </div>
            
            <div className="p-2">
              <div className="px-2 py-2 mb-1 grid grid-cols-3 gap-2 text-center text-xs border-b border-neutral-800/50 pb-3">
                <div className="bg-neutral-800/50 rounded py-1">
                  <div className="font-bold text-primary-400">{stats?.total_goals || 0}</div>
                  <div className="text-[9px] text-neutral-500 uppercase tracking-wider mt-0.5">Goals</div>
                </div>
                <div className="bg-neutral-800/50 rounded py-1">
                  <div className="font-bold text-blue-400">{stats?.total_assists || 0}</div>
                  <div className="text-[9px] text-neutral-500 uppercase tracking-wider mt-0.5">Asts</div>
                </div>
                <div className="bg-neutral-800/50 rounded py-1">
                  <div className="font-bold text-white">{stats?.games_played || 0}</div>
                  <div className="text-[9px] text-neutral-500 uppercase tracking-wider mt-0.5">Games</div>
                </div>
              </div>
              
              <button
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-neutral-800 transition-colors mt-1"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </motion.div>
        </>
      )}
      </AnimatePresence>
    </div>
  );
}

export default function AppLayout() {
  const { signOut, user, profile } = useAuth();
  const location = useLocation();

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
                  "flex flex-col items-center justify-center w-full h-full space-y-1 text-xs font-medium transition-colors relative",
                  isActive ? "text-primary-400" : "text-neutral-400 hover:text-neutral-200"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className="w-5 h-5 relative z-10" />
                  <span className="relative z-10">{item.name}</span>
                  {isActive && (
                    <motion.div
                      layoutId="mobile-nav-indicator"
                      className="absolute inset-0 bg-primary-900/20"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Desktop Sidebar Nav */}
      <nav className="hidden md:flex flex-col w-64 bg-neutral-900 border-r border-neutral-800 shrink-0">
        <div className="p-6">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <img src="/pwa-192x192.png" alt="StatTracker Logo" className="w-8 h-8 rounded" />
            StatTracker
          </h1>
        </div>
        <div className="flex-1 px-4 space-y-2 mt-4 relative">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative overflow-hidden",
                  isActive ? "text-primary-400" : "text-neutral-400 hover:text-neutral-200"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="desktop-nav-indicator"
                      className="absolute inset-0 bg-primary-900/30 rounded-lg"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <item.icon className="w-5 h-5 relative z-10" />
                  <span className="relative z-10">{item.name}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden h-screen">
        {/* Unified Header (Mobile + Desktop Top Right) */}
        <header className="h-14 shrink-0 flex items-center justify-between md:justify-end px-4 md:px-8 mt-0 md:mt-4 sticky top-0 z-40 bg-neutral-900/80 backdrop-blur-sm border-b border-neutral-800 md:bg-transparent md:border-none md:backdrop-blur-none">
          <h1 className="md:hidden text-lg font-bold text-white flex items-center gap-2">
            <img src="/pwa-192x192.png" alt="StatTracker Logo" className="w-6 h-6 rounded" />
            StatTracker
          </h1>
          
          <div className="flex items-center gap-4">
            {user ? (
              <AccountDropdown user={user} profile={profile} signOut={signOut} />
            ) : (
              <NavLink to="/login" className="text-primary-400 text-sm font-medium hover:text-primary-300 transition-colors bg-primary-900/20 px-4 py-1.5 rounded-full pointer-events-auto shadow-md">
                Sign In
              </NavLink>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto w-full relative">
          <div className="p-4 md:p-8 max-w-7xl mx-auto w-full min-h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
