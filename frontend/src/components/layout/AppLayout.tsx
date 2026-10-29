import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Home, Users, LogOut, Activity, Trophy, User as UserIcon, ClipboardList, Award } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

function AccountDropdown({ user, profile, signOut }: { user: any, profile: any, signOut: () => void }) {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (open && user?.id && !stats) {
      supabase.from('player_stats').select('*').eq('player_id', user.id).single().then(({ data }) => {
        if (data) setStats(data);
      });
    }
  }, [open, user?.id, stats]);

  return (
    <div className="relative">
      <button 
        onClick={() => setOpen(!open)} 
        aria-label="Account Menu"
        className="w-9 h-9 rounded-full bg-neutral-800/90 border border-white/10 hover:border-primary-500/50 flex items-center justify-center text-neutral-400 hover:text-white transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 active:scale-95 overflow-hidden shadow-sm ring-1 ring-black/40"
      >
        {profile?.photo_url ? (
          <img src={profile.photo_url} alt="Profile" className="w-full h-full rounded-full object-cover" loading="lazy" decoding="async" />
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
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 mt-2.5 w-60 bg-neutral-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 origin-top-right ring-1 ring-black/60"
          >
            <div className="px-4 py-3 border-b border-white/[0.08] bg-black/30">
              <p className="text-white font-bold truncate">{profile?.username || 'Player'}</p>
              <p className="text-xs text-neutral-400 capitalize">{profile?.role || 'player'}</p>
            </div>
            
            <div className="p-2">
              <div className="px-2 py-2 mb-1 grid grid-cols-3 gap-2 text-center text-xs border-b border-white/[0.06] pb-3">
                <div className="bg-neutral-800/60 border border-white/5 rounded-xl py-1.5">
                  <div className="font-bold text-primary-400">{stats?.total_goals || 0}</div>
                  <div className="text-[9px] text-neutral-400 uppercase tracking-wider mt-0.5">Goals</div>
                </div>
                <div className="bg-neutral-800/60 border border-white/5 rounded-xl py-1.5">
                  <div className="font-bold text-blue-400">{stats?.total_assists || 0}</div>
                  <div className="text-[9px] text-neutral-400 uppercase tracking-wider mt-0.5">Asts</div>
                </div>
                <div className="bg-neutral-800/60 border border-white/5 rounded-xl py-1.5">
                  <div className="font-bold text-white">{stats?.games_played || 0}</div>
                  <div className="text-[9px] text-neutral-400 uppercase tracking-wider mt-0.5">Games</div>
                </div>
              </div>
              
              <button
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors mt-1"
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

const NAV_ITEMS = [
  { name: 'Dashboard', mobileName: 'Home', path: '/', icon: Home },
  { name: 'Matches', mobileName: 'Matches', path: '/matches', icon: Activity },
  { name: 'Drafts', mobileName: 'Drafts', path: '/drafts', icon: ClipboardList },
  { name: 'Players', mobileName: 'Players', path: '/players', icon: Users },
  { name: 'Leaderboard', mobileName: 'Ranking', path: '/leaderboard', icon: Trophy },
  { name: 'Hall of Fame', mobileName: 'Awards', path: '/seasons', icon: Award },
];

export default function AppLayout() {
  const { signOut, user, profile } = useAuth();
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const isAnkita = profile?.username?.toLowerCase() === 'ankita' || profile?.full_name?.toLowerCase() === 'ankita' || profile?.name?.toLowerCase() === 'ankita';
    if (isAnkita) {
      document.body.classList.add('theme-pink');
    } else {
      document.body.classList.remove('theme-pink');
    }
  }, [profile]);

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col md:flex-row">
      {/* Mobile Bottom Dock Navigation (Flush with viewport bottom edge) */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 inset-x-0 z-50 flex justify-center pointer-events-none md:hidden"
      >
        <div className="pointer-events-auto w-full max-w-lg bg-neutral-900/95 backdrop-blur-2xl border-t border-x sm:border-x border-white/10 rounded-t-[22px] shadow-[0_-6px_24px_rgba(0,0,0,0.55)] px-1.5 pt-1.5 pb-[max(0.45rem,env(safe-area-inset-bottom))] flex items-center justify-between ring-1 ring-black/40">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "relative flex flex-col items-center justify-center flex-1 py-1 min-h-[42px] rounded-xl transition-all select-none active:scale-95 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50",
                  isActive ? "text-primary-400" : "text-neutral-400 hover:text-neutral-200"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="mobile-nav-dock-pill"
                      className="absolute inset-0 bg-primary-950/70 border border-primary-500/30 rounded-xl shadow-[0_0_12px_rgba(16,185,129,0.18)]"
                      transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <div className="relative z-10 flex flex-col items-center justify-center">
                    <item.icon
                      className={cn(
                        "w-[18px] h-[18px] mb-0.5 transition-transform duration-200",
                        isActive ? "scale-105 text-primary-400" : "group-hover:scale-105 opacity-75 group-hover:opacity-100"
                      )}
                    />
                    <span
                      className={cn(
                        "text-[10px] tracking-tight leading-none truncate max-w-[50px] text-center",
                        isActive ? "font-bold text-primary-300" : "font-medium"
                      )}
                    >
                      {item.mobileName}
                    </span>
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Desktop Sidebar Nav */}
      <nav className="hidden md:flex flex-col w-64 bg-neutral-900 border-r border-neutral-800 shrink-0">
        <div className="p-6 border-b border-white/[0.05]">
          <h1 className="text-xl font-black text-white flex items-center gap-2.5 tracking-tight">
            <img src="/pwa-192x192.png" alt="StatTracker Logo" className="w-8 h-8 rounded-xl shadow-md border border-white/10" />
            StatTracker
          </h1>
        </div>
        <div className="flex-1 px-4 space-y-1.5 mt-4 relative">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all relative overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50",
                  isActive ? "text-primary-400 font-bold" : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="desktop-nav-indicator"
                      className="absolute inset-0 bg-primary-950/50 border border-primary-500/20 rounded-xl"
                      transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                  <item.icon className="w-5 h-5 relative z-10 transition-transform duration-200 group-hover:scale-105" />
                  <span className="relative z-10">{item.name}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden h-screen">
        {/* Seamless Top Header (Mobile Brand + Desktop Profile Bar) */}
        <header className="h-14 sm:h-16 shrink-0 flex items-center justify-between md:justify-end px-4 sm:px-6 md:px-8 sticky top-0 z-40 bg-neutral-950/85 backdrop-blur-md md:bg-transparent">
          {/* Mobile Brand Lockup */}
          <div className="flex md:hidden items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-neutral-900 border border-white/10 p-1 flex items-center justify-center">
              <img src="/pwa-192x192.png" alt="StatTracker Logo" className="w-full h-full rounded-lg object-cover" />
            </div>
            <span className="text-base sm:text-lg font-black text-white tracking-tight">StatTracker</span>
          </div>
          
          <div className="flex items-center gap-3">
            {user ? (
              <AccountDropdown user={user} profile={profile} signOut={signOut} />
            ) : (
              <NavLink
                to="/login"
                className="text-primary-400 text-xs sm:text-sm font-bold hover:text-primary-300 transition-all bg-primary-950/40 hover:bg-primary-950/60 border border-primary-500/30 px-3.5 py-1.5 rounded-full pointer-events-auto shadow-sm active:scale-95 flex items-center gap-1.5"
              >
                Sign In
              </NavLink>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto w-full relative">
          <div className="p-4 md:p-8 max-w-7xl mx-auto w-full min-h-full pb-28 sm:pb-32 md:pb-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
                className="w-full"
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
