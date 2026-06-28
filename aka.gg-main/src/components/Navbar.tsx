// src/components/Navbar.tsx — ATAK.GG red/black brand nav
import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown, LayoutDashboard, LogOut, User, Zap } from 'lucide-react';
import { useAuth } from '@/features/auth/useAuth';

const NAV_LINKS = [
  { label: 'Stats',       href: '/stats'      },
  { label: 'Tournaments', href: '/tournaments' },
  { label: 'Social',      href: '/social'      },
];

const DaggerLogo = ({ className = "h-8 w-8" }) => (
  <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M32 4L12 40L32 60L52 40L32 4Z" fill="url(#nav-dagger-glow)" opacity="0.15" />
    <path d="M32 8L22 38L32 50L42 38L32 8Z" fill="url(#nav-blade-grad)" stroke="#ef4444" strokeWidth="2" />
    <path d="M32 8V50" stroke="#fff" strokeWidth="1" opacity="0.6" />
    <path d="M16 46H48" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
    <path d="M14 46L10 50" stroke="#b91c1c" strokeWidth="3" strokeLinecap="round" />
    <path d="M50 46L54 50" stroke="#b91c1c" strokeWidth="3" strokeLinecap="round" />
    <path d="M32 46V58" stroke="#111" strokeWidth="4" strokeLinecap="round" />
    <path d="M32 58V62" stroke="#b91c1c" strokeWidth="6" strokeLinecap="round" />
    <defs>
      <linearGradient id="nav-blade-grad" x1="32" y1="8" x2="32" y2="50" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ff4d4d" />
        <stop offset="100%" stopColor="#3b0000" />
      </linearGradient>
      <radialGradient id="nav-dagger-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#ef4444" />
        <stop offset="100%" stopColor="transparent" />
      </radialGradient>
    </defs>
  </svg>
);

export const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileOpen, setMobileOpen]     = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled]         = useState(false);
  const location = useLocation();
  const menuRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const initial = user?.name?.[0]?.toUpperCase() || '?';
  const isHome  = location.pathname === '/';

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      scrolled || !isHome
        ? 'bg-black/90 backdrop-blur-xl border-b border-red-900/30'
        : 'bg-transparent border-b border-white/[0.04]'
    }`}>
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        <div className="flex items-center justify-between h-15 py-3">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="relative">
              <DaggerLogo className="h-8 w-8 transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]" />
              <div className="absolute inset-0 rounded-full bg-red-500/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-lg font-black tracking-tight text-white">
                ATAK<span className="text-red-500">.GG</span>
              </span>
              <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest">Powered by Riot API</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(link => {
              const active = location.pathname === link.href ||
                             (link.href !== '/' && location.pathname.startsWith(link.href));
              return (
                <Link key={link.href} to={link.href}
                  className={`text-sm font-medium transition-all duration-200 relative group ${
                    active ? 'text-red-400' : 'text-gray-400 hover:text-white'
                  }`}>
                  {link.label}
                  <span className={`absolute -bottom-0.5 left-0 h-0.5 bg-gradient-to-r from-red-500 to-red-400 transition-all duration-300 ${
                    active ? 'w-full' : 'w-0 group-hover:w-full'
                  }`} />
                </Link>
              );
            })}
          </nav>

          {/* Desktop auth */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated && user ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/[0.05] border border-red-900/30 hover:border-red-600/50 transition-all duration-200"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-xs font-black text-white flex-shrink-0">
                    {initial}
                  </div>
                  <span className="text-sm font-medium text-white/80 max-w-[120px] truncate">{user.name}</span>
                  <ChevronDown className={`h-3.5 w-3.5 text-gray-500 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-black/95 border border-red-900/30 rounded-xl shadow-2xl shadow-black/70 overflow-hidden z-50 backdrop-blur-xl">
                    <div className="px-4 py-3 border-b border-white/[0.05]">
                      <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                      <p className="text-xs text-gray-600 truncate">{user.email}</p>
                    </div>
                    <div className="py-1">
                      <Link to="/dashboard" onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-red-600/10 transition-colors">
                        <LayoutDashboard className="h-4 w-4 text-red-500" />Dashboard
                      </Link>
                      <Link to="/stats" onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-red-600/10 transition-colors">
                        <User className="h-4 w-4 text-red-500" />Mi Perfil
                      </Link>
                    </div>
                    <div className="border-t border-white/[0.05] py-1">
                      <button onClick={() => { setUserMenuOpen(false); logout(); }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-500 hover:text-red-400 hover:bg-red-600/10 transition-colors">
                        <LogOut className="h-4 w-4" />Cerrar sesión
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link to="/login">
                  <button className="px-4 py-1.5 text-sm text-gray-400 hover:text-white font-medium transition-colors">
                    Sign In
                  </button>
                </Link>
                <Link to="/register">
                  <button className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold text-white rounded-full shadow-lg shadow-red-600/25 transition-all duration-300 hover:shadow-red-600/45 hover:scale-105"
                    style={{ background: 'linear-gradient(135deg,#ef4444,#b91c1c)' }}>
                    <Zap className="h-3.5 w-3.5" />Register
                  </button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-white/70 hover:text-white transition-colors">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-5 border-t border-red-900/20 mt-1 pt-4">
            <div className="flex flex-col space-y-1">
              {NAV_LINKS.map(link => (
                <Link key={link.href} to={link.href}
                  className="text-gray-300 hover:text-white font-medium text-sm py-2.5 px-3 rounded-lg hover:bg-red-600/10 transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-white/[0.04] flex flex-col gap-2">
              {isAuthenticated && user ? (
                <>
                  <Link to="/dashboard" className="flex items-center gap-2 text-sm text-gray-300 hover:text-white py-2 px-3 rounded-lg hover:bg-red-600/10 transition-colors">
                    <LayoutDashboard className="h-4 w-4 text-red-500" />Dashboard
                  </Link>
                  <button onClick={logout} className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-400 py-2 px-3 rounded-lg hover:bg-red-600/10 transition-colors w-full text-left">
                    <LogOut className="h-4 w-4" />Cerrar sesión
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="block w-full py-2.5 text-center text-sm text-gray-400 border border-white/[0.08] rounded-lg">Sign In</Link>
                  <Link to="/register" className="block w-full py-2.5 text-center text-sm font-bold text-white rounded-lg"
                    style={{ background: 'linear-gradient(135deg,#ef4444,#b91c1c)' }}>Register</Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
